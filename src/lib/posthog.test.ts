const mockCapture = jest.fn();
const mockLog = jest.fn();
jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn(() => ({ capture: mockCapture, logger: { info: mockLog } })),
}));

const originalToken = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
const originalHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;
beforeEach(() => {
  jest.resetModules();
  mockCapture.mockReset();
  mockLog.mockReset();
  delete process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
  delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
});
afterAll(() => {
  if (originalToken === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
  else process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN = originalToken;
  if (originalHost === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
  else process.env.EXPO_PUBLIC_POSTHOG_HOST = originalHost;
});

it('starts without optional analytics configuration', async () => {
  const { posthog, captureEvent } = jest.requireActual<typeof import('./posthog')>('./posthog');
  expect(posthog).toBeUndefined();
  expect(() => captureEvent('expense_created')).not.toThrow();
});

it.each([
  ['phc_your_project_token_here', 'https://us.i.posthog.com'],
  ['test_token', ''],
  ['test_token', 'not a URL'],
  ['test_token', 'file:///tmp/events'],
])('disables analytics for incomplete or invalid settings (%s, %s)', async (token, host) => {
  process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN = token;
  process.env.EXPO_PUBLIC_POSTHOG_HOST = host;
  expect(jest.requireActual<typeof import('./posthog')>('./posthog').posthog).toBeUndefined();
});

it('keeps configured analytics and prevents telemetry failures from failing saves', async () => {
  process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN = 'test_token';
  process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://analytics.example.com';
  const { posthog, captureEvent } = jest.requireActual<typeof import('./posthog')>('./posthog');
  expect(posthog).toBeDefined();
  captureEvent('expense_created', { currency: 'NGN' });
  expect(mockCapture).toHaveBeenCalledWith('expense_created', { currency: 'NGN' });
  mockCapture.mockImplementation(() => { throw new Error('analytics unavailable'); });
  expect(() => captureEvent('expense_created')).not.toThrow();
  const { posthogLog } = jest.requireActual<typeof import('./posthog-logs')>('./posthog-logs');
  mockLog.mockImplementation(() => { throw new Error('logging unavailable'); });
  expect(() => posthogLog.info('Saved')).not.toThrow();
});
