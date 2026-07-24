/**
 * Song Drop analysis: drop an audio file, get generator-ready settings.
 *
 * Pure DSP in the renderer (no cloud): tempo from onset autocorrelation,
 * key/scale from a chroma histogram matched against Krumhansl-Schmuckler
 * profiles, energy from RMS, density from onset rate, plus rough per-bar
 * chord guesses for display. The output feeds the generation engine so the
 * app writes ORIGINAL midi inspired by the song's vitals - it never copies
 * the audio's melody.
 */

import type { SongAnalysis } from '@shared/types';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export async function analyzeSong(
  file: File,
  onProgress?: (fraction: number, stage: string) => void
): Promise<SongAnalysis> {
  onProgress?.(0.02, 'Decoding audio…');
  const arrayBuf = await file.arrayBuffer();
  const decodeCtx = new AudioContext({ sampleRate: 22050 });
  const audio = await decodeCtx.decodeAudioData(arrayBuf);
  void decodeCtx.close();

  const sr = audio.sampleRate;
  const maxSec = 120; // first two minutes carry all the info we need
  const length = Math.min(audio.length, sr * maxSec);
  const mono = new Float32Array(length);
  for (let ch = 0; ch < audio.numberOfChannels; ch++) {
    const data = audio.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / audio.numberOfChannels;
  }

  const frameSize = 2048;
  const hop = 512;
  const nFrames = Math.floor((length - frameSize) / hop);
  const flux = new Float32Array(Math.max(0, nFrames));
  const chroma = new Float32Array(12);
  let rmsSum = 0;

  const window = hann(frameSize);
  const re = new Float32Array(frameSize);
  const im = new Float32Array(frameSize);
  let prevMag: Float32Array | null = null;

  for (let f = 0; f < nFrames; f++) {
    const off = f * hop;
    for (let i = 0; i < frameSize; i++) {
      re[i] = mono[off + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);
    const half = frameSize / 2;
    const mag = new Float32Array(half);
    let frameRms = 0;
    for (let i = 0; i < half; i++) {
      mag[i] = Math.hypot(re[i], im[i]);
      frameRms += mono[off + i] * mono[off + i];
    }
    rmsSum += Math.sqrt(frameRms / half);

    // spectral flux (half-wave rectified)
    if (prevMag) {
      let s = 0;
      for (let i = 2; i < half; i++) {
        const d = mag[i] - prevMag[i];
        if (d > 0) s += d;
      }
      flux[f] = s;
    }
    prevMag = mag;

    // chroma accumulation (60Hz..2kHz band)
    for (let i = 2; i < half; i++) {
      const freq = (i * sr) / frameSize;
      if (freq < 60 || freq > 2000) continue;
      const midi = 69 + 12 * Math.log2(freq / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] += mag[i] * (freq < 500 ? 1.4 : 1); // weight the harmonic base
    }

    if (f % 400 === 0) {
      onProgress?.(0.05 + (f / nFrames) * 0.75, 'Analyzing spectrum…');
      await yieldToUi();
    }
  }

  onProgress?.(0.85, 'Estimating tempo…');
  const bpm = estimateTempo(flux, sr / hop);

  onProgress?.(0.92, 'Detecting key…');
  const { key, minor, confidence } = detectKey(chroma);

  // energy: mean rms mapped to 1..10
  const meanRms = rmsSum / Math.max(1, nFrames);
  const energy = Math.max(1, Math.min(10, Math.round(2 + meanRms * 55)));

  // density: onsets per second above adaptive threshold
  const onsetRate = countOnsets(flux) / (length / sr);
  const rhythmicDensity = Math.max(1, Math.min(10, Math.round(onsetRate * 2.2)));

  const chordGuesses = guessChords(mono, sr, bpm, key, minor);

  return {
    fileName: file.name,
    bpm,
    key,
    scale: minor ? 'naturalMinor' : 'major',
    keyConfidence: Math.round(confidence * 100) / 100,
    energy,
    rhythmicDensity,
    durationSec: Math.round(audio.duration),
    chordGuesses,
  };
}

/* ---------------- DSP helpers ---------------- */

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/** In-place radix-2 FFT. */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curR = 1;
      let curI = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * curR - im[i + k + len / 2] * curI;
        const vi = re[i + k + len / 2] * curI + im[i + k + len / 2] * curR;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nr = curR * wr - curI * wi;
        curI = curR * wi + curI * wr;
        curR = nr;
      }
    }
  }
}

function estimateTempo(flux: Float32Array, frameRate: number): number {
  if (flux.length < frameRate * 4) return 120;
  // autocorrelation of the flux for lags 60..190 bpm
  const minBpm = 60;
  const maxBpm = 190;
  const minLag = Math.floor((60 / maxBpm) * frameRate);
  const maxLag = Math.ceil((60 / minBpm) * frameRate);
  let bestLag = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < flux.length; i++) s += flux[i] * flux[i + lag];
    // gentle preference for the common 80-160 range
    const bpm = (60 * frameRate) / lag;
    const pref = bpm >= 80 && bpm <= 160 ? 1.15 : 1;
    if (s * pref > bestScore) {
      bestScore = s * pref;
      bestLag = lag;
    }
  }
  let bpm = (60 * frameRate) / bestLag;
  while (bpm < 65) bpm *= 2;
  while (bpm > 185) bpm /= 2;
  return Math.round(bpm);
}

function detectKey(chroma: Float32Array): { key: string; minor: boolean; confidence: number } {
  let best = { key: 'C', minor: false, score: -Infinity, second: -Infinity };
  for (let rot = 0; rot < 12; rot++) {
    for (const minor of [false, true]) {
      const profile = minor ? MINOR_PROFILE : MAJOR_PROFILE;
      let score = 0;
      for (let i = 0; i < 12; i++) score += chroma[(rot + i) % 12] * profile[i];
      if (score > best.score) {
        best = { key: KEYS[rot], minor, score, second: best.score };
      } else if (score > best.second) {
        best.second = score;
      }
    }
  }
  const confidence = best.second > 0 ? Math.min(1, (best.score - best.second) / best.score + 0.5) : 0.5;
  return { key: best.key, minor: best.minor, confidence };
}

function countOnsets(flux: Float32Array): number {
  if (flux.length === 0) return 0;
  const sorted = [...flux].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const threshold = median * 1.6;
  let count = 0;
  for (let i = 1; i + 1 < flux.length; i++) {
    if (flux[i] > threshold && flux[i] > flux[i - 1] && flux[i] >= flux[i + 1]) count++;
  }
  return count;
}

/** Rough per-bar chord guesses (display only). */
function guessChords(mono: Float32Array, sr: number, bpm: number, key: string, minor: boolean): string[] {
  const barSec = (60 / bpm) * 4;
  const barSamples = Math.floor(barSec * sr);
  const bars = Math.min(8, Math.floor(mono.length / Math.max(1, barSamples)));
  const out: string[] = [];
  const frameSize = 4096;
  for (let b = 0; b < bars; b++) {
    const chroma = new Float32Array(12);
    const start = b * barSamples;
    const re = new Float32Array(frameSize);
    const im = new Float32Array(frameSize);
    const window = hann(frameSize);
    for (let off = start; off + frameSize < start + barSamples && off + frameSize < mono.length; off += frameSize) {
      for (let i = 0; i < frameSize; i++) {
        re[i] = mono[off + i] * window[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let i = 2; i < frameSize / 2; i++) {
        const freq = (i * sr) / frameSize;
        if (freq < 60 || freq > 1200) continue;
        const midi = 69 + 12 * Math.log2(freq / 440);
        const pc = ((Math.round(midi) % 12) + 12) % 12;
        chroma[pc] += Math.hypot(re[i], im[i]);
      }
    }
    // best triad match
    let bestName = '';
    let bestScore = -Infinity;
    for (let root = 0; root < 12; root++) {
      for (const [name, ivs] of [
        ['', [0, 4, 7]],
        ['m', [0, 3, 7]],
      ] as [string, number[]][]) {
        let s = 0;
        for (const iv of ivs) s += chroma[(root + iv) % 12];
        if (s > bestScore) {
          bestScore = s;
          bestName = KEYS[root] + name;
        }
      }
    }
    out.push(bestName);
  }
  return out;
}

function yieldToUi(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}
