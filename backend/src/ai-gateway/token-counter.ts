export function countTokens(text: string): number {
  return Math.ceil(text.length * 0.4);
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const PRICING: Record<string, { input: number; output: number }> = {
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    'claude-3-sonnet': { input: 3.0, output: 15.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4o': { input: 2.5, output: 10.0 },
  };

  const pricing = PRICING[model] || { input: 0, output: 0 };
  const inputCost = (inputTokens * pricing.input) / 1_000_000;
  const outputCost = (outputTokens * pricing.output) / 1_000_000;
  return (inputCost + outputCost) * 100;
}
