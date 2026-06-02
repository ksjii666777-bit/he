import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContentValidator } from '../../src/ai-gateway/validators/content-validator';

describe('ContentValidator — Edge Cases & Recovery', () => {
  let validator: ContentValidator;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentValidator,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    validator = module.get<ContentValidator>(ContentValidator);
  });

  describe('Malformed Inputs', () => {
    it('should reject null lesson content', () => {
      const result = validator.validateLesson(null);
      expect(result.passed).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.requiresHumanReview).toBe(true);
    });

    it('should reject undefined lesson content', () => {
      const result = validator.validateLesson(undefined);
      expect(result.passed).toBe(false);
    });

    it('should reject non-object lesson content', () => {
      const result = validator.validateLesson('just a string');
      expect(result.passed).toBe(false);
    });

    it('should handle missing exercises array', () => {
      const result = validator.validateLesson({ title: 'Test' });
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.field === 'exercises')).toBe(true);
    });

    it('should handle empty exercises array', () => {
      const result = validator.validateLesson({ title: 'Test', exercises: [], vocabulary: [], grammarFocus: '' });
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.description.includes('Exercises array is empty'))).toBe(true);
    });
  });

  describe('Safety Filter', () => {
    it('should block violent content', () => {
      const result = validator.validateConversation({
        response: 'You should kill the enemy',
        corrections: [],
        score: 50,
      });
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.type === 'safety_content')).toBe(true);
    });

    it('should block hate speech', () => {
      const result = validator.validateConversation({
        response: 'That is a racist comment',
        corrections: [],
        score: 50,
      });
      expect(result.passed).toBe(false);
    });

    it('should pass clean content', () => {
      const result = validator.validateConversation({
        response: 'That is a great question! Let me help you.',
        corrections: [],
        score: 95,
      });
      expect(result.passed).toBe(true);
    });
  });

  describe('Confidence Scoring', () => {
    it('should return low confidence for critical errors', () => {
      const result = validator.validateLesson(null);
      expect(result.confidence).toBe(0);
    });

    it('should reduce confidence for medium severity errors', () => {
      const result = validator.validateLesson({
        title: 'Valid',
        cefrLevel: 'A1',
        exercises: [
          { id: 1, type: 'listening', question: 'Q?', options: ['A', 'B'], correctIndex: 0 },
          { id: 2, type: 'speaking', prompt: 'Say', referenceText: 'text' },
          { id: 3, type: 'vocabulary', question: 'Match', words: [{ word: 'a', definition: 'b' }], matches: [{ word: 'a', correctDefinition: 'b' }] },
          { id: 4, type: 'grammar', question: 'Fill', sentence: 't', correctAnswer: 'a', options: ['a', 'b'] },
        ],
        vocabulary: [{ word: 't', meaning: 't', example: 't' }],
        grammarFocus: 'test',
      });

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(100);
    });

    it('should return high confidence for perfect content', () => {
      const result = validator.validateLesson({
        title: 'Perfect Lesson',
        cefrLevel: 'A1',
        dialogue: { speakers: ['A'], lines: ['Hi'], audioScript: 'script' },
        exercises: [
          { id: 1, type: 'listening', question: 'Q?', options: ['A', 'B'], correctIndex: 0 },
          { id: 2, type: 'speaking', prompt: 'Say', referenceText: 'text', question: 'Say the word' },
          { id: 3, type: 'vocabulary', question: 'Match', words: [{ word: 'a', definition: 'b' }], matches: [{ word: 'a', correctDefinition: 'b' }] },
          { id: 4, type: 'grammar', question: 'Fill', sentence: 't', correctAnswer: 'a', options: ['a', 'b'] },
          { id: 5, type: 'pronunciation', prompt: 'Say', minimalPairs: [{ word1: 'a', word2: 'b' }], question: 'Pronounce this' },
          { id: 6, type: 'conversation', scenario: 'test', prompt: 'test', question: 'Respond to the scenario' },
        ],
        vocabulary: [{ word: 't', meaning: 't', example: 't' }],
        grammarFocus: 'test',
      });

      expect(result.confidence).toBe(100);
      expect(result.passed).toBe(true);
    });
  });

  describe('Assessment Validation', () => {
    it('should reject assessment without questions', () => {
      const result = validator.validateAssessment({});
      expect(result.passed).toBe(false);
    });

    it('should pass assessment with valid questions', () => {
      const result = validator.validateAssessment({
        questions: [
          { id: 1, text: 'Q1', options: ['A', 'B'], correctIndex: 0 },
          { id: 2, text: 'Q2', options: ['C', 'D'], correctIndex: 1 },
        ],
      });
      expect(result.passed).toBe(true);
    });
  });
});
