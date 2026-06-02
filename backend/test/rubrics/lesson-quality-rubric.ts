export interface LessonEvaluation {
  exerciseCount: number;
  exerciseTypes: string[];
  cefrAligned: boolean;
  vocabularyMatched: boolean;
  hasDialogue: boolean;
  hasGrammarFocus: boolean;
  allExercisesHaveQuestions: boolean;
  noOffensiveContent: boolean;
  titleValid: boolean;
  scores: {
    exerciseVariety: number;
    cefrAlignment: number;
    contentQuality: number;
    instructionClarity: number;
    overall: number;
  };
  issues: string[];
}

const REQUIRED_EXERCISE_TYPES = ['listening', 'speaking', 'vocabulary', 'grammar', 'pronunciation', 'conversation'];
const VALID_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function evaluateLesson(
  content: any,
  expectedCefr: string,
  nativeLanguage: string,
): LessonEvaluation {
  const issues: string[] = [];
  const exercises = content.exercises || [];
  const exerciseTypes = exercises.map((e: any) => e.type);

  const exerciseCount = exercises.length;
  const typeVariety = new Set(exerciseTypes).size;

  const titleValid = typeof content.title === 'string' && content.title.length > 0 && content.title.length <= 200;
  if (!titleValid) issues.push('Invalid or missing title');

  const hasDialogue = !!content.dialogue && Array.isArray(content.dialogue.lines);
  if (!hasDialogue) issues.push('Missing dialogue section');

  const hasGrammarFocus = !!content.grammarFocus;
  if (!hasGrammarFocus) issues.push('Missing grammar focus');

  const cefrAligned = VALID_CEFR_LEVELS.includes(content.cefrLevel) && content.cefrLevel === expectedCefr;
  if (!cefrAligned) issues.push(`CEFR level mismatch: expected ${expectedCefr}, got ${content.cefrLevel}`);

  const vocabularyMatched = Array.isArray(content.vocabulary) && content.vocabulary.length >= 3;
  if (!vocabularyMatched) issues.push('Insufficient vocabulary items (< 3)');

  const allExercisesHaveQuestions = exercises.every((e: any) =>
    typeof e.question === 'string' && e.question.length > 0,
  );
  if (!allExercisesHaveQuestions) issues.push('Some exercises missing questions');

  const missingTypes = REQUIRED_EXERCISE_TYPES.filter((t) => !exerciseTypes.includes(t));
  if (missingTypes.length > 0) {
    issues.push(`Missing exercise types: ${missingTypes.join(', ')}`);
  }

  const noOffensiveContent = !JSON.stringify(content).match(/(violen|kill|hate|racist|explicit)/i);
  if (!noOffensiveContent) issues.push('Content contains blocked patterns');

  const exerciseVariety = Math.min(100, (typeVariety / 6) * 100);
  const cefrAlignment = cefrAligned ? 100 : 50;
  const contentQuality = allExercisesHaveQuestions ? 90 : 50;
  const instructionClarity = hasDialogue && hasGrammarFocus ? 90 : 60;
  const overall = Math.round((exerciseVariety + cefrAlignment + contentQuality + instructionClarity) / 4);

  return {
    exerciseCount,
    exerciseTypes,
    cefrAligned,
    vocabularyMatched,
    hasDialogue,
    hasGrammarFocus,
    allExercisesHaveQuestions,
    noOffensiveContent,
    titleValid,
    scores: { exerciseVariety, cefrAlignment, contentQuality, instructionClarity, overall },
    issues,
  };
}
