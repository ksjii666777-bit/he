export interface PronunciationEvaluation {
  overallScoreInRange: boolean;
  subScoresInRange: boolean;
  wordScoresPresent: boolean;
  feedbackProvided: boolean;
  scoresMatch: boolean;
  scores: {
    accuracy: number;
    completeness: number;
    feedbackRelevance: number;
    overall: number;
  };
  issues: string[];
}

export function evaluatePronunciation(
  result: any,
): PronunciationEvaluation {
  const issues: string[] = [];

  const overallScoreInRange = typeof result.overallScore === 'number' && result.overallScore >= 0 && result.overallScore <= 100;
  if (!overallScoreInRange) issues.push(`Overall score out of range: ${result.overallScore}`);

  const subScoresInRange =
    typeof result.fluencyScore === 'number' && result.fluencyScore >= 0 && result.fluencyScore <= 100 &&
    typeof result.accuracyScore === 'number' && result.accuracyScore >= 0 && result.accuracyScore <= 100;
  if (!subScoresInRange) issues.push('Sub-scores out of range');

  const wordScoresPresent = Array.isArray(result.wordScores) && result.wordScores.length > 0;
  if (!wordScoresPresent) issues.push('No word-level scores');

  if (wordScoresPresent) {
    const allInRange = result.wordScores.every(
      (w: any) => typeof w.score === 'number' && w.score >= 0 && w.score <= 100,
    );
    if (!allInRange) issues.push('Some word scores out of range');
  }

  const feedbackProvided = Array.isArray(result.feedback) && result.feedback.length > 0;
  if (!feedbackProvided) issues.push('No feedback provided');

  const scoresMatch = result.overallScore === Math.round(
    (result.fluencyScore || 0) * 0.4 + (result.accuracyScore || 0) * 0.6,
  );
  if (!scoresMatch) issues.push('Overall score does not match weighted sub-scores');

  const accuracy = overallScoreInRange ? 90 : 0;
  const completeness = subScoresInRange && wordScoresPresent ? 90 : 40;
  const feedbackRelevance = feedbackProvided ? 85 : 0;
  const overall = Math.round((accuracy + completeness + feedbackRelevance) / 3);

  return {
    overallScoreInRange,
    subScoresInRange,
    wordScoresPresent,
    feedbackProvided,
    scoresMatch,
    scores: { accuracy, completeness, feedbackRelevance, overall },
    issues,
  };
}
