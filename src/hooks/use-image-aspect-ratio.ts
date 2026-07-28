import { Image, type ImageSource } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';

export type PhotoSource = ImageSource | string | number;
export type PhotoOrientation = 'portrait' | 'square' | 'landscape';

const aspectRatioCache = new Map<string, number>();

function sourceKey(source?: PhotoSource) {
  if (source === undefined) return 'missing';
  if (typeof source === 'number') return `asset:${source}`;
  if (typeof source === 'string') return source;
  return source.uri ?? `inline:${source.width ?? 0}x${source.height ?? 0}`;
}

function ratioFromSource(source?: PhotoSource) {
  if (
    source &&
    typeof source === 'object' &&
    source.width &&
    source.height &&
    source.width > 0 &&
    source.height > 0
  ) {
    return source.width / source.height;
  }
  return undefined;
}

export function photoOrientation(aspectRatio: number): PhotoOrientation {
  if (aspectRatio < 0.88) return 'portrait';
  if (aspectRatio > 1.14) return 'landscape';
  return 'square';
}

export function useImageAspectRatio(
  source?: PhotoSource,
  fallbackAspectRatio = 4 / 3,
) {
  const key = sourceKey(source);
  const knownRatio = ratioFromSource(source) ?? aspectRatioCache.get(key);
  const [loadedRatio, setLoadedRatio] = useState<{
    key: string;
    value: number;
  }>({
    key,
    value: knownRatio ?? fallbackAspectRatio,
  });

  useEffect(() => {
    if (knownRatio || !source) return;

    let active = true;
    Image.loadAsync(source)
      .then((image) => {
        if (!active || image.width <= 0 || image.height <= 0) return;
        const nextRatio = image.width / image.height;
        aspectRatioCache.set(key, nextRatio);
        setLoadedRatio({ key, value: nextRatio });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [key, knownRatio, source]);

  const aspectRatio =
    knownRatio ?? (loadedRatio.key === key ? loadedRatio.value : fallbackAspectRatio);

  return useMemo(
    () => ({
      aspectRatio,
      orientation: photoOrientation(aspectRatio),
    }),
    [aspectRatio],
  );
}
