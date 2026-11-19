// The shared date picker (japa#407): a day pick commits and closes, the
// month/year selector leaves it open, the field toggles, Done commits the
// highlighted date clamped to min/max, only one calendar is open at a time
// (in a From/To pair and across fields), disabled fields never open, and
// Android commits on OK only.

// The native picker, as a plain host element whose props the tests drive.
jest.mock('@react-native-community/datetimepicker', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react') as typeof import('react');
  const Mock = (props: Record<string, unknown>) =>
    R.createElement('MockDateTimePicker', props);
  return { __esModule: true, default: Mock };
});

import React from 'react';
import { Platform, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  DateField,
  DateRangeField,
  clampToRange,
  isBrowseChange,
  useOpenDateField,
} from '@/components/explorer/DateField';

// ── Helpers ──────────────────────────────────────────────────────────────────

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

let tree: ReactTestRenderer;
function render(el: React.ReactElement) {
  act(() => {
    tree = create(el);
  });
  return tree;
}

/** Every mounted picker (host elements only). */
const pickers = () =>
  tree.root.findAll((n) => (n.type as unknown) === 'MockDateTimePicker');

/** Tap the element with this testID (the Pressable carries the id). */
function tap(id: string) {
  const node = tree.root.find(
    (n) => n.props.testID === id && typeof n.props.onPress === 'function',
  );
  act(() => node.props.onPress());
}

/** Fire the picker's onChange as the native side would. */
function change(type: 'set' | 'dismissed', date?: Date, index = 0) {
  const p = pickers()[index];
  act(() =>
    (p.props.onChange as (e: unknown, date?: Date) => void)(
      { type, nativeEvent: { timestamp: date?.getTime() } },
      date,
    ),
  );
}

const exists = (id: string) =>
  tree.root.findAll((n) => n.props.testID === id).length > 0;

beforeEach(() => {
  act(() => useOpenDateField.setState({ openKey: null }));
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
});

// ── Pure rules ───────────────────────────────────────────────────────────────

describe('isBrowseChange', () => {
  it('same day, other month or year = browsing', () => {
    expect(isBrowseChange(d(2027, 3, 12), d(2027, 5, 12))).toBe(true);
    expect(isBrowseChange(d(2027, 3, 12), d(2029, 3, 12))).toBe(true);
  });
  it('another day = picked', () => {
    expect(isBrowseChange(d(2027, 3, 12), d(2027, 3, 14))).toBe(false);
    expect(isBrowseChange(d(2027, 3, 31), d(2027, 4, 30))).toBe(false);
  });
});

describe('clampToRange', () => {
  it('keeps dates inside, moves dates outside to the nearest bound', () => {
    const min = d(2027, 1, 1);
    const max = d(2027, 12, 31);
    expect(clampToRange(d(2027, 6, 1), min, max)).toEqual(d(2027, 6, 1));
    expect(clampToRange(d(2026, 6, 1), min, max)).toEqual(min);
    expect(clampToRange(d(2028, 6, 1), min, max)).toEqual(max);
    expect(clampToRange(d(2028, 6, 1))).toEqual(d(2028, 6, 1));
  });
});

// ── iOS (jest-expo default platform) ─────────────────────────────────────────

describe('DateField on iOS', () => {
  it('renders a light, coral, inline calendar on opening', () => {
    render(
      <DateField
        testID="f"
        value={null}
        accessibilityLabel="Arrival"
        onChange={() => {}}
      />,
    );
    expect(pickers()).toHaveLength(0);
    tap('f');
    const p = pickers()[0];
    expect(p.props.themeVariant).toBe('light');
    expect(p.props.display).toBe('inline');
    expect(p.props.accentColor).toBe('#F4516C');
  });

  it('a day tap ("set") commits that date and closes', () => {
    const onChange = jest.fn();
    render(
      <DateField
        testID="f"
        value={d(2027, 3, 12)}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    change('set', d(2027, 3, 20));
    expect(onChange).toHaveBeenCalledWith(d(2027, 3, 20));
    expect(pickers()).toHaveLength(0);
  });

  it('the month/year selector (same day, other month) stays open and sets nothing', () => {
    const onChange = jest.fn();
    render(
      <DateField
        testID="f"
        value={d(2027, 3, 12)}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    change('set', d(2028, 7, 12));
    expect(onChange).not.toHaveBeenCalled();
    expect(pickers()).toHaveLength(1);
    // The calendar now shows the browsed month, and a day there is a pick.
    expect(pickers()[0].props.value).toEqual(d(2028, 7, 12));
    change('set', d(2028, 7, 3));
    expect(onChange).toHaveBeenCalledWith(d(2028, 7, 3));
    expect(pickers()).toHaveLength(0);
  });

  it('tapping the open field again closes it and changes nothing', () => {
    const onChange = jest.fn();
    render(
      <DateField
        testID="f"
        value={null}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    expect(pickers()).toHaveLength(1);
    tap('f');
    expect(pickers()).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Done commits the highlighted date and closes', () => {
    const onChange = jest.fn();
    render(
      <DateField
        testID="f"
        value={null}
        initialDate={d(2027, 5, 1)}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    const done = tree.root.find((n) => n.props.testID === 'f.done');
    expect(done.props.accessibilityLabel).toBe('Arrival, done');
    tap('f.done');
    expect(onChange).toHaveBeenCalledWith(d(2027, 5, 1));
    expect(pickers()).toHaveLength(0);
  });

  it('Done never sets a date outside min/max: it sets the nearest allowed one', () => {
    const onChange = jest.fn();
    const min = d(2027, 6, 1);
    render(
      <DateField
        testID="f"
        value={null}
        initialDate={d(2027, 1, 1)}
        minimumDate={min}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    tap('f.done');
    expect(onChange).toHaveBeenCalledWith(min);

    // And the same against the maximum (today is far past this one).
    onChange.mockClear();
    const max = d(2000, 1, 1);
    render(
      <DateField
        testID="g"
        value={null}
        maximumDate={max}
        accessibilityLabel="Expiry"
        onChange={onChange}
      />,
    );
    tap('g');
    tap('g.done');
    expect(onChange).toHaveBeenCalledWith(max);
  });

  it('a disabled field does not open', () => {
    render(
      <DateField
        testID="f"
        value={null}
        disabled
        accessibilityLabel="Arrival"
        onChange={() => {}}
      />,
    );
    tap('f');
    expect(pickers()).toHaveLength(0);
  });
});

describe('one calendar at a time', () => {
  function Range({ onFrom = () => {}, from = null as Date | null }) {
    return (
      <DateRangeField
        from={{
          testID: 'from',
          value: from,
          accessibilityLabel: 'Stay, from',
          innerLabel: 'From',
          onChange: onFrom,
        }}
        to={{
          testID: 'to',
          value: null,
          accessibilityLabel: 'Stay, to',
          innerLabel: 'To',
          minimumDate: from ?? undefined,
          initialDate: from ?? undefined,
          onChange: () => {},
        }}
      />
    );
  }

  it('opening To closes From, and the reverse', () => {
    render(<Range />);
    tap('from');
    expect(exists('from.calendar')).toBe(true);
    tap('to');
    expect(exists('from.calendar')).toBe(false);
    expect(exists('to.calendar')).toBe(true);
    expect(pickers()).toHaveLength(1);
    tap('from');
    expect(exists('to.calendar')).toBe(false);
    expect(pickers()).toHaveLength(1);
  });

  it('the calendar sits below the row, not inside a half-width column', () => {
    render(<Range />);
    tap('to');
    const cal = tree.root.find((n) => n.props.testID === 'to.calendar');
    const row = tree.root.find(
      (n) =>
        n.props.style?.flexDirection === 'row' &&
        n.findAll((c) => c.props.testID === 'from').length > 0,
    );
    // Not a descendant of the From/To row.
    expect(row.findAll((c) => c === cal)).toHaveLength(0);
  });

  it('To opens on the From date and cannot go before it', () => {
    render(<Range from={d(2027, 4, 10)} />);
    tap('to');
    const p = pickers()[0];
    expect(p.props.value).toEqual(d(2027, 4, 10));
    expect(p.props.minimumDate).toEqual(d(2027, 4, 10));
  });

  it('opening any other date field on the screen closes the open one', () => {
    render(
      <View>
        <Range />
        <DateField
          testID="other"
          value={null}
          accessibilityLabel="Departure"
          onChange={() => {}}
        />
      </View>,
    );
    tap('from');
    tap('other');
    expect(exists('from.calendar')).toBe(false);
    expect(exists('other.calendar')).toBe(true);
    expect(pickers()).toHaveLength(1);
  });
});

// ── Android: the system dialog, unchanged ────────────────────────────────────

describe('DateField on Android', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  it('OK sets the value and closes; there is no Done and no theme override', () => {
    const onChange = jest.fn();
    render(
      <DateField
        testID="f"
        value={null}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    expect(pickers()[0].props.display).toBe('default');
    expect(pickers()[0].props.themeVariant).toBeUndefined();
    expect(exists('f.done')).toBe(false);
    change('set', d(2027, 9, 9));
    expect(onChange).toHaveBeenCalledWith(d(2027, 9, 9));
    expect(pickers()).toHaveLength(0);
  });

  it('cancel closes and sets nothing', () => {
    const onChange = jest.fn();
    render(
      <DateField
        testID="f"
        value={null}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    change('dismissed');
    expect(onChange).not.toHaveBeenCalled();
    expect(pickers()).toHaveLength(0);
  });
});
