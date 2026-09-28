import { archiveLinkForReferenceUri, loadBhvpImages } from '@/services/bhvp-images';

afterEach(() => jest.restoreAllMocks());

it('résout uniquement les vues demandées et conserve leur ARK malgré un dossier indisponible', async () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('B9999999')) throw new Error('offline');
    return { ok: true, text: async () => 'var pictureList = [{"image":"/1.jpg"},{"image":"/2.jpg"},{"image":"/3.jpg"}];' } as Response;
  });
  const root = 'https://bibliotheques-specialisees.paris.fr/ark:/73873/FRCGMNOV-751045102-LAF';
  const images = await loadBhvpImages([`${root}/B9999999/v0001`, `${root}/B8888888/v0003`, `${root}/B8888888/v0001`]);
  expect(images).toEqual([
    { uri: 'https://bibliotheques-specialisees.paris.fr/3.jpg', archiveLink: `${root}/B8888888/v0003` },
    { uri: 'https://bibliotheques-specialisees.paris.fr/1.jpg', archiveLink: `${root}/B8888888/v0001` },
  ]);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

it('associe l’ARK à l’URI réellement envoyée, pas à une autre vue sélectionnée', () => {
  const root =
    'https://bibliotheques-specialisees.paris.fr/ark:/73873/FRCGMNOV-751045102-LAC/B1735044';
  const images = [
    { uri: 'https://bibliotheques-specialisees.paris.fr/1.jpg', archiveLink: `${root}/v0001` },
    { uri: 'https://bibliotheques-specialisees.paris.fr/9.jpg', archiveLink: `${root}/v0009` },
  ];

  expect(archiveLinkForReferenceUri(images[1].uri, images)).toBe(`${root}/v0009`);
});

it('conserve un ARK porté directement par l’URI d’une référence publiée', () => {
  const uri =
    'https://observatoire-photo.paris/uploads/ark:/73873/FRCGMNOV-751045102-LAC/B1735044/v0009/reference.jpg';

  expect(archiveLinkForReferenceUri(uri, [{ uri }])).toBe(uri);
});
