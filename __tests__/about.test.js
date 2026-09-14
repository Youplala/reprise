import React from 'react';
import { act, create } from 'react-test-renderer';
import { Alert, Linking } from 'react-native';

import { AboutScreen } from '@/screens/about';

let renderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

it('ouvre les destinations publiques du développeur et du projet depuis À propos', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await act(async () => { renderer = create(<AboutScreen />); });
  for (const [label, url] of [
    ['Contacter Élie', 'mailto:parisgo@eliebrosset.com'],
    ['Le site de Paris GO', 'https://youplala.github.io/reprise/'],
    ['Le code sur GitHub', 'https://github.com/Youplala/reprise'],
    ['Confidentialité', 'https://youplala.github.io/reprise/confidentialite/'],
  ]) {
    const button = renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
    expect(button).toBeDefined();
    await act(async () => { await button.props.onPress(); });
    expect(open).toHaveBeenLastCalledWith(url);
  }
});

it('signale un lien impossible à ouvrir sans faire tomber l’écran', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('not available'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => { renderer = create(<AboutScreen />); });
  const button = renderer.root.findAll(node => node.props.accessibilityLabel === 'Contacter Élie' && typeof node.props.onPress === 'function')[0];
  expect(button).toBeDefined();
  await act(async () => { await button.props.onPress(); });
  expect(alert).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('parisgo@eliebrosset.com'));
});
