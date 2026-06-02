import { evaluatePronunciation, PronunciationEvaluation } from '../rubrics/pronunciation-quality-rubric';
import { PRONUNCIATION_TEST_CASES } from '../datasets/pronunciation-test-cases';

describe('Pronunciation Quality Evaluation', () => {
  describe('Rubric — evaluatePronunciation', () => {
    it('should pass a valid pronunciation result', () => {
      const result = {
        overallScore: 76,
        fluencyScore: 70,
        accuracyScore: 80,
        wordScores: [
          { word: 'hello', score: 90, confidence: 0.9 },
          { word: 'world', score: 80, confidence: 0.8 },
        ],
        feedback: ['Great job!', 'Keep practicing'],
      };

      const evalResult: PronunciationEvaluation = evaluatePronunciation(result);
      expect(evalResult.scores.overall).toBeGreaterThanOrEqual(60);
      expect(evalResult.issues.length).toBe(0);
      expect(evalResult.overallScoreInRange).toBe(true);
      expect(evalResult.wordScoresPresent).toBe(true);
      expect(evalResult.feedbackProvided).toBe(true);
    });

    it('should flag missing word scores', () => {
      const result = {
        overallScore: 75,
        fluencyScore: 70,
        accuracyScore: 80,
        wordScores: [],
        feedback: ['Good'],
      };

      const evalResult = evaluatePronunciation(result);
      expect(evalResult.issues).toContain('No word-level scores');
      expect(evalResult.wordScoresPresent).toBe(false);
    });

    it('should flag missing feedback', () => {
      const result = {
        overallScore: 75,
        fluencyScore: 70,
        accuracyScore: 80,
        wordScores: [{ word: 'hello', score: 90, confidence: 0.9 }],
        feedback: [],
      };

      const evalResult = evaluatePronunciation(result);
      expect(evalResult.issues).toContain('No feedback provided');
      expect(evalResult.feedbackProvided).toBe(false);
    });

    it('should flag out-of-range scores', () => {
      const result = {
        overallScore: -5,
        fluencyScore: 70,
        accuracyScore: 80,
        wordScores: [{ word: 'hello', score: 90, confidence: 0.9 }],
        feedback: ['Good'],
      };

      const evalResult = evaluatePronunciation(result);
      expect(evalResult.overallScoreInRange).toBe(false);
    });
  });

  describe('Test Datasets', () => {
    it('should have test cases for all difficulty levels', () => {
      const difficulties = new Set(PRONUNCIATION_TEST_CASES.map((tc) => tc.difficulty));
      expect(difficulties.has('easy')).toBe(true);
      expect(difficulties.has('medium')).toBe(true);
      expect(difficulties.has('hard')).toBe(true);
    });

    it('should have test cases for all target languages', () => {
      const languages = new Set(PRONUNCIATION_TEST_CASES.map((tc) => tc.nativeLanguage));
      expect(languages.has('hi')).toBe(true);
      expect(languages.has('es')).toBe(true);
      expect(languages.has('zh')).toBe(true);
      expect(languages.has('fr')).toBe(true);
    });

    it('should have reasonable score bounds', () => {
      for (const tc of PRONUNCIATION_TEST_CASES) {
        expect(tc.expectedMinScore).toBeLessThan(tc.expectedMaxScore);
        expect(tc.expectedMinScore).toBeGreaterThanOrEqual(0);
        expect(tc.expectedMaxScore).toBeLessThanOrEqual(100);
      }
    });
  });
});
