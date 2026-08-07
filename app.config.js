const productionAndroidBuild =
  process.env.EAS_BUILD_PROFILE === 'production' && process.env.EAS_BUILD_PLATFORM === 'android';

module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (productionAndroidBuild && !googleMapsApiKey) {
    throw new Error(
      'GOOGLE_MAPS_API_KEY est requis pour un build Android de production. Configurez-le dans l’environnement EAS.',
    );
  }

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleMapsApiKey
        ? {
            config: {
              ...config.android?.config,
              googleMaps: { apiKey: googleMapsApiKey },
            },
          }
        : {}),
    },
  };
};
