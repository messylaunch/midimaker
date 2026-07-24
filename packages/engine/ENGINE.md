# @midimaker/engine — contract for the future JUCE VST3 port

The generation engine is **pure TypeScript**: no Node, no Electron, no DOM, no
filesystem, no `Math.random()`, no `Date`. Every function is a deterministic
mapping from inputs to outputs, which is exactly what a real-time plugin needs.

## Inputs

`generatePack(settings: PackSettings, partSeeds?: PartSeeds): GeneratedPack`

`PackSettings` (all randomness derives from `seed`):

| Field | Type | Range | Meaning |
| --- | --- | --- | --- |
| seed | uint32 | any | deterministic seed; same seed + settings ⇒ byte-identical output |
| genre | string | profile id | e.g. `trap`, `pop`, `house` (see `profiles/genres.json`) |
| mood | string | profile id | e.g. `dark`, `dreamy` (see `profiles/moods.json`) |
| bpm | int | 40–220 | tempo written into the MIDI files |
| key | string | C…B | tonic |
| scale | string | scale id | `major`, `naturalMinor`, `dorian`, … (`theory/scales.ts`) |
| energy | int | 1–10 | velocity + density bias |
| complexity | int | 1–10 | interval caps, tension-note probability, chord upgrades |
| rhythmicDensity | int | 1–10 | onsets per bar |
| melodicMovement | int | 1–10 | step sizes / repetition tendency |
| chordComplexity | int | 1–10 | triads → 7ths → 9ths/sus |
| experimental | int | 1–10 | borrowed chords, chromatic neighbors, surprise pool weight |
| syncopation | int | 1–10 | offbeat placement + chord anticipations |
| noteLength | int | 1–10 | staccato ↔ sustained bias |
| humanize | int | 0–10 | timing/velocity jitter |
| familiarity | enum | familiar/balanced/experimental | 80/15/5 → 65/25/10 → 50/30/20 pool weights |

`PartSeeds` — optional per-part offsets; used for **regenerate one part**:
passing `{ melody: 1 }` rerolls only the melody; chords/bass bytes stay
identical (each part has an isolated RNG stream, including humanization).

## Outputs

`GeneratedPack`:

- `parts`: `{ chords, melody, counterMelody, bass }` — arrays of
  `NoteEvent { start, dur, pitch, vel }` in ticks at **PPQ 480**,
  covering exactly **8 bars of 4/4 = 15360 ticks**.
- `progression`: roman numerals actually used (e.g. `i-VI-III-VII`).
- `phrasePlan`, `bassStyle`, `chordStyle`: which structural templates fired.
- `signature`: `PackSignature` for duplicate detection.

`packToMidiFiles(pack)` → four `Uint8Array`s (SMF format 0, PPQ 480,
track name + tempo + 4/4 time signature + program, End-of-Track pinned at
tick 15360). In a VST you would skip this and stream `NoteEvent`s directly
to four MIDI output buses (chords/melody/counter/bass → separate FL Studio
channels).

## Porting notes

- RNG is mulberry32 (integer math only) — port verbatim to C++ for identical
  sequences. Sub-streams via `deriveSeed(seed, label)`.
- Knowledge base is plain JSON (`profiles/*.json`) — ship as plugin resources;
  adding preset libraries means adding JSON entries, no code changes.
- The only entry points a plugin needs: `generatePack`, `sanitizeSettings`,
  profile lists (`GENRES`, `MOODS`), and optionally `computeSignature` +
  `isNearDuplicate` for in-plugin duplicate rejection.
- Planned plugin routing: one generator instance → 4 (later N) MIDI outputs;
  parts map 1:1 onto output buses, so `PartName` is the bus key.
