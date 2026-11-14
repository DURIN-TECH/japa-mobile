// japa#255: the visa breakdown sections. Logic (what shows, wording, hiding of
// empty fields) and rendering (sections vanish, link opens the official URL).

import React from 'react';
import { Linking } from 'react-native';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest, afterEach } from '@jest/globals';
import {
  costTimelineRows,
  eligibilityItems,
  officialSource,
  processingText,
} from '../visaBreakdownLogic';
import {
  CostTimelineSection,
  EligibilitySection,
  OfficialSourceSection,
} from '../VisaBreakdownSections';
import type { VisaType } from '@/types/visas.type';

// A visa with every optional field empty ("bare").
const bare = {
  id: 'v1',
  countryCode: 'gb',
  name: 'Visa',
  processingTime: '',
  processingDaysMin: 0,
  processingDaysMax: 0,
  baseCostUsd: 0,
  validityPeriod: '',
  eligibilityCriteria: [],
} as unknown as VisaType;
const visa = (o: Partial<VisaType> = {}): VisaType => ({ ...bare, ...o });

// Flatten all rendered text of a tree.
const texts = (r: ReturnType<typeof create>) =>
  r.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => [n.props.children].flat().join(''));

describe('processingText', () => {
  it('range, equal, and free-text fallback', () => {
    expect(
      processingText(visa({ processingDaysMin: 30, processingDaysMax: 60 })),
    ).toBe('30 to 60 days');
    expect(
      processingText(visa({ processingDaysMin: 30, processingDaysMax: 30 })),
    ).toBe('30 days');
    expect(
      processingText(
        visa({
          processingDaysMin: 30,
          processingDaysMax: 0,
          processingTime: '4 weeks',
        }),
      ),
    ).toBe('4 weeks');
    expect(processingText(visa())).toBe('');
  });
});

describe('costTimelineRows', () => {
  it('is empty for a bare visa', () => {
    expect(costTimelineRows(visa())).toEqual([]);
  });

  it('builds all four rows with the spec wording', () => {
    const rows = costTimelineRows(
      visa({
        baseCostUsd: 1200,
        processingDaysMin: 30,
        processingDaysMax: 60,
        validityPeriod: '2 years',
        isExtendable: true,
        maxExtensions: 2,
      }),
    );
    expect(rows.map((r) => [r.label, r.value, r.hint])).toEqual([
      ['Visa cost', '$1,200', undefined],
      ['Processing time', '30 to 60 days', undefined],
      ['Valid for', '2 years', undefined],
      ['Extension', 'Can be extended', 'Up to 2 times'],
    ]);
  });

  it('singular hint, no hint without a number, and not extendable', () => {
    const ext = (o: Partial<VisaType>) =>
      costTimelineRows(visa(o)).find((r) => r.key === 'extension');
    expect(ext({ isExtendable: true, maxExtensions: 1 })?.hint).toBe(
      'Up to 1 time',
    );
    expect(ext({ isExtendable: true })?.hint).toBeUndefined();
    expect(ext({ isExtendable: false, maxExtensions: 3 })).toMatchObject({
      value: 'Can’t be extended',
      hint: undefined,
    });
    expect(ext({})).toBeUndefined(); // flag missing -> row hidden
  });

  it('skips Processing when it repeats the stat strip', () => {
    const v = visa({ processingTime: '4 weeks', baseCostUsd: 50 });
    expect(costTimelineRows(v, '4 weeks').map((r) => r.key)).toEqual(['cost']);
    expect(costTimelineRows(v, '—').map((r) => r.key)).toEqual([
      'cost',
      'processing',
    ]);
  });
});

describe('eligibilityItems / officialSource', () => {
  it('drops blank criteria', () => {
    expect(
      eligibilityItems(visa({ eligibilityCriteria: [' Age 18+ ', '', '  '] })),
    ).toEqual(['Age 18+']);
    expect(eligibilityItems(visa({ eligibilityCriteria: undefined }))).toEqual(
      [],
    );
  });

  it('needs a URL; instructions alone are not shown', () => {
    expect(
      officialSource(visa({ applicationInstructions: 'Apply online' })),
    ).toBeNull();
    expect(officialSource(visa({ applicationUrl: '  ' }))).toBeNull();
    expect(
      officialSource(
        visa({
          applicationUrl: 'https://x.gov',
          applicationInstructions: ' Apply ',
        }),
      ),
    ).toEqual({ url: 'https://x.gov', instructions: 'Apply' });
  });
});

describe('sections', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('render nothing when empty', () => {
    for (const el of [
      <CostTimelineSection key="a" visa={visa()} />,
      <EligibilitySection key="b" visa={visa()} />,
      <OfficialSourceSection key="c" visa={visa()} />,
    ]) {
      let r!: ReturnType<typeof create>;
      act(() => {
        r = create(el);
      });
      expect(r.toJSON()).toBeNull();
    }
  });

  it('render their titles and content, never "undefined"', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(
        <>
          <CostTimelineSection visa={visa({ baseCostUsd: 99 })} />
          <EligibilitySection visa={visa({ eligibilityCriteria: ['Be 18'] })} />
        </>,
      );
    });
    const t = texts(r);
    expect(t).toEqual(
      expect.arrayContaining([
        'Cost & timeline',
        'Visa cost',
        '$99',
        'Eligibility',
        'Be 18',
      ]),
    );
    expect(t.join('|')).not.toContain('undefined');
  });

  it('official link opens the URL and swallows a failure', async () => {
    const open = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValue(new Error('no handler') as never);
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(
        <OfficialSourceSection
          visa={visa({
            applicationUrl: 'https://x.gov',
            applicationInstructions: 'Apply online',
          })}
        />,
      );
    });
    expect(texts(r)).toEqual(
      expect.arrayContaining([
        'Official source',
        'Official application page',
        'Apply online',
      ]),
    );
    const btn = r.root.findByProps({ accessibilityRole: 'link' });
    await act(async () => {
      await btn.props.onPress();
    });
    expect(open).toHaveBeenCalledWith('https://x.gov');
  });
});
