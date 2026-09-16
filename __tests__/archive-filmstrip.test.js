import React from 'react';
import { act, create } from 'react-test-renderer';
import { ArchiveFilmstrip } from '@/components/archive-filmstrip';

let renderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });

it('annonce le statut par vue et sélectionne la bonne archive, même déjà refaite', async () => {
  const onSelect = jest.fn();
  await act(async () => { renderer = create(<ArchiveFilmstrip
    images={[{ uri: 'https://example.test/1.jpg' }, { uri: 'https://example.test/2.jpg' }]}
    selectedIndex={0} recaptureCounts={[0, 2]} onSelect={onSelect} />); });
  const buttons = renderer.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
  const refaite = buttons.find(node => node.props.accessibilityLabel.includes('déjà refaite'));
  expect(refaite).toBeDefined();
  expect(buttons.some(node => node.props.accessibilityLabel.includes('aucune reprise identifiée'))).toBe(true);
  await act(async () => refaite.props.onPress());
  expect(onSelect).toHaveBeenCalledWith(1);
});
