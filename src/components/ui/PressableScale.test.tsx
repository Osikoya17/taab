/**
 * Regression test: NativeWind classes must reach the native view that
 * PressableScale renders (buttons and cards were rendering without their
 * background/border on devices).
 */
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { registerCSS, setupAllComponents } from 'react-native-css-interop/dist/test';

import { PressableScale } from './PressableScale';

jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));

beforeAll(() => {
  setupAllComponents();
  registerCSS(`
    .bg-ink { background-color: #111111; }
    .rounded-button { border-radius: 20px; }
    .p-4 { padding: 16px; }
    .opacity-40 { opacity: 0.4; }
  `);
});

function flatten(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return style as Record<string, unknown>;
}

describe('PressableScale', () => {
  it('applies className styles to the pressable surface', async () => {
    await render(
      <PressableScale testID="surface" className="bg-ink rounded-button p-4" onPress={() => undefined}>
        <Text>Sign in</Text>
      </PressableScale>,
    );
    const style = flatten(screen.getByTestId('surface').props.style);
    expect(style).toMatchObject({ backgroundColor: '#111111', borderRadius: 20, padding: 16 });
  });

  it('keeps an explicit style alongside classes', async () => {
    await render(
      <PressableScale testID="surface" className="bg-ink" style={{ width: 44 }} onPress={() => undefined}>
        <Text>Bell</Text>
      </PressableScale>,
    );
    const style = flatten(screen.getByTestId('surface').props.style);
    expect(style).toMatchObject({ backgroundColor: '#111111', width: 44 });
  });

  it('drops styles from classes that are removed on re-render', async () => {
    const button = (disabled: boolean) => (
      <PressableScale testID="surface" className={disabled ? 'bg-ink opacity-40' : 'bg-ink'} onPress={() => undefined}>
        <Text>Save</Text>
      </PressableScale>
    );
    await render(button(true));
    expect(flatten(screen.getByTestId('surface').props.style).opacity).toBeCloseTo(0.4);
    await screen.rerender(button(false));
    const style = flatten(screen.getByTestId('surface').props.style);
    expect(style.opacity).toBeUndefined();
    expect(style).toMatchObject({ backgroundColor: '#111111' });
  });
});
