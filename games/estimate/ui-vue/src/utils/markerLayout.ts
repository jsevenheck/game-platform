export const MARKER_MAX_WIDTH_PX = 104;
export const MARKER_GUTTER_PX = 4;

export function markerWidthForContainer(containerWidth: number): number {
  return Math.min(MARKER_MAX_WIDTH_PX, Math.max(1, containerWidth - MARKER_GUTTER_PX * 2));
}

export function clampMarkerX(rawX: number, containerWidth: number): number {
  const width = Math.max(containerWidth, 1);
  const markerWidth = markerWidthForContainer(width);
  const edgeFraction = Math.min(0.5, (markerWidth / 2 + MARKER_GUTTER_PX) / width);
  return Math.min(1 - edgeFraction, Math.max(edgeFraction, rawX));
}

export function projectMarkerValue(
  value: number,
  lo: number,
  hi: number,
  containerWidth: number
): number {
  const span = Math.max(hi - lo, Number.EPSILON);
  const normalized = (value - lo) / span;
  return clampMarkerX(normalized, containerWidth);
}

export function assignMarkerLanes(sortedXs: number[], containerWidth: number): number[] {
  const minimumSeparation = markerWidthForContainer(containerWidth) / Math.max(containerWidth, 1);
  const laneLastX: number[] = [];

  return sortedXs.map((x) => {
    let lane = laneLastX.findIndex((lastX) => x - lastX >= minimumSeparation);
    if (lane === -1) lane = laneLastX.length;
    laneLastX[lane] = x;
    return lane;
  });
}
