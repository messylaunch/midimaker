import { contextBridge, ipcRenderer } from 'electron';

/** Thin typed bridge - all real work happens in the main process. */
const api = {
  listPacks: () => ipcRenderer.invoke('library:list'),
  libraryDir: () => ipcRenderer.invoke('library:dir'),
  importFolder: () => ipcRenderer.invoke('library:importFolder'),
  exportParts: (packId: string, parts: string[]) => ipcRenderer.invoke('pack:exportParts', packId, parts),
  exportPack: (packId: string) => ipcRenderer.invoke('pack:exportPack', packId),
  deletePack: (packId: string) => ipcRenderer.invoke('pack:delete', packId),
  renamePack: (packId: string, newName: string) => ipcRenderer.invoke('pack:rename', packId, newName),
  updateMeta: (packId: string, patch: unknown) => ipcRenderer.invoke('pack:updateMeta', packId, patch),
  setFavorite: (packId: string, fav: boolean) => ipcRenderer.invoke('pack:favorite', packId, fav),
  setRating: (packId: string, rating: number) => ipcRenderer.invoke('pack:rate', packId, rating),
  markUsed: (packId: string) => ipcRenderer.invoke('pack:markUsed', packId),
  packNotes: (packId: string) => ipcRenderer.invoke('pack:notes', packId),
  openPackFolder: (packId: string) => ipcRenderer.invoke('pack:openFolder', packId),
  listCollections: () => ipcRenderer.invoke('collections:list'),
  createCollection: (name: string) => ipcRenderer.invoke('collections:create', name),
  deleteCollection: (id: number) => ipcRenderer.invoke('collections:delete', id),
  addToCollection: (id: number, packId: string) => ipcRenderer.invoke('collections:add', id, packId),
  removeFromCollection: (id: number, packId: string) => ipcRenderer.invoke('collections:remove', id, packId),
  generatePack: (settings: unknown) => ipcRenderer.invoke('gen:pack', settings),
  regeneratePart: (packId: string, part: string) => ipcRenderer.invoke('gen:regenPart', packId, part),
  startDrag: (packId: string, parts: string[]) => ipcRenderer.send('drag:start', packId, parts),
};

contextBridge.exposeInMainWorld('api', api);
