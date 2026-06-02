export const VERSION = 'lesson.v1';
export const MODEL = 'claude-3-sonnet';

export interface LessonPromptInput {
  name: string;
  age: number;
  nativeLanguage: string;
  cefrLevel: string;
  weakAreas: string[];
  learningGoal: string;
  vocabularyLearned: string[];
  dailyStudyMin: number;
}

export function buildLessonPrompt(input: LessonPromptInput): string {
  return `You are a language teacher creating a 15-minute English lesson for a ${input.age}-year-old ${input.nativeLanguage} speaker.

Student name: ${input.name}
Student level: ${input.cefrLevel}
Student's weak areas: ${input.weakAreas.join(', ')}
Goal: ${input.learningGoal}
Known vocabulary: ${input.vocabularyLearned.join(', ')}
Daily study time: ${input.dailyStudyMin} minutes

Create a lesson with exactly 6 exercises:

1. A short listening dialogue (4-6 lines about daily life) with 2 multiple-choice comprehension questions
2. A speaking exercise: ask the student to repeat a key sentence from the dialogue
3. A vocabulary exercise: match 3 new words (CEFR-appropriate) to their definitions
4. A grammar exercise: fill-in-the-blank targeting one grammar point appropriate for ${input.cefrLevel} level
5. A pronunciation exercise: minimal pairs focusing on sounds difficult for ${input.nativeLanguage} speakers learning English
6. A short conversation prompt to practice a real-world scenario

Output ONLY valid JSON with this exact structure:
{
  "title": "string",
  "cefrLevel": "${input.cefrLevel}",
  "dialogue": { "speakers": ["string"], "lines": ["string"], "audioScript": "string" },
  "exercises": [
    { "id": 1, "type": "listening", "question": "string", "options": ["string"], "correctIndex": 0 },
    { "id": 2, "type": "speaking", "prompt": "string", "referenceText": "string" },
    { "id": 3, "type": "vocabulary", "question": "string", "words": [{"word": "string", "definition": "string"}], "matches": [{"word": "string", "correctDefinition": "string"}] },
    { "id": 4, "type": "grammar", "question": "string", "sentence": "string", "correctAnswer": "string", "options": ["string"] },
    { "id": 5, "type": "pronunciation", "prompt": "string", "minimalPairs": [{"word1": "string", "word2": "string"}] },
    { "id": 6, "type": "conversation", "scenario": "string", "prompt": "string" }
  ],
  "vocabulary": [{"word": "string", "meaning": "string", "example": "string"}],
  "grammarFocus": "string"
}

IMPORTANT: Use only ${input.cefrLevel} level vocabulary. Make content relevant to ${input.learningGoal}. Response must be valid JSON only, no markdown.`;
}
