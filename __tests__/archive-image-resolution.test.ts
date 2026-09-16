import { loadBhvpImages } from '@/services/bhvp-images';

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
