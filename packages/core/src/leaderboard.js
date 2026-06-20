const statusRank = {
  replicated: 4,
  promoted: 3,
  verified: 2,
  accepted: 1,
  local: 0
};

export function rankRuns(spec, runs) {
  const direction = spec.score.direction;
  return [...runs].sort((a, b) => {
    if (a.score !== b.score) {
      return direction === "minimize" ? a.score - b.score : b.score - a.score;
    }
    return (statusRank[b.status] ?? 0) - (statusRank[a.status] ?? 0);
  });
}
