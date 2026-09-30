import { ASK_AGAIN_AFTER_MS, shouldAskForNotifications } from './prompt-rules';

describe('shouldAskForNotifications', () => {
  const now = Date.parse('2026-10-01T12:00:00.000Z');

  it('asks someone who has never been asked', () => {
    expect(shouldAskForNotifications(null, now)).toBe(true);
  });

  it('waits a week after “Not now”', () => {
    expect(shouldAskForNotifications(new Date(now - ASK_AGAIN_AFTER_MS + 60_000).toISOString(), now)).toBe(false);
    expect(shouldAskForNotifications(new Date(now - ASK_AGAIN_AFTER_MS).toISOString(), now)).toBe(true);
  });
});
