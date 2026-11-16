// ─────────────────────────────────────────────────────────────────────────────
// profileLogic (japa#346): Profile row values. Unknown → "–", never a number.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from '@jest/globals';
import {
  UNKNOWN_VALUE,
  fileCountLabel,
  paidCount,
  paidLabel,
  planNameLabel,
} from '../profileLogic';
import type { ApiTransaction } from '@/hooks/useTransactions';

const tx = (
  status: ApiTransaction['status'],
  type: ApiTransaction['type'] = 'consultation_fee',
) => ({ status, type });

describe('fileCountLabel', () => {
  it('0 files / 1 file / N files', () => {
    expect(fileCountLabel(0)).toBe('0 files');
    expect(fileCountLabel(1)).toBe('1 file');
    expect(fileCountLabel(7)).toBe('7 files');
  });
  it('unknown → en dash', () => {
    expect(UNKNOWN_VALUE).toBe('–');
    expect(fileCountLabel(null)).toBe('–');
    expect(fileCountLabel(undefined)).toBe('–');
  });
});

describe('paidCount / paidLabel', () => {
  it('counts completed and released only', () => {
    const rows = [
      tx('completed'),
      tx('released'),
      tx('failed'),
      tx('refunded'),
      tx('pending'),
      tx('processing'),
      tx('held_in_escrow'),
      tx('completed'),
    ];
    expect(paidCount(rows)).toBe(3);
    expect(paidLabel(rows)).toBe('3 paid');
  });
  it('failed and refunded are not counted', () => {
    expect(paidLabel([tx('failed'), tx('refunded')])).toBe('0 paid');
  });
  it('a refund row is never a payment, even when completed or released', () => {
    expect(
      paidLabel([
        tx('completed', 'refund'),
        tx('released', 'refund'),
        tx('completed', 'service_fee'),
      ]),
    ).toBe('1 paid');
  });
  it('none → "0 paid"; loading / error → "–"', () => {
    expect(paidLabel([])).toBe('0 paid');
    expect(paidLabel(undefined)).toBe('–');
    expect(paidLabel(null)).toBe('–');
  });
  it('never shows a money amount', () => {
    expect(paidLabel([tx('completed')])).not.toMatch(/[₦$]|\d{2,}/);
  });
});

describe('planNameLabel', () => {
  it('the name, or "–" while unknown', () => {
    expect(planNameLabel('Client Free')).toBe('Client Free');
    expect(planNameLabel(undefined)).toBe('–');
  });
});
