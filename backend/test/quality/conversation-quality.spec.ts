import { evaluateConversation, ConversationEvaluation } from '../rubrics/conversation-quality-rubric';
import { CONVERSATION_TEST_CASES, SCENARIO_COVERAGE_REQUIRED } from '../datasets/conversation-test-cases';

describe('Conversation Quality Evaluation', () => {
  describe('Rubric — evaluateConversation', () => {
    it('should pass a valid conversation response', () => {
      const response = {
        response: 'Hello! Welcome to our restaurant. Would you like to see the menu?',
        corrections: [],
        score: 85,
      };

      const result: ConversationEvaluation = evaluateConversation(response, 'ordering-food', 'Hello');
      expect(result.scores.overall).toBeGreaterThanOrEqual(70);
      expect(result.issues.length).toBe(0);
      expect(result.responseProvided).toBe(true);
      expect(result.scoreInRange).toBe(true);
    });

    it('should flag missing response text', () => {
      const response = { corrections: [], score: 50 };
      const result = evaluateConversation(response, 'ordering-food', 'Hi');
      expect(result.issues).toContain('No response text provided');
      expect(result.responseProvided).toBe(false);
    });

    it('should flag score out of range', () => {
      const response = {
        response: 'Hello',
        corrections: [],
        score: 150,
      };
      const result = evaluateConversation(response, 'ordering-food', 'Hi');
      expect(result.issues.some((i) => i.includes('Score'))).toBe(true);
      expect(result.scoreInRange).toBe(false);
    });

    it('should flag blocked content', () => {
      const response = {
        response: 'This contains violent content',
        corrections: [],
        score: 50,
      };
      const result = evaluateConversation(response, 'ordering-food', 'Hi');
      expect(result.noBlockedContent).toBe(false);
    });
  });

  describe('Scenario Coverage', () => {
    it('should cover all required conversation scenarios', () => {
      const coveredScenarios = new Set(CONVERSATION_TEST_CASES.map((tc) => tc.scenario));
      for (const required of SCENARIO_COVERAGE_REQUIRED) {
        expect(coveredScenarios.has(required)).toBe(true);
      }
    });

    it('should have at least one test per CEFR level', () => {
      const levels = new Set(CONVERSATION_TEST_CASES.map((tc) => tc.cefrLevel));
      expect(levels.has('A1')).toBe(true);
      expect(levels.has('A2')).toBe(true);
      expect(levels.has('B1')).toBe(true);
    });

    it('should specify reasonable response length bounds', () => {
      for (const tc of CONVERSATION_TEST_CASES) {
        expect(tc.minResponseWords).toBeGreaterThan(0);
        expect(tc.maxResponseWords).toBeGreaterThan(tc.minResponseWords);
        expect(tc.maxResponseWords).toBeLessThanOrEqual(100);
      }
    });
  });
});
