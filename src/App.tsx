/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { HUD } from './components/HUD';
import { MapView } from './components/MapView';
import { BiddingView } from './components/BiddingView';
import { ParkView } from './components/ParkView';
import { SummaryView } from './components/SummaryView';
import { EditorView } from './editor/EditorView';
import { gameStateManager } from './game/gameState';

function useIsEditorRoute() {
  const [isEditor, setIsEditor] = useState(
    () => window.location.hash === '#editor' || new URLSearchParams(window.location.search).has('editor')
  );

  useEffect(() => {
    const onHashChange = () => setIsEditor(window.location.hash === '#editor');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return isEditor;
}

export default function App() {
  const isEditor = useIsEditorRoute();
  const [phase, setPhase] = useState(gameStateManager.state.phase);

  useEffect(() => {
    const unsubscribe = gameStateManager.subscribe(() => {
      setPhase(gameStateManager.state.phase);
    });
    return unsubscribe;
  }, []);

  if (isEditor) {
    return <EditorView />;
  }

  return (
    <div className="font-sans bg-zinc-900 min-h-screen text-white">
      <HUD />
      {phase === 'MAP' && <MapView />}
      {phase === 'BIDDING' && <BiddingView />}
      {(phase === 'SETUP' || phase === 'OPERATION' || phase === 'TEARDOWN') && <ParkView />}
      {phase === 'SUMMARY' && <SummaryView />}
    </div>
  );
}
