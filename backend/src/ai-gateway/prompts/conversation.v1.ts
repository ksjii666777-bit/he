export const VERSION = 'conversation.v1';
export const MODEL = 'claude-3-haiku';

export interface ConversationPromptInput {
  level: number;
  scenario: string;
  nativeLanguage: string;
  cefrLevel: string;
  recentErrors: string[];
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  userTurn: string;
}

const SCENARIO_CONTEXTS: Record<string, string> = {
  'ordering-food': 'You are a waiter at a restaurant. The student is a customer ordering food. Be patient and encouraging.',
  'introducing-self': 'You are meeting the student for the first time at a social event. Ask about their name, job, hobbies.',
  'asking-directions': 'You are a local resident. The student is asking for directions to a museum. Give clear, simple directions.',
  'shopping': 'You are a shop assistant. The student wants to buy a gift. Ask about preferences, price range, occasion.',
  'making-appointment': 'You are a receptionist at a clinic. The student needs to book an appointment. Ask about date, time, reason.',
  'small-talk': 'You are a colleague at work. Make small talk about weather, weekend plans, or lunch.',
  'hotel-checkin': 'You are a hotel front desk worker. The student is checking in. Ask for reservation details, ID, payment.',
  'job-interview': 'You are a friendly interviewer for an entry-level position. Ask about experience, skills, availability.',
  'emergency': 'You are a emergency dispatcher. The student needs help. Stay calm, ask clear questions about location and situation.',
};

export function buildConversationPrompt(input: ConversationPromptInput): string {
  const context = SCENARIO_CONTEXTS[input.scenario] || 'Have a natural conversation with the student.';

  const history = input.conversationHistory
    .map((m) => `${m.role === 'assistant' ? 'You' : 'Student'}: ${m.content}`)
    .join('\n');

  return `${context}

Student level: ${input.cefrLevel} (CEFR)
Native language: ${input.nativeLanguage}
Current level: ${input.level}
Scenario: ${input.scenario}

Recent errors the student makes: ${input.recentErrors.join(', ')}

Conversation so far:
${history}

Student just said: "${input.userTurn}"

Respond naturally. Keep your response under 3 sentences. Use simple vocabulary appropriate for ${input.cefrLevel} level.

If the student makes an error, gently correct it by repeating the correct version naturally in your response.

Output JSON:
{
  "response": "your reply here",
  "corrections": [
    {
      "incorrect": "what the student said wrong (if anything)",
      "correct": "the correct way to say it",
      "explanation": "brief grammar or vocabulary explanation"
    }
  ],
  "score": 0-100 (estimate of how correct the student's English was)
}

If no error, corrections should be an empty array.`;
}
