import { useEffect, useState } from 'react';

/** In-app manual - everything a producer needs without leaving the app. */
export function GuideView({ onReplayTutorial }: { onReplayTutorial: () => void }) {
  const [libDir, setLibDir] = useState('');
  useEffect(() => {
    window.api.libraryDir().then(setLibDir).catch(() => setLibDir(''));
  }, []);

  return (
    <>
      <div className="toolbar">
        <b>Guide</b>
        <span className="hint">Everything in one place. New here?</span>
        <button onClick={onReplayTutorial}>▶ Replay the welcome tour</button>
      </div>
      <div className="content">
        <div className="guide">
          <h2>🚀 60-second start</h2>
          <div className="card">
            <ol>
              <li>Open <b>Library</b> — 1,000 ready-made packs are already loaded.</li>
              <li>Press <b>▶ Preview</b> on any card (or hit <code>Space</code> to play/stop).</li>
              <li>Like it? <b>Drag a part row</b> (Chords / Melody / CounterMelody / Bass) straight into an FL Studio channel. Drag the <b>pack title</b> to grab all four files at once.</li>
              <li>Want your own? Open <b>Generator</b>, twist some knobs, hit <b>Generate pack</b>.</li>
            </ol>
          </div>

          <h2>🗂 Library</h2>
          <ul>
            <li><b>Search</b> matches name, genre, mood, key and scale. <b>Filters</b> adds genre, mood, key, scale, era, method, BPM range, energy, complexity, density and favorites-only.</li>
            <li><b>♥ favorite</b>, <b>★ rate 1–5</b>, and group packs into <b>Collections</b> (left sidebar).</li>
            <li>The colored strip on each card is the actual MIDI: <span style={{ color: '#c9b3ff' }}>purple = chords</span>, <span style={{ color: '#fff' }}>white = melody</span>, <span style={{ color: '#2fe2bd' }}>teal = countermelody</span>, <span style={{ color: '#ffb84d' }}>orange = bass</span>.</li>
            <li><b>Import MIDI Folder</b> pulls your existing MIDI collections into the library.</li>
            <li>Your library lives at: <code>{libDir || '…'}</code></li>
          </ul>

          <h2>🎛 Generator knobs</h2>
          <div className="card">
            <table>
              <tbody>
                <tr><th>Energy</th><td>Louder, denser, more forward motion.</td></tr>
                <tr><th>Complexity</th><td>1–3 simple &amp; catchy · 4–7 passing tones, suspensions, syncopation · 8–10 extensions, borrowed notes, displacement (still musical, never random).</td></tr>
                <tr><th>Density</th><td>How many notes per bar the melody aims for.</td></tr>
                <tr><th>Movement</th><td>Low = repeats and small steps · high = wider motion and leaps.</td></tr>
                <tr><th>Chords</th><td>Triads → 7ths → 9ths/sus colors.</td></tr>
                <tr><th>Experiment</th><td>Chance of surprise progressions and chromatic color.</td></tr>
                <tr><th>Syncopate</th><td>Offbeat placement; high values also push chord changes early.</td></tr>
                <tr><th>Note Len</th><td>Staccato ↔ sustained writing.</td></tr>
                <tr><th>Humanize</th><td>Timing/velocity looseness, like a player not a grid.</td></tr>
              </tbody>
            </table>
          </div>
          <ul>
            <li><b>Familiar ↔ Surprise</b> controls how often it reaches past proven progressions (80/15/5 → 65/25/10 → 50/30/20).</li>
            <li><b>Seeds</b>: the same seed + same settings rebuilds the exact same pack, forever. Write down a seed you love.</li>
            <li><b>Regenerate one part</b> (⋯ menu on a card) rerolls just that part — the other three files don't change by a single byte.</li>
            <li>Knobs: <b>drag up/down</b>, <b>scroll</b> to nudge, <b>double-click</b> to reset.</li>
          </ul>

          <h2>🔊 Hearing your packs</h2>
          <ul>
            <li><b>Built-in sounds</b> (zero setup): 🎛 Sounds in the bottom bar — 808 Sub, Finger Bass, Reese, Keys, Soft Pad, E-Piano, Analog Lead, Pluck, Bell, Saw Stack.</li>
            <li><b>Real sounds</b>: set <b>Out</b> to a MIDI port and the preview plays through FL Studio / ElectraX / hardware. Parts arrive on channels — <b>1 Chords · 2 Melody · 3 Counter · 4 Bass</b>.</li>
          </ul>
          <div className="card">
            <h3>Windows routing (once, 2 minutes)</h3>
            <ol>
              <li>Install <b>loopMIDI</b> (free, tobias-erichsen.de) and create a port, e.g. “MIDI Vault”.</li>
              <li>FL Studio → Options → MIDI settings → <b>Input</b>: enable the port.</li>
              <li>Here: set <b>Out → MIDI Vault</b>, press ▶.</li>
            </ol>
            <h3>macOS routing</h3>
            <ol>
              <li>Audio MIDI Setup → Window → Show MIDI Studio → double-click <b>IAC Driver</b> → tick “Device is online”.</li>
              <li>Enable the IAC bus in FL Studio's MIDI inputs, pick it under <b>Out</b> here.</li>
            </ol>
          </div>

          <h2>🎧 Song Drop</h2>
          <ul>
            <li>Drop any mp3/wav — the app hears <b>tempo, key, chords, energy, density</b>.</li>
            <li>The <b>similarity slider</b> decides how close the generated MIDI stays:
              <b> Close to the song</b> reuses the chords it heard bar-by-bar (original melodies on top — the closest legal cousin, never a copy) ·
              <b> Inspired by it</b> keeps the vitals · <b>Just the vibe</b> roams free.</li>
          </ul>

          <h2>⚡ Shortcuts & tips</h2>
          <ul>
            <li><code>Space</code> — play/stop the loaded preview.</li>
            <li><b>🎲 Surprise me</b> (Library toolbar) — instant random pack when you need a spark.</li>
            <li>Every pack folder has a <code>metadata.json</code> — safe to read, edit through the app.</li>
            <li>Files are plain <code>.mid</code> — they work in any DAW, not just FL Studio.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
