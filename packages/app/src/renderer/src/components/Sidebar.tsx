import { useState } from 'react';
import type { CollectionRecord } from '@shared/types';
import type { MainView } from '../App';

export type SmartView = 'all' | 'favorites' | 'recentGenerated' | 'recentUsed';

interface Props {
  view: MainView;
  smartView: SmartView;
  collectionId: number | null;
  collections: CollectionRecord[];
  onNavigate: (v: MainView) => void;
  onSmartView: (s: SmartView) => void;
  onCollection: (id: number) => void;
  onCreateCollection: (name: string) => void;
  onDeleteCollection: (id: number) => void;
}

export function Sidebar(p: Props) {
  const [newCol, setNewCol] = useState('');
  const inLibrary = p.view === 'library';

  return (
    <aside className="sidebar">
      <div className="logo">
        MIDI <span>Vault</span>
      </div>

      <button className={`nav-item ${inLibrary && p.smartView === 'all' && p.collectionId === null ? 'active' : ''}`} onClick={() => p.onSmartView('all')}>
        🗂 Library
      </button>
      <button className={`nav-item ${p.view === 'generator' ? 'active' : ''}`} onClick={() => p.onNavigate('generator')}>
        ✨ Generator
      </button>
      <button className={`nav-item ${p.view === 'songdrop' ? 'active' : ''}`} onClick={() => p.onNavigate('songdrop')}>
        🎧 Song Drop
      </button>
      <button className={`nav-item ${p.view === 'guide' ? 'active' : ''}`} onClick={() => p.onNavigate('guide')}>
        📖 Guide
      </button>

      <div className="side-heading">Views</div>
      <button className={`nav-item ${inLibrary && p.smartView === 'favorites' ? 'active' : ''}`} onClick={() => p.onSmartView('favorites')}>
        ♥ Favorites
      </button>
      <button className={`nav-item ${inLibrary && p.smartView === 'recentGenerated' ? 'active' : ''}`} onClick={() => p.onSmartView('recentGenerated')}>
        🕒 Recently generated
      </button>
      <button className={`nav-item ${inLibrary && p.smartView === 'recentUsed' ? 'active' : ''}`} onClick={() => p.onSmartView('recentUsed')}>
        📌 Recently used
      </button>

      <div className="side-heading">Collections</div>
      {p.collections.map((c) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center' }}>
          <button
            className={`nav-item ${inLibrary && p.collectionId === c.id ? 'active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => p.onCollection(c.id)}
          >
            📁 {c.name} <span style={{ opacity: 0.55, marginLeft: 'auto' }}>{c.packIds.length}</span>
          </button>
          <button
            className="ghost"
            title="Delete collection"
            style={{ padding: '2px 6px' }}
            onClick={() => p.onDeleteCollection(c.id)}
          >
            ×
          </button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newCol.trim()) {
            p.onCreateCollection(newCol.trim());
            setNewCol('');
          }
        }}
        style={{ display: 'flex', gap: 4, padding: '6px 4px' }}
      >
        <input
          type="text"
          placeholder="New collection…"
          value={newCol}
          onChange={(e) => setNewCol(e.target.value)}
          style={{ flex: 1, minWidth: 0, fontSize: 12 }}
        />
        <button type="submit" style={{ padding: '4px 9px' }}>
          +
        </button>
      </form>
    </aside>
  );
}
