// ─────────────────────────────────────────────────────────────────────────────
// Welcome carousel slides (japa#334): the agent slide is left out of a
// self-service-only build; flag off shows all three, in order.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from '@jest/globals';
import { ONBOARD, onboardSlides } from '../content';

describe('onboardSlides', () => {
  it('flag off: every slide, as today', () => {
    expect(onboardSlides(false)).toBe(ONBOARD);
    expect(onboardSlides(false).map((s) => s.id)).toEqual(['o1', 'o2', 'o3']);
  });

  it('flag on: no agent slide, the others in order', () => {
    const slides = onboardSlides(true);
    expect(slides.map((s) => s.id)).toEqual(['o1', 'o3']);
    for (const s of slides) {
      expect(`${s.kicker} ${s.title} ${s.body}`).not.toMatch(
        /agent|specialist|expert|consult|messag/i,
      );
    }
  });
});
