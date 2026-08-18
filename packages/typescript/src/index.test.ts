import { describe, expect, it } from 'vitest';

import { isSupportedSpecVersion, OAAF_SPEC_VERSION } from './index.js';

describe('spec version', () => {
  it('targets spec 0.1', () => {
    expect(OAAF_SPEC_VERSION).toBe('0.1');
  });

  it('accepts the version it targets', () => {
    expect(isSupportedSpecVersion(OAAF_SPEC_VERSION)).toBe(true);
  });

  it('fails closed on unknown versions', () => {
    for (const value of ['0.2', '1.0', '', 'latest', '0.1.0']) {
      expect(isSupportedSpecVersion(value)).toBe(false);
    }
  });
});
