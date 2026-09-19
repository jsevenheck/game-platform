import { describe, expect, it } from 'vitest';
import {
  assignMarkerLanes,
  markerWidthForContainer,
  projectMarkerValue,
} from '../ui-vue/src/utils/markerLayout';

describe('Estimate marker layout', () => {
  it.each([160, 320])('keeps endpoint labels inside a %dpx container', (containerWidth) => {
    const markerWidth = markerWidthForContainer(containerWidth);
    const left = projectMarkerValue(0, 0, 100, containerWidth) * containerWidth;
    const right = projectMarkerValue(100, 0, 100, containerWidth) * containerWidth;

    expect(left - markerWidth / 2).toBeGreaterThanOrEqual(4);
    expect(right + markerWidth / 2).toBeLessThanOrEqual(containerWidth - 4);
  });

  it('places twelve identical markers in separate lanes at 320px and 200% zoom', () => {
    const effectiveCssWidth = 160;
    const positions = Array.from({ length: 12 }, () =>
      projectMarkerValue(50, 0, 100, effectiveCssWidth)
    );
    const lanes = assignMarkerLanes(positions, effectiveCssWidth);

    expect(new Set(lanes).size).toBe(12);
  });

  it('never reuses a lane until labels have enough horizontal separation', () => {
    const containerWidth = 320;
    const positions = [0, 8, 16, 50, 58, 100]
      .map((value) => projectMarkerValue(value, 0, 100, containerWidth))
      .sort((a, b) => a - b);
    const lanes = assignMarkerLanes(positions, containerWidth);
    const minimumSeparation = markerWidthForContainer(containerWidth) / containerWidth;

    for (let left = 0; left < positions.length; left += 1) {
      for (let right = left + 1; right < positions.length; right += 1) {
        if (lanes[left] === lanes[right]) {
          expect(positions[right]! - positions[left]!).toBeGreaterThanOrEqual(minimumSeparation);
        }
      }
    }
  });
});
