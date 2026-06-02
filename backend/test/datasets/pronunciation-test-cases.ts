export interface PronunciationTestCase {
  name: string;
  referenceText: string;
  expectedWords: string[];
  expectedMinScore: number;
  expectedMaxScore: number;
  nativeLanguage: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const PRONUNCIATION_TEST_CASES: PronunciationTestCase[] = [
  {
    name: 'Simple greeting',
    referenceText: 'Hello, how are you?',
    expectedWords: ['hello', 'how', 'are', 'you'],
    expectedMinScore: 50,
    expectedMaxScore: 100,
    nativeLanguage: 'hi',
    difficulty: 'easy',
  },
  {
    name: 'Common phrase',
    referenceText: 'I would like a cup of coffee',
    expectedWords: ['i', 'would', 'like', 'a', 'cup', 'of', 'coffee'],
    expectedMinScore: 40,
    expectedMaxScore: 100,
    nativeLanguage: 'es',
    difficulty: 'easy',
  },
  {
    name: 'Minimal pairs test',
    referenceText: 'The ship sailed from the port',
    expectedWords: ['the', 'ship', 'sailed', 'from', 'the', 'port'],
    expectedMinScore: 30,
    expectedMaxScore: 100,
    nativeLanguage: 'zh',
    difficulty: 'medium',
  },
  {
    name: 'Th-sounds test',
    referenceText: 'Think about the weather this Thursday',
    expectedWords: ['think', 'about', 'the', 'weather', 'this', 'thursday'],
    expectedMinScore: 20,
    expectedMaxScore: 100,
    nativeLanguage: 'fr',
    difficulty: 'hard',
  },
];
