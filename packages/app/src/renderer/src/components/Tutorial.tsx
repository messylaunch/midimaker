import { useState } from 'react';

/** First-launch welcome tour. Reappears via Guide → "Replay the welcome tour". */

const STEPS = [
  {
    icon: '🎹',
    title: 'Welcome to MIDI Vault',
    text: (
      <>
        Your library starts loaded with <b>1,000 coordinated packs</b> — Chords, Melody,
        CounterMelody and Bass, four .mid files per pack, all locked to the same key and tempo.
        Let's take 30 seconds to show you around.
      </>
    ),
  },
  {
    icon: '🖐',
    title: 'Drag straight into FL Studio',
    text: (
      <>
        Every part row on a pack card is a <b>real MIDI file</b>. Drag <b>Chords</b> onto one FL
        channel, <b>Melody</b> onto another… or drag the <b>pack title</b> to carry all four at
        once. Works with ElectraX, Serum, anything that eats MIDI.
      </>
    ),
  },
  {
    icon: '🔊',
    title: 'Preview it your way',
    text: (
      <>
        Press <b>▶ Preview</b> on a card (or hit <b>Space</b>). Solo/mute parts, loop the 8 bars,
        bend the tempo. Pick built-in sounds under <b>🎛 Sounds</b> — or set <b>Out</b> to a MIDI
        port and hear it through your own instruments in FL Studio.
      </>
    ),
  },
  {
    icon: '🎛',
    title: 'Generate your own',
    text: (
      <>
        The <b>Generator</b> writes brand-new packs with real music theory — twist the glowing
        knobs for energy, complexity, density and more. Every pack has a <b>seed</b>: same seed,
        same settings, same exact pack, forever. The ⋯ menu can reroll <b>one part</b> while the
        other three stay untouched.
      </>
    ),
  },
  {
    icon: '🎧',
    title: 'Drop a song, steal its vibe',
    text: (
      <>
        In <b>Song Drop</b>, drop any mp3/wav. The app hears its tempo, key, chords and energy,
        then generates original MIDI to match. Slide from <b>“Just the vibe”</b> to
        <b> “Close to the song”</b> — closest legal cousin, never a copy.
      </>
    ),
  },
  {
    icon: '📖',
    title: 'That’s it — go make heat',
    text: (
      <>
        The full manual lives in <b>Guide</b> in the sidebar (including the 2-minute FL Studio
        MIDI routing setup). You can replay this tour from there anytime.
      </>
    ),
  },
];

export function Tutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="tutorial-overlay" onClick={(e) => e.target === e.currentTarget && onDone()}>
      <div className="tutorial-card">
        <span className="t-icon">{s.icon}</span>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        <div className="t-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`t-dot ${i === step ? 'on' : ''}`} />
          ))}
        </div>
        <div className="t-actions">
          {step > 0 && <button onClick={() => setStep(step - 1)}>← Back</button>}
          {!last && (
            <button className="ghost" onClick={onDone}>
              Skip tour
            </button>
          )}
          <button className="primary" onClick={() => (last ? onDone() : setStep(step + 1))}>
            {last ? "Let's go 🚀" : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
