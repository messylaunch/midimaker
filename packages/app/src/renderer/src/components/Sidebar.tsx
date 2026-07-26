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
        MIDI<span>Vault</span>
      </div>
      <div className="logo-sub">Print shop for MIDI</div>

      <button
        className={`nav-item ${inLibrary && p.smartView === 'all' && p.collectionId === null ? 'active' : ''}`}
        onClick={() => p.onSmartView('all')}
      >
        Library
      </button>
      <button className={`nav-item ${p.view === 'generator' ? 'active' : ''}`} onClick={() => p.onNavigate('generator')}>
        Press Room
      </button>
      <button className={`nav-item ${p.view === 'songdrop' ? 'active' : ''}`} onClick={() => p.onNavigate('songdrop')}>
        Song Drop
      </button>
      <button className={`nav-item ${p.view === 'guide' ? 'active' : ''}`} onClick={() => p.onNavigate('guide')}>
        Guide
      </button>

      <div className="side-heading">Pulls</div>
      <div className="tag-row">
        <button className={`tag ${inLibrary && p.smartView === 'favorites' ? 'active' : ''}`} onClick={() => p.onSmartView('favorites')}>
          Favorites
        </button>
      </div>
      <div className="tag-row">
        <button className={`tag ${inLibrary && p.smartView === 'recentGenerated' ? 'active' : ''}`} onClick={() => p.onSmartView('recentGenerated')}>
          Fresh prints
        </button>
      </div>
      <div className="tag-row">
        <button className={`tag ${inLibrary && p.smartView === 'recentUsed' ? 'active' : ''}`} onClick={() => p.onSmartView('recentUsed')}>
          Recently used
        </button>
      </div>

      <div className="side-heading">Collections</div>
      {p.collections.map((c) => (
        <div className="tag-row" key={c.id}>
          <button className={`tag ${inLibrary && p.collectionId === c.id ? 'active' : ''}`} onClick={() => p.onCollection(c.id)}>
            {c.name} <span className="count">{c.packIds.length}</span>
          </button>
          <button className="tag-x" title="Delete collection" onClick={() => p.onDeleteCollection(c.id)}>
            ×
          </button>
        </div>
      ))}
      <form
        className="new-tag"
        onSubmit={(e) => {
          e.preventDefault();
          if (newCol.trim()) {
            p.onCreateCollection(newCol.trim());
            setNewCol('');
          }
        }}
      >
        <input type="text" placeholder="New collection…" value={newCol} onChange={(e) => setNewCol(e.target.value)} />
        <button type="submit">+</button>
      </form>
    </aside>
  );
}
