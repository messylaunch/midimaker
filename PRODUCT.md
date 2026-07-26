# PRODUCT.md — MIDI Vault Generator

## What it is
A local desktop app (Electron, Windows + macOS) for music producers: a searchable
library of 1,000+ coordinated 8-bar MIDI packs and an intelligent generator that
writes new ones with real music theory. Each pack = four .mid files (Chords,
Melody, CounterMelody, Bass) locked to one key, scale and tempo.

## Unique mechanism
Press Generate and get a coordinated four-part musical idea — deterministic
(seeded), theory-driven, duplicate-checked — then drag the actual files straight
into FL Studio channels. Song Drop listens to a track (tempo, key, chords,
energy) and writes original MIDI to match, with a similarity dial.

## Audience & scene
Beatmakers and producers (trap, R&B, pop, house...) working late in FL Studio,
usually at night, second monitor or alongside the DAW. They dig for ideas the
way they dig crates: fast flipping, instant audition, grab what sparks.

## Jobs
1. Dig: search/filter/preview packs, favorite/rate/collect.
2. Grab: drag any part (or whole pack) into a DAW channel — real files.
3. Cook: generate new packs with 16 controls + seed; regenerate single parts.
4. Match: drop a song, generate MIDI in its key/tempo/energy at chosen closeness.

## Product truths (do not violate)
- Files are real .mid on disk; drag-and-drop is native OS drag.
- Same seed + settings = identical pack, forever.
- Original writing only — never copies copyrighted melodies; Song Drop reads
  vitals, not the melody.
- Preview = built-in synth or live MIDI out (ch 1-4) to the user's instruments.
- 1,000-pack library ships in the box.

## Brand commitments
- Name: MIDI Vault (generator surname: "Vault Generator").
- Explicit user direction (2026-07): **no tech/SaaS dashboard look; a finished,
  artistic look** — imagery and motion welcome. Dark-plus-neon-glow prior look
  is retired as anti-reference.
- Tone: confident, musical, producer-to-producer; never corporate.

## Platform & constraints
Electron + React, CSP `img-src 'self' data:` (all assets local), no external
fonts/CDNs; must stay fast with a 1,000-card grid; Operate-mode surface — the
task (dig, grab, cook) can never be obscured by expression.
