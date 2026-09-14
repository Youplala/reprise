import React, { useState } from 'react';
import { afterEach, expect, it } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

import { MapPreviewSheet, isVerticalPreviewDrag, previewShouldCollapse } from '@/components/map-preview-sheet';

let renderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });

it('laisse le balayage horizontal au carrousel et ignore les petits mouvements', () => {
  expect(isVerticalPreviewDrag(80, 15)).toBe(false);
  expect(isVerticalPreviewDrag(2, 4)).toBe(false);
  expect(isVerticalPreviewDrag(8, 65)).toBe(true);
  expect(isVerticalPreviewDrag(8, -65)).toBe(true);
});

it('rabaisse vers le bas, rouvre vers le haut et conserve l’état sur un geste court', () => {
  expect(previewShouldCollapse(false, 90, 0.1)).toBe(true);
  expect(previewShouldCollapse(true, -90, -0.1)).toBe(false);
  expect(previewShouldCollapse(false, 12, 0.1)).toBe(false);
  expect(previewShouldCollapse(true, -12, -0.1)).toBe(true);
  expect(previewShouldCollapse(false, 15, 0.8)).toBe(true);
});

it('permet aussi de réduire et rouvrir la fiche en touchant la poignée', async () => {
  function Harness() {
    const [collapsed, setCollapsed] = useState(false);
    return <MapPreviewSheet collapsed={collapsed} onCollapsedChange={setCollapsed}>
      <Text>75 Rue Galande</Text>
    </MapPreviewSheet>;
  }
  await act(async () => { renderer = create(<Harness />); });
  const handle = () => renderer.root.findAll((node) =>
    node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0];
  expect(handle().props.accessibilityState.expanded).toBe(true);
  await act(async () => { handle().props.onPress(); });
  expect(handle().props.accessibilityState.expanded).toBe(false);
  await act(async () => { handle().props.onPress(); });
  expect(handle().props.accessibilityState.expanded).toBe(true);
});
