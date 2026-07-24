/** Seeded pack-name generator: "<Adjective> <Noun> <number>". */

import { mulberry32, pick } from './rng.js';

const MOOD_ADJECTIVES: Record<string, string[]> = {
  dark: ['Midnight', 'Shadow', 'Obsidian', 'Eclipse', 'Phantom', 'Onyx', 'Nocturne', 'Raven'],
  sad: ['Fading', 'Lonely', 'Rainy', 'Hollow', 'Winter', 'Grey', 'Distant', 'Silent'],
  emotional: ['Aching', 'Tender', 'Golden', 'Longing', 'Deep', 'Honest', 'Open', 'Bare'],
  chill: ['Velvet', 'Smooth', 'Lazy', 'Cool', 'Mellow', 'Drifting', 'Easy', 'Soft'],
  warm: ['Amber', 'Honey', 'Sunset', 'Cozy', 'Glowing', 'Copper', 'Ember', 'Maple'],
  dreamy: ['Floating', 'Lucid', 'Hazy', 'Cloud', 'Aurora', 'Pastel', 'Weightless', 'Misty'],
  romantic: ['Crimson', 'Rose', 'Candlelit', 'Silk', 'Blushing', 'Moonlit', 'Sweet', 'Velour'],
  nostalgic: ['Polaroid', 'Vintage', 'Faded', 'Cassette', 'Summer', 'Yearbook', 'Retro', 'Sepia'],
  uplifting: ['Rising', 'Radiant', 'Skyline', 'Soaring', 'Bright', 'Ascending', 'Shining', 'Open'],
  happy: ['Sunny', 'Bouncing', 'Candy', 'Smiling', 'Vivid', 'Cheerful', 'Sparkling', 'Fresh'],
  energetic: ['Electric', 'Turbo', 'Blazing', 'Kinetic', 'Voltage', 'Ignition', 'Charged', 'Racing'],
  aggressive: ['Savage', 'Ruthless', 'Iron', 'Venom', 'Brutal', 'Feral', 'Riot', 'Warpath'],
  mysterious: ['Cryptic', 'Veiled', 'Enigma', 'Occult', 'Labyrinth', 'Masked', 'Arcane', 'Cipher'],
  epic: ['Titan', 'Colossal', 'Thunder', 'Olympus', 'Monolith', 'Empire', 'Horizon', 'Summit'],
};

const NOUNS = [
  'Motion', 'Echo', 'Pulse', 'Drift', 'Bloom', 'Circuit', 'Mirage', 'Signal',
  'Groove', 'Wave', 'Ritual', 'Vision', 'Static', 'Season', 'Voyage', 'Ember',
  'Tide', 'Fable', 'Prism', 'Avenue', 'Garden', 'Machine', 'Memory', 'Canyon',
  'Skyline', 'Lantern', 'Harbor', 'Meadow', 'Comet', 'Mosaic', 'Tempest', 'Anthem',
];

export function generatePackName(seed: number, mood: string, index: number): string {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const adjectives = MOOD_ADJECTIVES[mood] ?? NOUNS;
  const adj = pick(rng, adjectives);
  const noun = pick(rng, NOUNS);
  const num = String(index).padStart(3, '0');
  return `${adj} ${noun} ${num}`;
}
