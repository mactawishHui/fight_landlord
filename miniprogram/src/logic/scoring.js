/**
 * Compute per-player score delta for a finished round.
 * Landlord wins → landlord +2×final, each farmer −final
 * Farmers win   → landlord −2×final, each farmer +final
 *
 * Works with arbitrary player ID arrays (3-player).
 */
export function computeScore(winner, landlord, baseScore, multiplier, playerIds) {
  const finalScore = baseScore * multiplier;
  const isLandlordWin = winner === landlord;
  const ids = playerIds || ['human', 'ai1', 'ai2'];
  const delta = {};
  for (const id of ids) {
    if (id === landlord) {
      delta[id] = isLandlordWin ? finalScore * 2 : -finalScore * 2;
    } else {
      delta[id] = isLandlordWin ? -finalScore : finalScore;
    }
  }
  return delta;
}
