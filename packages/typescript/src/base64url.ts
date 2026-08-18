/**
 * base64url helpers.
 *
 * Uses only web-platform primitives so the SDK runs unchanged in Node, in
 * workers, and at the edge — enforcement points are not always Node processes.
 */

const BASE64URL_ALPHABET = /^[A-Za-z0-9_-]*$/;

/** Encode bytes as base64url without padding. */
export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode base64url to bytes. Returns null on malformed input rather than throwing. */
export function decodeBase64Url(value: string): Uint8Array | null {
  if (!BASE64URL_ALPHABET.test(value)) return null;
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** SHA-256 of a UTF-8 string, as base64url without padding. */
export async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return encodeBase64Url(new Uint8Array(digest));
}
