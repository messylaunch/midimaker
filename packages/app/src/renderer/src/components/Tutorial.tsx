import { useState } from 'react';

/** First-launch welcome tour. Reappears via Guide → "Replay the welcome tour". */

const STEPS = [
  {
    title: 'Welcome to the print shop',
    text: (
      <>
        Your wall starts hung with <b>1,000 coordinated packs</b> — Chords, Melody,
        CounterMelody and Bass, four .mid files per pack, all locked to the same key and tempo.
        Thirty seconds and you'll know the whole shop.
      </>
    ),
  },
  {
    title: 'Drag straight into FL Studio',
    text: (
      <>
        Every billing line on a poster is a <b>real MIDI file</b>. Drag <b>Chords</b> onto one FL
        channel, <b>Melody</b> onto another… or drag the <b>poster title</b> to carry all four at
        once. Works with ElectraX, Serum, anything that eats MIDI.
      </>
    ),
  },
  {
    title: 'Audition it your way',
    text: (
      <>
        Press <b>▶ Play</b> on a poster (or hit <b>Space</b>). Solo/mute parts, loop the 8 bars,
        bend the tempo. Pick built-in sounds under <b>Sounds</b> — or set <b>Out</b> to a MIDI
        port and hear it through your own instruments in FL Studio.
      </>
    ),
  },
  {
    title: 'Pull your own prints',
    text: (
      <>
        The <b>Press Room</b> writes brand-new packs with real music theory — twist the ink knobs
        for energy, complexity, density and more. Every pack has a <b>seed</b>: same seed, same
        settings, same exact pack, forever. The ⋯ menu can reprint <b>one part</b> while the other
        three stay untouched.
      </>
    ),
  },
  {
    title: 'Drop a song, print its spirit',
    text: (
      <>
        In <b>Song Drop</b>, paste any mp3/wav on the wall. The shop hears its tempo, key, chords
        and energy, then prints original MIDI to match. Slide from <b>“Just the vibe”</b> to
        <b> “Close to the song”</b> — closest legal cousin, never a copy.
      </>
    ),
  },
  {
    title: 'That’s it — go make heat',
    text: (
      <>
        The full shop manual lives under <b>Guide</b> (including the 2-minute FL Studio MIDI
        routing setup). You can replay this tour from there anytime.
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
        <span className="t-step">{step + 1}/{STEPS.length}</span>
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
            {last ? "Let’s go" : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
