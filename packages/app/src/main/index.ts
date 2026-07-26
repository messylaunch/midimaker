import { app, BrowserWindow, dialog, ipcMain, nativeImage, session, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import type { PackSettings, PartName } from '@midimaker/engine';
import { flushDb, openDb } from './db';
import {
  deletePack, exportPack, exportParts, getLibraryRoot, getPack, importFolder, listPacks,
  markUsed, packDir, packNotes, partFilePath, renamePack, scanLibrary, setFavorite,
  setLibraryRoot, setRating, updateMeta,
} from './library';
import { generateAndSave, regeneratePart } from './generator';
import { all, get, run } from './db';

const isSmoke = process.argv.includes('--smoke');
const isDev = !app.isPackaged;

/** 32x32 note icon for the OS drag image (embedded so no asset pipeline is needed). */
const DRAG_ICON_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAxUlEQVR4nO2WwQ3CMAxFXxALdIRu' +
  'wgQwSTsJTMIIjNBNygQwQrmAFKrQOo6dcOBLuVSJ/9e3Y6fwr9J0wBmYgBl4AKPmYUvzZDLXAjTA' +
  'PWH+0jkHrblKAF+ZS40rAXCiXKcSAKNw5mIAxxWALgfAWbmyAWJDR7uzAoTQsr+PRDDlAKTMSyaj' +
  'GmBOmBcBnFbMiwCEo9V8Cnp3l+bFXKvVJQI4rgB0GgBSPa81vzUPzo7+8hz3jrpEcqbfM/f1zGuA' +
  'Nb2BB/tSJ9GRWn8AAAAASUVORK5CYII=';

let win: BrowserWindow | null = null;

function createWindow(): void {
  win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#2a2338',
    title: 'MIDI Vault Generator',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function resolveLibraryDir(): string {
  if (process.env.MIDIMAKER_LIBRARY) return process.env.MIDIMAKER_LIBRARY;
  if (isDev) {
    // dev: use the repo's MIDI-Library folder (ships with generated packs)
    return path.resolve(__dirname, '../../../../MIDI-Library');
  }
  const userLib = path.join(app.getPath('userData'), 'MIDI-Library');
  // first run of the installed app: seed the user library from the bundled
  // 1000-pack collection shipped in the installer's resources
  if (!fs.existsSync(userLib)) {
    const bundled = path.join(process.resourcesPath, 'MIDI-Library');
    if (fs.existsSync(bundled)) {
      try {
        fs.cpSync(bundled, userLib, { recursive: true });
      } catch (e) {
        console.error('Failed to seed library from bundled packs', e);
      }
    }
  }
  return userLib;
}

app.whenReady().then(async () => {
  // Web MIDI (live preview routing into FL Studio / ElectraX) needs an
  // explicit permission grant in Electron
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'midi' || permission === 'midiSysex');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'midi' || permission === 'midiSysex';
  });

  const dbFile = path.join(app.getPath('userData'), 'midimaker-library.db');
  await openDb(dbFile);
  setLibraryRoot(resolveLibraryDir());
  scanLibrary();
  registerIpc();
  createWindow();

  if (isSmoke) {
    let rendererErrors = 0;
    win!.webContents.on('console-message', (_e, level, message) => {
      if (level >= 3) {
        rendererErrors++;
        console.error('[smoke] renderer error:', message);
      }
    });
    win!.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        try {
          // exercise the full in-app generation path end to end
          const rec = generateAndSave({
            seed: 424242, genre: 'trap', mood: 'dark', bpm: 140, key: 'F#',
            scale: 'naturalMinor', energy: 7, complexity: 5, rhythmicDensity: 6,
            melodicMovement: 5, chordComplexity: 4, experimental: 2, syncopation: 5,
            noteLength: 5, humanize: 3, familiarity: 'balanced', era: ['Modern'],
          } as PackSettings);
          const notes = packNotes(rec.packId);
          const noteCount = Object.values(notes.parts).reduce((n, p) => n + p.length, 0);
          if (noteCount < 10) throw new Error('generated pack has too few notes');
          deletePack(rec.packId);
          if (rendererErrors === 0) {
            console.log(`SMOKE OK - ${listPacks().length} packs in library at ${getLibraryRoot()}; in-app generation OK (${noteCount} notes)`);
            app.exit(0);
          } else {
            console.error(`SMOKE FAILED - ${rendererErrors} renderer errors`);
            app.exit(1);
          }
        } catch (e) {
          console.error('SMOKE FAILED -', e);
          app.exit(1);
        }
      }, 1500);
    });
    setTimeout(() => {
      console.error('SMOKE FAILED - window never finished loading');
      app.exit(1);
    }, 30000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  flushDb();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => flushDb());

/* ---------------- IPC ---------------- */

function registerIpc(): void {
  ipcMain.handle('library:list', () => listPacks());
  ipcMain.handle('library:dir', () => getLibraryRoot());

  ipcMain.handle('library:importFolder', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Import MIDI folder',
      properties: ['openDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const result = importFolder(res.filePaths[0]);
    return result;
  });

  ipcMain.handle('pack:exportParts', async (_e, packId: string, parts: PartName[]) => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Export MIDI parts to folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    exportParts(packId, parts, res.filePaths[0]);
    return res.filePaths[0];
  });

  ipcMain.handle('pack:exportPack', async (_e, packId: string) => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Export pack to folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return exportPack(packId, res.filePaths[0]);
  });

  ipcMain.handle('pack:delete', (_e, packId: string) => deletePack(packId));
  ipcMain.handle('pack:rename', (_e, packId: string, name: string) => renamePack(packId, name));
  ipcMain.handle('pack:updateMeta', (_e, packId: string, patch) => updateMeta(packId, patch));
  ipcMain.handle('pack:favorite', (_e, packId: string, fav: boolean) => setFavorite(packId, fav));
  ipcMain.handle('pack:rate', (_e, packId: string, rating: number) => setRating(packId, rating));
  ipcMain.handle('pack:markUsed', (_e, packId: string) => markUsed(packId));
  ipcMain.handle('pack:notes', (_e, packId: string) => packNotes(packId));
  ipcMain.handle('pack:openFolder', (_e, packId: string) => {
    shell.openPath(packDir(packId));
  });

  ipcMain.handle('collections:list', () => {
    const cols = all<{ id: number; name: string }>('SELECT * FROM collections ORDER BY name');
    return cols.map((c) => ({
      ...c,
      packIds: all<{ packId: string }>('SELECT packId FROM collection_packs WHERE collectionId = ?', [c.id]).map(
        (r) => r.packId
      ),
    }));
  });
  ipcMain.handle('collections:create', (_e, name: string) => {
    run('INSERT OR IGNORE INTO collections (name) VALUES (?)', [name]);
    const row = get<{ id: number; name: string }>('SELECT * FROM collections WHERE name = ?', [name])!;
    return { ...row, packIds: [] };
  });
  ipcMain.handle('collections:delete', (_e, id: number) => {
    run('DELETE FROM collections WHERE id = ?', [id]);
    run('DELETE FROM collection_packs WHERE collectionId = ?', [id]);
  });
  ipcMain.handle('collections:add', (_e, id: number, packId: string) => {
    run('INSERT OR IGNORE INTO collection_packs (collectionId, packId) VALUES (?, ?)', [id, packId]);
  });
  ipcMain.handle('collections:remove', (_e, id: number, packId: string) => {
    run('DELETE FROM collection_packs WHERE collectionId = ? AND packId = ?', [id, packId]);
  });

  ipcMain.handle('gen:pack', (_e, settings: PackSettings) => generateAndSave(settings));
  ipcMain.handle('gen:regenPart', (_e, packId: string, part: PartName) => regeneratePart(packId, part));

  // native OS file drag-out: THE critical FL Studio feature.
  // Real files on disk + webContents.startDrag = a genuine explorer-grade drag.
  ipcMain.on('drag:start', (event, packId: string, parts: PartName[]) => {
    try {
      const files = parts.map((p) => partFilePath(packId, p)).filter((f) => fs.existsSync(f));
      if (files.length === 0) return;
      const icon = nativeImage.createFromDataURL(`data:image/png;base64,${DRAG_ICON_PNG}`);
      if (files.length === 1) {
        event.sender.startDrag({ file: files[0], icon });
      } else {
        event.sender.startDrag({ file: files[0], files, icon });
      }
      markUsed(packId);
    } catch (e) {
      console.error('drag failed', e);
    }
  });
}
