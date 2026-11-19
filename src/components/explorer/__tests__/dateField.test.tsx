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
import { DateAnswerInput } from '@/components/explorer/AnswerInputs';

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
    // A day in another month that is not its last day, nor a bound.
    expect(isBrowseChange(d(2027, 3, 31), d(2027, 4, 28))).toBe(false);
    expect(isBrowseChange(d(2027, 1, 31), d(2027, 3, 28))).toBe(false);
  });

  // iOS moves the day itself when the new month is shorter (japa#407 review).
  it('31 Jan → Feb (iOS gives 28 Feb) = browsing', () => {
    expect(isBrowseChange(d(2027, 1, 31), d(2027, 2, 28))).toBe(true);
  });
  it('30 Jan → Feb in a leap year (iOS gives 29 Feb) = browsing', () => {
    expect(isBrowseChange(d(2028, 1, 30), d(2028, 2, 29))).toBe(true);
  });
  it('the last day of a month that is LATER in the month is a pick', () => {
    // 12 Mar → 30 Apr: iOS would have kept the 12th, so a tap moved it.
    expect(isBrowseChange(d(2027, 3, 12), d(2027, 4, 30))).toBe(false);
  });

  // iOS clamps to min/max when the selector goes past a bound.
  it('the selector clamped at the minimum = browsing', () => {
    const min = d(2027, 6, 15);
    expect(isBrowseChange(d(2027, 3, 20), min, min)).toBe(true);
    // Same calendar day with a time of day still counts.
    expect(
      isBrowseChange(d(2027, 3, 20), new Date(2027, 5, 15, 9, 30), min),
    ).toBe(true);
  });
  it('the selector clamped at the maximum = browsing', () => {
    const max = d(2027, 9, 10);
    expect(isBrowseChange(d(2027, 6, 20), max, undefined, max)).toBe(true);
  });
  it('tapping the min/max day in the SAME month is a pick', () => {
    const min = d(2027, 6, 15);
    expect(isBrowseChange(d(2027, 6, 20), min, min)).toBe(false);
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

  it('31 Jan → Feb via the selector saves nothing, stays open on 28 Feb; Done sets it', () => {
    const onChange = jest.fn();
    render(
      <DateField
        testID="f"
        value={d(2027, 1, 31)}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    change('set', d(2027, 2, 28));
    expect(onChange).not.toHaveBeenCalled();
    expect(pickers()).toHaveLength(1);
    expect(pickers()[0].props.value).toEqual(d(2027, 2, 28));
    tap('f.done');
    expect(onChange).toHaveBeenCalledWith(d(2027, 2, 28));
    expect(pickers()).toHaveLength(0);
  });

  it('after browsing with the arrows, a tap on the 28th of another month is a pick', () => {
    const onChange = jest.fn();
    render(
      <DateField
        testID="f"
        value={d(2027, 1, 31)}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    // The arrows page to March (no event), then the 28th is tapped.
    change('set', d(2027, 3, 28));
    expect(onChange).toHaveBeenCalledWith(d(2027, 3, 28));
    expect(pickers()).toHaveLength(0);
  });

  it('after the selector moved to 28 Feb, a tap on another Feb day is a pick', () => {
    const onChange = jest.fn();
    render(
      <DateField
        testID="f"
        value={d(2027, 1, 31)}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    change('set', d(2027, 2, 28)); // selector → Feb (browse)
    change('set', d(2027, 2, 10));
    expect(onChange).toHaveBeenCalledWith(d(2027, 2, 10));
    expect(pickers()).toHaveLength(0);
  });

  it('the selector clamped to min or max saves nothing and stays open', () => {
    const onChange = jest.fn();
    const min = d(2027, 6, 15);
    const max = d(2027, 9, 10);
    render(
      <DateField
        testID="f"
        value={d(2027, 7, 20)}
        minimumDate={min}
        maximumDate={max}
        accessibilityLabel="Arrival"
        onChange={onChange}
      />,
    );
    tap('f');
    change('set', max); // selector → Sep 20, clamped to 10 Sep
    expect(pickers()).toHaveLength(1);
    change('set', min); // selector → Mar/Apr/May, clamped to 15 Jun
    expect(pickers()).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(pickers()[0].props.value).toEqual(min);
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

  it('Done never sets a date before the minimum: it sets the minimum', () => {
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
  });

  it('Done never sets a date after the maximum: it sets the maximum', () => {
    // Today is far past this maximum.
    const onChange = jest.fn();
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

  it('a field that becomes disabled while open closes and clears the open key', () => {
    const el = (disabled: boolean) => (
      <DateField
        testID="f"
        value={null}
        disabled={disabled}
        accessibilityLabel="Arrival"
        onChange={() => {}}
      />
    );
    render(el(false));
    tap('f');
    expect(pickers()).toHaveLength(1);
    act(() => tree.update(el(true)));
    expect(pickers()).toHaveLength(0);
    expect(useOpenDateField.getState().openKey).toBeNull();
  });

  it('a field that unmounts while open leaves no stale open key', () => {
    function Screen({ show }: { show: boolean }) {
      return show ? (
        <DateField
          testID="f"
          value={null}
          accessibilityLabel="Arrival"
          onChange={() => {}}
        />
      ) : null;
    }
    render(<Screen show />);
    tap('f');
    expect(useOpenDateField.getState().openKey).not.toBeNull();
    act(() => tree.update(<Screen show={false} />));
    expect(useOpenDateField.getState().openKey).toBeNull();
  });
});

// ── A call site: the requirement answer stores an ISO date ───────────────────

describe('DateAnswerInput', () => {
  it('turns a day pick into a local yyyy-MM-dd string and shows the saved one', () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    render(
      <DateAnswerInput
        title="Date of birth"
        editable
        form="2027-03-12"
        onChange={onChange}
        onCommit={onCommit}
      />,
    );
    const field = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('Date of birth'),
    );
    // The stored ISO string is read as that local day.
    expect(field.props.accessibilityLabel).toBe('Date of birth, 12 Mar 2027');
    act(() => field.props.onPress());
    expect(pickers()[0].props.value).toEqual(d(2027, 3, 12));
    change('set', d(2027, 3, 20));
    expect(onChange).toHaveBeenCalledWith('2027-03-20');
    expect(onCommit).toHaveBeenCalledWith('date');
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
