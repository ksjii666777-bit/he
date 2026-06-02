export interface ConversationTestCase {
  name: string;
  scenario: string;
  level: number;
  cefrLevel: string;
  nativeLanguage: string;
  userMessages: string[];
  expectedCorrections: boolean;
  minResponseWords: number;
  maxResponseWords: number;
}

export const CONVERSATION_TEST_CASES: ConversationTestCase[] = [
  {
    name: 'Ordering food — A1',
    scenario: 'ordering-food',
    level: 1,
    cefrLevel: 'A1',
    nativeLanguage: 'hi',
    userMessages: [
      'Hello, I want burger please',
      'How much cost?',
      'I want water also',
    ],
    expectedCorrections: false,
    minResponseWords: 3,
    maxResponseWords: 40,
  },
  {
    name: 'Introducing self — A2',
    scenario: 'introducing-self',
    level: 2,
    cefrLevel: 'A2',
    nativeLanguage: 'es',
    userMessages: [
      'Hi, my name is Maria',
      'I am from Spain',
      'I like music and sports',
    ],
    expectedCorrections: false,
    minResponseWords: 3,
    maxResponseWords: 50,
  },
  {
    name: 'Asking directions — A1',
    scenario: 'asking-directions',
    level: 1,
    cefrLevel: 'A1',
    nativeLanguage: 'fr',
    userMessages: [
      'Excuse me, where is station?',
      'Is it far from here?',
      'Thank you very much',
    ],
    expectedCorrections: false,
    minResponseWords: 3,
    maxResponseWords: 40,
  },
  {
    name: 'Shopping — A2',
    scenario: 'shopping',
    level: 2,
    cefrLevel: 'A2',
    nativeLanguage: 'zh',
    userMessages: [
      'Hello, I looking for a gift',
      'It is for my mother birthday',
      'How about this blue scarf?',
    ],
    expectedCorrections: true,
    minResponseWords: 3,
    maxResponseWords: 50,
  },
  {
    name: 'Small talk — B1',
    scenario: 'small-talk',
    level: 3,
    cefrLevel: 'B1',
    nativeLanguage: 'de',
    userMessages: [
      'Hi, how are you today?',
      'I had a busy week at work',
      'The weather has been nice lately',
    ],
    expectedCorrections: false,
    minResponseWords: 5,
    maxResponseWords: 60,
  },
  {
    name: 'Making appointment — B1',
    scenario: 'making-appointment',
    level: 3,
    cefrLevel: 'B1',
    nativeLanguage: 'hi',
    userMessages: [
      'I need to see the doctor',
      'Is Friday available?',
      'What time should I come?',
    ],
    expectedCorrections: false,
    minResponseWords: 3,
    maxResponseWords: 50,
  },
  {
    name: 'Hotel check-in — A2',
    scenario: 'hotel-checkin',
    level: 2,
    cefrLevel: 'A2',
    nativeLanguage: 'es',
    userMessages: [
      'I have a reservation',
      'What room am I in?',
      'What time is breakfast?',
    ],
    expectedCorrections: false,
    minResponseWords: 3,
    maxResponseWords: 50,
  },
  {
    name: 'Job interview — B1',
    scenario: 'job-interview',
    level: 3,
    cefrLevel: 'B1',
    nativeLanguage: 'fr',
    userMessages: [
      'I am here for the interview',
      'I have five years experience',
      'I am very interested in this role',
    ],
    expectedCorrections: false,
    minResponseWords: 3,
    maxResponseWords: 60,
  },
  {
    name: 'Emergency — A2',
    scenario: 'emergency',
    level: 2,
    cefrLevel: 'A2',
    nativeLanguage: 'zh',
    userMessages: [
      'Help! I need an ambulance',
      'My friend is hurt',
      'The address is 123 Main Street',
    ],
    expectedCorrections: false,
    minResponseWords: 2,
    maxResponseWords: 40,
  },
];

export const SCENARIO_COVERAGE_REQUIRED = [
  'ordering-food',
  'introducing-self',
  'asking-directions',
  'shopping',
  'making-appointment',
  'small-talk',
  'hotel-checkin',
  'job-interview',
  'emergency',
];
