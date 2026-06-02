export interface ConversationEvaluation {
  responseProvided: boolean;
  responseLength: number;
  correctionsFormat: boolean;
  scoreInRange: boolean;
  noBlockedContent: boolean;
  appropriateLength: boolean;
  scores: {
    relevance: number;
    grammarHelpfulness: number;
    encouragementLevel: number;
    overall: number;
  };
  issues: string[];
}

const MAX_RESPONSE_LENGTH = 1000;
const BLOCKED_PATTERNS = /(violen|kill|hate|racist|explicit|sexual|drugs)/i;

export function evaluateConversation(
  content: any,
  _scenario: string,
  _userText: string,
): ConversationEvaluation {
  const issues: string[] = [];

  const responseProvided = typeof content.response === 'string' && content.response.length > 0;
  if (!responseProvided) issues.push('No response text provided');

  const responseLength = content.response?.length || 0;
  if (responseLength > MAX_RESPONSE_LENGTH) issues.push(`Response too long: ${responseLength} chars`);

  const appropriateLength = responseLength <= MAX_RESPONSE_LENGTH;
  const noBlockedContent = !BLOCKED_PATTERNS.test(JSON.stringify(content));
  if (!noBlockedContent) issues.push('Response contains blocked content');

  const correctionsFormat = !content.corrections || Array.isArray(content.corrections);
  if (!correctionsFormat) issues.push('Corrections is not an array');

  const scoreInRange = typeof content.score === 'number' && content.score >= 0 && content.score <= 100;
  if (!scoreInRange) issues.push(`Score out of range: ${content.score}`);

  const relevance = responseProvided ? 90 : 0;
  const grammarHelpfulness = Array.isArray(content.corrections) && content.corrections.length > 0 ? 85 : 60;
  const encouragementLevel = scoreInRange && content.score >= 50 ? 80 : 50;
  const overall = Math.round((relevance + grammarHelpfulness + encouragementLevel) / 3);

  return {
    responseProvided,
    responseLength,
    correctionsFormat,
    scoreInRange,
    noBlockedContent,
    appropriateLength,
    scores: { relevance, grammarHelpfulness, encouragementLevel, overall },
    issues,
  };
}
