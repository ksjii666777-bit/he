export interface LessonTestCase {
  name: string;
  cefrLevel: string;
  nativeLanguage: string;
  weakAreas: string[];
  expectedExerciseTypes: string[];
  minExercises: number;
  maxExercises: number;
  expectedVocabularyCount: number;
}

export const LESSON_TEST_CASES: LessonTestCase[] = [
  {
    name: 'A1 Beginner — Hindi speaker',
    cefrLevel: 'A1',
    nativeLanguage: 'hi',
    weakAreas: ['pronunciation', 'grammar'],
    expectedExerciseTypes: ['listening', 'speaking', 'vocabulary', 'grammar', 'pronunciation', 'conversation'],
    minExercises: 4,
    maxExercises: 8,
    expectedVocabularyCount: 3,
  },
  {
    name: 'A2 Elementary — Spanish speaker',
    cefrLevel: 'A2',
    nativeLanguage: 'es',
    weakAreas: ['vocabulary'],
    expectedExerciseTypes: ['listening', 'speaking', 'vocabulary', 'grammar', 'pronunciation', 'conversation'],
    minExercises: 4,
    maxExercises: 8,
    expectedVocabularyCount: 3,
  },
  {
    name: 'B1 Intermediate — French speaker',
    cefrLevel: 'B1',
    nativeLanguage: 'fr',
    weakAreas: ['grammar', 'word_order'],
    expectedExerciseTypes: ['listening', 'speaking', 'vocabulary', 'grammar', 'pronunciation', 'conversation'],
    minExercises: 4,
    maxExercises: 8,
    expectedVocabularyCount: 3,
  },
  {
    name: 'A1 Beginner — Chinese speaker',
    cefrLevel: 'A1',
    nativeLanguage: 'zh',
    weakAreas: ['pronunciation'],
    expectedExerciseTypes: ['listening', 'speaking', 'vocabulary', 'grammar', 'pronunciation', 'conversation'],
    minExercises: 4,
    maxExercises: 8,
    expectedVocabularyCount: 3,
  },
];

export function getLessonTestCase(cefr: string, native: string): LessonTestCase | undefined {
  return LESSON_TEST_CASES.find(
    (tc) => tc.cefrLevel === cefr && tc.nativeLanguage === native,
  );
}
