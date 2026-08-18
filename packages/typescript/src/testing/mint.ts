/**
 * Minting helpers for tests, fixtures, and the demo.
 *
 * **Not an issuer.** No key management, no persistence, no policy. This exists
 * so tests can construct chains that a real issuer would produce, and so the
 * demo can run without a service. An issuer is out of scope for O2 and is not
 * on the roadmap for OAAF at all.
 */

import { CompactSign, exportJWK, generateKeyPair } from 'jose';
import canonicalize from 'canonicalize';

import { sha256Base64Url } from '../base64url.js';
import {
  AAT_AUTHORIZATION_DETAIL_TYPE,
  type AatPayload,
  type PopPayload,
  type ToolArguments,
  type ToolConstraints,
} from '../aat/claims.js';

export interface Keypair {
  privateKey: CryptoKey;
  publicJwk: Record<string, unknown>;
}

export async function generateHolderKey(): Promise<Keypair> {
  const { privateKey, publicKey } = await generateKeyPair('Ed25519', { extractable: true });
  return {
    privateKey: privateKey as CryptoKey,
    publicJwk: (await exportJWK(publicKey)) as unknown as Record<string, unknown>,
  };
}

async function sign(payload: object, privateKey: CryptoKey, alg = 'EdDSA'): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return new CompactSign(bytes).setProtectedHeader({ alg }).sign(privateKey);
}

export interface MintRootInput {
  issuer: string;
  /**
   * Key that signs the root token — the trust anchor. Distinct from `holder`:
   * the issuer attests the grant, the holder exercises it.
   */
  issuerKey: Keypair;
  /** Key the grant is issued to. Becomes `cnf.jwk`. */
  holder: Keypair;
  tools: Record<string, ToolConstraints>;
  issuedAt: number;
  expiresAt: number;
  maxDepth?: number;
  jti?: string;
  /** Override the signing algorithm — used to build adversarial fixtures. */
  alg?: string;
  /** Sign with a different key than `holder` — used to build invalid fixtures. */
  signWith?: CryptoKey;
}

export async function mintRootToken(input: MintRootInput): Promise<string> {
  const payload: AatPayload = {
    jti: input.jti ?? `root-${input.issuedAt}`,
    iss: input.issuer,
    iat: input.issuedAt,
    exp: input.expiresAt,
    cnf: { jwk: input.holder.publicJwk },
    del_depth: 0,
    del_max_depth: input.maxDepth ?? 3,
    authorization_details: [{ type: AAT_AUTHORIZATION_DETAIL_TYPE, tools: input.tools }],
  };
  return sign(payload, input.signWith ?? input.issuerKey.privateKey, input.alg);
}

/** base64url-nopad SHA-256 of a token's JWS signing input. */
export async function parentHashOf(token: string): Promise<string> {
  return sha256Base64Url(token.slice(0, token.lastIndexOf('.')));
}

export interface MintDerivedInput {
  parentToken: string;
  parentKey: Keypair;
  parentPayload: Pick<AatPayload, 'del_depth' | 'del_max_depth' | 'exp' | 'iat'>;
  holder: Keypair;
  tools: Record<string, ToolConstraints>;
  issuedAt: number;
  expiresAt: number;
  jti?: string;
  /** Overrides for adversarial fixtures. */
  overrides?: Partial<AatPayload>;
  signWith?: CryptoKey;
  alg?: string;
}

export async function mintDerivedToken(input: MintDerivedInput): Promise<string> {
  const { calculateJwkThumbprintUri } = await import('jose');
  const issuer = await calculateJwkThumbprintUri(
    input.parentKey.publicJwk as Parameters<typeof calculateJwkThumbprintUri>[0],
  );

  const payload: AatPayload = {
    jti: input.jti ?? `derived-${input.issuedAt}-${input.parentPayload.del_depth + 1}`,
    iss: issuer,
    iat: input.issuedAt,
    exp: input.expiresAt,
    cnf: { jwk: input.holder.publicJwk },
    del_depth: input.parentPayload.del_depth + 1,
    del_max_depth: input.parentPayload.del_max_depth,
    par_hash: await parentHashOf(input.parentToken),
    authorization_details: [{ type: AAT_AUTHORIZATION_DETAIL_TYPE, tools: input.tools }],
    ...input.overrides,
  };

  return sign(payload, input.signWith ?? input.parentKey.privateKey, input.alg);
}

export interface MintPopInput {
  leafKey: Keypair;
  leafJti: string;
  tool: string;
  args: ToolArguments;
  issuedAt: number;
  jti?: string;
  overrides?: Partial<PopPayload>;
  signWith?: CryptoKey;
  alg?: string;
}

/** Mint a proof of possession. The payload is JCS-canonical before signing. */
export async function mintPop(input: MintPopInput): Promise<string> {
  const payload: PopPayload = {
    jti: input.jti ?? `pop-${input.issuedAt}`,
    iat: input.issuedAt,
    aat_id: input.leafJti,
    aat_tool: input.tool,
    hta: input.args,
    ...input.overrides,
  };
  const canonical = canonicalize(payload);
  if (canonical === undefined) throw new Error('PoP payload is not canonicalizable');
  const bytes = new TextEncoder().encode(canonical);
  return new CompactSign(bytes)
    .setProtectedHeader({ alg: input.alg ?? 'EdDSA' })
    .sign(input.signWith ?? input.leafKey.privateKey);
}
