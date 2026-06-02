import { evaluateLesson, LessonEvaluation } from '../rubrics/lesson-quality-rubric';
import { LESSON_TEST_CASES } from '../datasets/lesson-test-cases';

describe('Lesson Quality Evaluation', () => {
  describe('Rubric — evaluateLesson', () => {
    it('should pass a valid lesson with all required fields', () => {
      const lesson = {
        title: 'Daily Practice — A1',
        cefrLevel: 'A1',
        dialogue: { speakers: ['Alice', 'Bob'], lines: ['Hi', 'Hello'], audioScript: 'dialog' },
        exercises: [
          { id: 1, type: 'listening', question: 'What did Alice say?', options: ['Hi', 'Bye'], correctIndex: 0 },
          { id: 2, type: 'speaking', prompt: 'Repeat', referenceText: 'Hello', question: 'Repeat after me' },
          { id: 3, type: 'vocabulary', question: 'Match', words: [{ word: 'hello', definition: 'greeting' }], matches: [] },
          { id: 4, type: 'grammar', question: 'Fill in', sentence: 'I ___ a student', correctAnswer: 'am', options: ['am', 'is'] },
          { id: 5, type: 'pronunciation', prompt: 'Say', minimalPairs: [{ word1: 'ship', word2: 'sheep' }], question: 'Pronounce the minimal pairs' },
          { id: 6, type: 'conversation', scenario: 'Greet', prompt: 'Say hello', question: 'How would you greet someone?' },
        ],
        vocabulary: [
          { word: 'hello', meaning: 'greeting', example: 'Hello!' },
          { word: 'world', meaning: 'earth', example: 'The world is big!' },
          { word: 'goodbye', meaning: 'farewell', example: 'Goodbye, friend!' },
        ],
        grammarFocus: 'Present simple',
      };

      const result: LessonEvaluation = evaluateLesson(lesson, 'A1', 'hi');
      expect(result.scores.overall).toBeGreaterThanOrEqual(70);
      expect(result.issues.length).toBe(0);
      expect(result.exerciseCount).toBe(6);
      expect(result.exerciseTypes).toContain('listening');
      expect(result.exerciseTypes).toContain('speaking');
    });

    it('should flag missing dialogue', () => {
      const lesson = {
        title: 'Test',
        cefrLevel: 'A1',
        exercises: [
          { id: 1, type: 'listening', question: 'Q?', options: ['A', 'B'], correctIndex: 0 },
          { id: 2, type: 'speaking', prompt: 'Say it', referenceText: 'text' },
          { id: 3, type: 'vocabulary', question: 'Match', words: [], matches: [] },
          { id: 4, type: 'grammar', question: 'Fill', sentence: 'test', correctAnswer: 'a', options: ['a'] },
          { id: 5, type: 'pronunciation', prompt: 'Say', minimalPairs: [] },
          { id: 6, type: 'conversation', scenario: 'test', prompt: 'test' },
        ],
        vocabulary: [{ word: 'test', meaning: 'test', example: 'test' }],
      };

      const result = evaluateLesson(lesson, 'A1', 'en');
      expect(result.issues).toContain('Missing dialogue section');
      expect(result.hasDialogue).toBe(false);
      expect(result.scores.overall).toBeLessThan(80);
    });

    it('should flag CEFR level mismatch', () => {
      const lesson = {
        title: 'Test',
        cefrLevel: 'B2',
        exercises: [
          { id: 1, type: 'listening', question: 'Q?', options: ['A', 'B'], correctIndex: 0 },
          { id: 2, type: 'speaking', prompt: 'Say', referenceText: 'text' },
          { id: 3, type: 'vocabulary', question: 'Match', words: [], matches: [] },
          { id: 4, type: 'grammar', question: 'Fill', sentence: 't', correctAnswer: 'a', options: ['a', 'b'] },
          { id: 5, type: 'pronunciation', prompt: 'Say', minimalPairs: [] },
          { id: 6, type: 'conversation', scenario: 't', prompt: 't' },
        ],
        vocabulary: [{ word: 't', meaning: 't', example: 't' }],
        grammarFocus: 'test',
      };

      const result = evaluateLesson(lesson, 'A1', 'en');
      expect(result.cefrAligned).toBe(false);
      expect(result.issues.some((i) => i.includes('CEFR'))).toBe(true);
    });
  });

  describe('Test Datasets', () => {
    it('should have test cases for all target CEFR levels', () => {
      const levels = new Set(LESSON_TEST_CASES.map((tc) => tc.cefrLevel));
      expect(levels.has('A1')).toBe(true);
      expect(levels.has('A2')).toBe(true);
      expect(levels.has('B1')).toBe(true);
    });

    it('should have test cases for all target native languages', () => {
      const languages = new Set(LESSON_TEST_CASES.map((tc) => tc.nativeLanguage));
      expect(languages.has('hi')).toBe(true);
      expect(languages.has('es')).toBe(true);
      expect(languages.has('fr')).toBe(true);
      expect(languages.has('zh')).toBe(true);
    });
  });
});
