import type { ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';

import { BHVP_PREVIEWS_ENABLED, loadBhvpImages } from '@/services/bhvp-images';

export function useBhvpImages(
  archiveLinks: readonly string[] | undefined,
  limit = Number.POSITIVE_INFINITY,
) {
  const linksKey = archiveLinks?.join('|') ?? '';
  const [result, setResult] = useState<{ key: string; images: ImageSource[] }>({
    key: '',
    images: [],
  });

  useEffect(() => {
    let cancelled = false;
    const links = linksKey ? linksKey.split('|') : [];

    if (!BHVP_PREVIEWS_ENABLED || links.length === 0) return;

    void loadBhvpImages(links, limit).then((nextImages) => {
      if (cancelled) return;
      setResult({ key: linksKey, images: nextImages });
    });

    return () => {
      cancelled = true;
    };
  }, [limit, linksKey]);

  const isCurrent = result.key === linksKey;
  return {
    images: isCurrent ? result.images : [],
    loading: BHVP_PREVIEWS_ENABLED && linksKey.length > 0 && !isCurrent,
  };
}
