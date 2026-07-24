# MIDI Vault Generator

A local desktop app for music producers: a **searchable MIDI library** plus an
**intelligent MIDI generator**. Generates coordinated 8-bar packs — Chords,
Melody, CounterMelody and Bass as four separate `.mid` files that share one
key, scale and tempo — and lets you drag them straight into FL Studio,
ElectraX or any other instrument.

**The repo ships with a pre-generated library: 1,000 packs = 4,000 validated
MIDI files** in [`MIDI-Library/`](MIDI-Library) (see
[`MIDI-Library/REPORT.md`](MIDI-Library/REPORT.md) for distributions).

## Quick start

```bash
npm install
npm run dev
```

That opens the desktop app with the full library loaded. To launch again
later, the only command you need is `npm run dev`.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Launch the app (dev mode, hot reload) |
| `npm test` | Run the engine test suite (determinism, 8-bar checks, variety, dedup) |
| `npm run generate:library` | Regenerate the 1,000-pack library (`--count N` to change size) |
| `npm run validate:library` | Re-verify every pack on disk |
| `npm run smoke` | Headless boot check (CI) |
| `npm run dist:win` | Build the Windows installer (run on Windows) |
| `npm run dist:mac` | Build the macOS dmg (run on macOS) |

## Why Electron (not Tauri)

The make-or-break feature is dragging real `.mid` files into FL Studio.
Electron's `webContents.startDrag()` performs a genuine OS-level file drag
(CF_HDROP on Windows, NSDraggingSession on macOS) — the exact mechanism
Explorer/Finder use, which DAWs accept reliably. Tauri needs a third-party
plugin for drag-out that is far less proven. Electron also keeps the whole
stack in TypeScript, so the generation engine is shared verbatim between the
app and the batch tools.

## Using the app

- **Library** — search, sort and filter (mood, genre, BPM, key, scale, energy,
  complexity, era, density, method, favorites). Favorites, 1–5 star ratings,
  collections, recently generated / recently used views, import existing MIDI
  folders, export parts or whole packs, rename/delete, edit metadata.
- **Drag and drop** — drag any part row (or the pack header for all four
  files) straight into FL Studio channels or any folder. These are real files
  on disk, not a browser trick.
- **Preview** — play all four parts, solo/mute each, loop the 8 bars, change
  preview tempo without touching the files. Two ways to hear it:
  - **Built-in sounds** (no setup): pick an instrument per part under
    🎛 Sounds — 808 Sub, Finger Bass, Reese, Keys, Soft Pad, E-Piano,
    Analog Lead, Pluck, Bell, Saw Stack.
  - **Live MIDI out** (real sounds): set *Out* in the preview bar to a MIDI
    port and the preview plays through FL Studio / ElectraX / hardware
    instead. Parts arrive on separate channels — 1 Chords, 2 Melody,
    3 CounterMelody, 4 Bass. See "Routing the preview into FL Studio" below.
- **Generator** — controls for mood, genre, BPM, key, major/minor, scale/mode,
  energy, complexity (1–10), rhythmic density, melodic movement, chord
  complexity, experimental amount, syncopation, note length, humanization,
  familiar↔surprise, and a deterministic seed (same seed = same pack).
  Regenerate any single part while the other three stay untouched.
- **Song Drop** — drop an audio file; the app hears its tempo, key/scale,
  chords, energy and density, then generates original packs to match. A
  **similarity slider** controls how close it stays:
  - **Close to the song** — reuses the chords actually heard in the track
    (bar by bar) plus its exact tempo/key/energy/density. Melodies are still
    generated fresh, so it's the closest *legal* cousin, never a copy.
  - **Inspired by it** — keeps the vitals, draws chords from genre vocabulary.
  - **Just the vibe** — key and tempo as anchors, everything else roams.

## Routing the preview into FL Studio (real sounds)

The app is a MIDI generator, not a sound generator — so for real sounds,
point the preview at your DAW:

**Windows:** install [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)
(free), create a port (e.g. "MIDI Vault"). In FL Studio: *Options → MIDI
settings → Input*, enable the port. In MIDI Vault set *Out: MIDI Vault*.
Press ▶ — FL receives the four parts on channels 1–4. Set each FL channel's
instrument (ElectraX, Serum, anything) to a channel via the channel selector,
or just play everything into the selected channel.

**macOS:** open *Audio MIDI Setup → Window → Show MIDI Studio*, double-click
**IAC Driver**, tick *Device is online*. Enable the IAC bus in FL Studio's
MIDI input settings, then pick it under *Out* in MIDI Vault.

And of course you can always skip previewing entirely: drag the `.mid` into
an ElectraX channel and audition it there.

## Architecture

```
packages/engine    pure-TS generation engine (no Node/Electron deps → future JUCE VST3 port)
  src/theory       scales, roman-numeral chords, voice leading
  src/profiles     knowledge base: 21 genres, 14 moods, eras — editable JSON rule profiles
  src/generate     harmony → chords → melody → countermelody → bass
  src/midi         SMF writer + parser (PPQ 480, exact 8-bar files)
  src/dedup        signatures + similarity (rhythm/intervals/contour/progression)
  src/validate.ts  8-bar, key-consistency, range and collision checks
packages/app       Electron + React desktop app
  src/main         window, IPC, library folder, sql.js index, native drag-out
  src/renderer     library UI, generator UI, song-drop analysis, WebAudio preview
tools/             batch generator + validator (produced MIDI-Library/)
```

The engine is deliberately isolated — see
[`packages/engine/ENGINE.md`](packages/engine/ENGINE.md) for the documented
input/output contract used to move it into a JUCE VST3 plugin later (multiple
MIDI outputs routed to separate FL Studio channels).

Music knowledge is stored as **generalized statistical profiles** (phrase
plans, harmonic rhythms, progression pools by function, bass movement styles,
register ranges). No copyrighted melodies are scraped, stored or reproduced.

## Installers (Windows + Mac, including Apple Silicon)

`electron-builder` is configured (`packages/app/electron-builder.yml`) for a
Windows NSIS installer and a macOS dmg (**arm64 for M1/M2/M3 + Intel x64**).
The installer bundles the full 1,000-pack library and copies it into your
library folder on first launch.

Two ways to get installers:

1. **GitHub Actions** (no local setup): the *Build installers* workflow
   (`.github/workflows/build.yml`) builds both platforms — run it from the
   Actions tab (or push a `v*` tag) and download the artifacts.
2. **Locally**: `npm run dist:win` on Windows, `npm run dist:mac` on a Mac.
   Output lands in `packages/app/release/`.

The builds are unsigned. On macOS the first launch needs a right-click →
Open (or `xattr -cr "/Applications/MIDI Vault Generator.app"` once); on
Windows, click "More info → Run anyway" past SmartScreen.
