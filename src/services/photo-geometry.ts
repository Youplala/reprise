const MIN_VALID_ASPECT_RATIO = 0.1;
const MAX_VALID_ASPECT_RATIO = 10;

export function comparisonDimensionsForAspectRatio(
  availableWidth: number,
  aspectRatio: number,
  maxHeight: number,
  fallbackHeight = 280,
) {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    return { width: Math.max(0, availableWidth), height: fallbackHeight };
  }

  if (
    !Number.isFinite(aspectRatio) ||
    aspectRatio < MIN_VALID_ASPECT_RATIO ||
    aspectRatio > MAX_VALID_ASPECT_RATIO
  ) {
    return { width: availableWidth, height: fallbackHeight };
  }

  const naturalHeight = availableWidth / aspectRatio;
  if (!Number.isFinite(maxHeight) || maxHeight <= 0 || naturalHeight <= maxHeight) {
    return { width: availableWidth, height: naturalHeight };
  }

  return { width: maxHeight * aspectRatio, height: maxHeight };
}
