import { LOCK_AFTER_MS, shouldLockOnReturn } from './lock';

describe('shouldLockOnReturn', () => {
  it('stays unlocked after a quick trip away', () => {
    expect(shouldLockOnReturn(1_000, 1_000 + LOCK_AFTER_MS - 1)).toBe(false);
  });

  it('locks after 30 seconds away', () => {
    expect(shouldLockOnReturn(1_000, 1_000 + LOCK_AFTER_MS)).toBe(true);
  });

  it('ignores returns that never went to the background', () => {
    expect(shouldLockOnReturn(null, 99_999_999)).toBe(false);
  });
});
