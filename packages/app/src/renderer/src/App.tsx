import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CollectionRecord, PackRecord, PartName } from '@shared/types';
import { Sidebar, type SmartView } from './components/Sidebar';
import { LibraryView } from './components/LibraryView';
import { GeneratorView } from './components/GeneratorView';
import { SongDropView } from './components/SongDropView';
import { PreviewBar } from './components/PreviewBar';
import { player } from './preview/player';

export type MainView = 'library' | 'generator' | 'songdrop';

export interface Toast {
  id: number;
  text: string;
}

let toastId = 0;

export default function App() {
  const [view, setView] = useState<MainView>('library');
  const [smartView, setSmartView] = useState<SmartView>('all');
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [packs, setPacks] = useState<PackRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [playerPackId, setPlayerPackId] = useState<string | null>(null);

  useEffect(() => player.onChange((s) => setPlayerPackId(s.packId)), []);

  const refresh = useCallback(async () => {
    const [p, c] = await Promise.all([window.api.listPacks(), window.api.listCollections()]);
    setPacks(p);
    setCollections(c);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toast = useCallback((text: string) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const previewPack = useCallback(
    async (pack: PackRecord) => {
      try {
        const notes = await window.api.packNotes(pack.packId);
        await player.load(pack.packId, notes);
        player.play();
      } catch (e) {
        toast(`Preview failed: ${(e as Error).message}`);
      }
    },
    [toast]
  );

  const visiblePacks = useMemo(() => {
    let list = packs;
    if (collectionId !== null) {
      const col = collections.find((c) => c.id === collectionId);
      const ids = new Set(col?.packIds ?? []);
      list = list.filter((p) => ids.has(p.packId));
    } else if (smartView === 'favorites') {
      list = list.filter((p) => p.favorite);
    } else if (smartView === 'recentGenerated') {
      list = [...list]
        .filter((p) => p.generationMethod !== 'imported')
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        .slice(0, 40);
    } else if (smartView === 'recentUsed') {
      list = [...list]
        .filter((p) => p.lastUsedAt)
        .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
        .slice(0, 40);
    }
    return list;
  }, [packs, smartView, collectionId, collections]);

  const currentPack = useMemo(
    () => packs.find((p) => p.packId === playerPackId) ?? null,
    [packs, playerPackId]
  );

  return (
    <div className="app">
      <div className="app-body">
        <Sidebar
          view={view}
          smartView={smartView}
          collectionId={collectionId}
          collections={collections}
          onNavigate={(v) => setView(v)}
          onSmartView={(s) => {
            setView('library');
            setSmartView(s);
            setCollectionId(null);
          }}
          onCollection={(id) => {
            setView('library');
            setCollectionId(id);
            setSmartView('all');
          }}
          onCreateCollection={async (name) => {
            await window.api.createCollection(name);
            await refresh();
          }}
          onDeleteCollection={async (id) => {
            await window.api.deleteCollection(id);
            if (collectionId === id) setCollectionId(null);
            await refresh();
          }}
        />
        <div className="main">
          {view === 'library' && (
            <LibraryView
              packs={visiblePacks}
              collections={collections}
              smartView={smartView}
              onRefresh={refresh}
              onToast={toast}
              onPreview={previewPack}
            />
          )}
          {view === 'generator' && (
            <GeneratorView onRefresh={refresh} onToast={toast} onPreview={previewPack} collections={collections} />
          )}
          {view === 'songdrop' && (
            <SongDropView onRefresh={refresh} onToast={toast} onPreview={previewPack} collections={collections} />
          )}
        </div>
      </div>
      <PreviewBar packName={currentPack?.name ?? null} />
      {toasts.map((t) => (
        <div className="toast" key={t.id} style={{ bottom: 66 + (toasts.indexOf(t) * 52) }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export type { PartName };
