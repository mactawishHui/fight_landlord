import { PlayerId } from '../types';

/**
 * Compute per-player score delta for a finished round.
 *
 * Rules:
 *   finalScore = baseScore × multiplier
 *   Landlord wins → landlord +2×finalScore, each farmer −finalScore
 *   Farmers win   → landlord −2×finalScore, each farmer +finalScore
 */
export function computeScore(
  winner: PlayerId,
  landlord: PlayerId,
  baseScore: number,
  multiplier: number,
): Record<PlayerId, number> {
  const finalScore = baseScore * multiplier;
  const isLandlordWin = winner === landlord;
  const all: PlayerId[] = ['human', 'ai1', 'ai2'];

  const delta: Record<PlayerId, number> = { human: 0, ai1: 0, ai2: 0 };
  for (const id of all) {
    if (id === landlord) {
      delta[id] = isLandlordWin ? finalScore * 2 : -finalScore * 2;
    } else {
      delta[id] = isLandlordWin ? -finalScore : finalScore;
    }
  }
  return delta;
}
