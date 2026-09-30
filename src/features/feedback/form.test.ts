import { feedbackUrl, platformLabel } from './form';

const PREFILLED = 'https://docs.google.com/forms/d/e/abc/viewform?usp=pp_url&entry.111=Android+app&entry.222=APP_VERSION';

describe('feedback form link', () => {
  it('fills in the platform and app version', () => {
    expect(feedbackUrl(PREFILLED, { platform: 'iPhone app', version: '1.0.0 (build 12)' })).toBe(
      'https://docs.google.com/forms/d/e/abc/viewform?usp=pp_url&entry.111=iPhone%20app&entry.222=1.0.0%20(build%2012)',
    );
  });

  it('accepts %20 in the placeholder too', () => {
    const url = PREFILLED.replace('Android+app', 'Android%20app');
    expect(feedbackUrl(url, { platform: 'Website', version: '1.0.0' })).toContain('entry.111=Website');
  });

  it('is hidden until a form is set', () => {
    expect(feedbackUrl('', { platform: 'Website', version: '1.0.0' })).toBeNull();
  });

  it('names the platform', () => {
    expect([platformLabel('android'), platformLabel('ios'), platformLabel('web')]).toEqual(['Android app', 'iPhone app', 'Website']);
  });
});
