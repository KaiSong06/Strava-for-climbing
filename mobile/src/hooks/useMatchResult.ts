// TODO Phase 4b: handle ≥0.92 auto-match / 0.75–0.91 confirm / <0.75 new problem
export function useMatchResult() {
  return {
    matchedProblem: null as null,
    confidence: null as null,
    needsConfirmation: false,
  };
}
