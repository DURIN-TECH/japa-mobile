// Render test of the #256 checklist cards: group cards, rows, the Upload button
// replacing the Waiting pill, the collapsed "Official requirement" and the
// removed reason / source strings.

jest.mock('expo-router', () => ({ useFocusEffect: () => {} }));
jest.mock('expo-secure-store', () => ({}));
// primitives.tsx pulls in reanimated, whose native part is absent under jest.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'View', createAnimatedComponent: (c: unknown) => c },
  useAnimatedStyle: () => ({}),
  useSharedValue: (v: unknown) => ({ value: v }),
  withTiming: (v: unknown) => v,
  Easing: { bezier: () => ({}) },
}));
jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn(), put: jest.fn() },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';
import { Linking } from 'react-native';
import { DocumentChecklist } from '@/components/explorer/DocumentChecklist';
import type { Checklist, ChecklistItem } from '@/types/checklist.type';

const item = (over: Partial<ChecklistItem> = {}): ChecklistItem => ({
  checklistItemId: 'i1',
  title: 'bank statement',
  holder: 'applicant',
  required: true,
  reason: 'A REASON LINE',
  citation: { quote: 'Six months of statements', url: 'https://example.gov' },
  documentRequestId: 'r1',
  status: 'pending',
  current: true,
  ...over,
});
const checklist = (items: ChecklistItem[]): Checklist => ({
  state: 'ready',
  rubricVersion: 1,
  items,
});
const checksProps = {
  checksLoading: false,
  checksError: false,
  onReloadChecks: () => {},
  onRetryCheck: () => {},
  retryingDocId: null,
};

async function render(items: ChecklistItem[], onUpload = jest.fn()) {
  let r!: ReturnType<typeof create>;
  await act(async () => {
    r = create(
      <DocumentChecklist
        checklist={checklist(items)}
        loading={false}
        error={false}
        onRetry={() => {}}
        docs={[]}
        uploadingId={null}
        onUpload={onUpload}
        checksProps={checksProps}
      />,
    );
  });
  return { r, onUpload };
}
const texts = (r: ReturnType<typeof create>) => JSON.stringify(r.toJSON());

describe('DocumentChecklist cards', () => {
  it('shows a group card, a status line and an Upload button, no Waiting pill', async () => {
    const { r } = await render([item()]);
    const t = texts(r);
    expect(t).toContain('Your documents');
    expect(t).toContain('Upload each one here.');
    expect(t).toContain('0 of 1 done');
    expect(t).toContain('Required · Not uploaded');
    expect(t).toContain('Upload');
    expect(t).not.toContain('Waiting');
  });

  it('does not render the reason line or the old source strings', async () => {
    const { r } = await render([item()]);
    const t = texts(r);
    expect(t).not.toContain('A REASON LINE');
    expect(t).not.toContain('Where this comes from');
    expect(t).not.toContain('Show source');
    expect(t).toContain('Official requirement');
  });

  it('Official requirement is collapsed, opens on press, and links out', async () => {
    const open = jest
      .spyOn(Linking, 'openURL')
      .mockImplementation(() => Promise.resolve(true));
    const { r } = await render([item()]);
    expect(texts(r)).not.toContain('Six months of statements');
    const btn = r.root.findByProps({
      accessibilityLabel: 'Official requirement for bank statement',
    });
    await act(async () => btn.props.onPress());
    expect(texts(r)).toContain('Six months of statements');
    const link = r.root.findByProps({ accessibilityRole: 'link' });
    await act(async () => link.props.onPress());
    expect(open).toHaveBeenCalledWith('https://example.gov');
  });

  it('omits the link row when the citation has no url', async () => {
    const { r } = await render([
      item({ citation: { quote: 'Q', url: '' } as never }),
    ]);
    await act(async () =>
      r.root
        .findByProps({
          accessibilityLabel: 'Official requirement for bank statement',
        })
        .props.onPress(),
    );
    expect(r.root.findAllByProps({ accessibilityRole: 'link' })).toHaveLength(
      0,
    );
  });

  it('the Upload button calls onUpload with the item', async () => {
    const { r, onUpload } = await render([item()]);
    const upload = r.root.findByProps({
      accessibilityLabel: 'Upload bank statement',
    });
    await act(async () => upload.props.onPress());
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('a waived item says Not needed and has no upload', async () => {
    const { r } = await render([item({ status: 'waived' })]);
    const t = texts(r);
    expect(t).toContain('Not needed');
    expect(t).not.toContain('Required · ');
    expect(t).not.toContain('"Upload"');
  });

  it('the count leaves out items that are no longer current', async () => {
    const { r } = await render([
      item(),
      item({ checklistItemId: 'i2', current: false }),
    ]);
    expect(texts(r)).toContain('0 of 1 done');
  });
});
