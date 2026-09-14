import type { ImageSource } from 'expo-image';

type HistoricalReferenceInput = {
  images: readonly ImageSource[];
  requestedFrame: number;
  referenceImage?: ImageSource;
  recaptureImage?: ImageSource;
};

type HistoricalReference = {
  frameIndex: number;
  image?: ImageSource;
};

export function referenceUriOf(source?: ImageSource) {
  return typeof source === 'object' && source && 'uri' in source && typeof source.uri === 'string'
    ? source.uri
    : undefined;
}

function sameImage(left?: ImageSource, right?: ImageSource) {
  if (left === right) return true;
  const leftUri = referenceUriOf(left);
  return Boolean(leftUri && leftUri === referenceUriOf(right));
}

export function validatedHistoricalReferenceUri({
  candidateUri,
  images,
  referenceImage,
  recaptureImage,
}: Omit<HistoricalReferenceInput, 'requestedFrame'> & { candidateUri?: string }) {
  if (!candidateUri) return undefined;
  const candidates = referenceImage ? [referenceImage, ...images] : images;
  return candidates.some(
    (image) => referenceUriOf(image) === candidateUri && !sameImage(image, recaptureImage),
  )
    ? candidateUri
    : undefined;
}

export function historicalReferenceForFrame({
  images,
  requestedFrame,
  referenceImage,
  recaptureImage,
}: HistoricalReferenceInput): HistoricalReference {
  const safeRequestedFrame = Number.isInteger(requestedFrame) && requestedFrame >= 0
    ? requestedFrame
    : 0;

  const historicalReferenceImage = sameImage(referenceImage, recaptureImage)
    ? undefined
    : referenceImage;

  if (images.length === 0) {
    return historicalReferenceImage
      ? { frameIndex: 0, image: historicalReferenceImage }
      : { frameIndex: safeRequestedFrame, image: undefined };
  }

  const selectedIndex = Math.min(images.length - 1, safeRequestedFrame);
  const selectedImage = images[selectedIndex];
  if (!sameImage(selectedImage, recaptureImage)) {
    return { frameIndex: selectedIndex, image: selectedImage ?? historicalReferenceImage };
  }

  const referenceIndex = images.findIndex((image) => sameImage(image, historicalReferenceImage));
  if (historicalReferenceImage) {
    return {
      frameIndex: referenceIndex >= 0 ? referenceIndex : 0,
      image: historicalReferenceImage,
    };
  }

  const fallbackIndex = images.findIndex((image) => !sameImage(image, recaptureImage));
  return {
    frameIndex: fallbackIndex >= 0 ? fallbackIndex : 0,
    image: fallbackIndex >= 0 ? images[fallbackIndex] : undefined,
  };
}
