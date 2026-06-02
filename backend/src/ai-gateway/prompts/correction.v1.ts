export const VERSION = 'correction.v1';
export const MODEL = 'claude-3-haiku';

export interface CorrectionPromptInput {
  studentText: string;
  expectedText?: string;
  cefrLevel: string;
  nativeLanguage: string;
  exerciseType: string;
}

export function buildCorrectionPrompt(input: CorrectionPromptInput): string {
  return `You are an English language teacher correcting a ${input.cefrLevel} level student whose native language is ${input.nativeLanguage}.

Student wrote/said: "${input.studentText}"
${input.expectedText ? `Expected (if applicable): "${input.expectedText}"` : ''}
Exercise type: ${input.exerciseType}

Analyze the student's text for errors. For each error, provide:
1. What they said wrong
2. The correct version
3. A simple explanation (max 2 sentences)
4. An alternative natural phrasing

Categories to check:
- Grammar (tenses, articles, prepositions, subject-verb agreement)
- Vocabulary (wrong word choice, collocation)
- Pronunciation-related spelling errors (for ${input.nativeLanguage} speakers)
- Word order

Output JSON:
{
  "corrected": "the fully corrected version of their text",
  "errors": [
    {
      "incorrect": "the error substring",
      "correct": "the correction",
      "explanation": "simple explanation why",
      "category": "grammar|vocabulary|word_order|spelling",
      "alternatives": ["alternative way to phrase it"]
    }
  ],
  "overallScore": 0-100,
  "praise": "one encouraging sentence about what they did well"
}

If no errors, return empty errors array and score of 100.`;
}
