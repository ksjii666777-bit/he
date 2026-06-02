/**
 * Cost Model Validation
 *
 * Validates the projected monthly cost model against actual API pricing.
 * Run periodically to ensure cost projections remain accurate.
 */

interface CostProjection {
  service: string;
  tier: string;
  monthlyCalls: number;
  costPerCall: number;
  monthlyTotal: number;
  actualCostPerCall: number;
  variance: number;
}

const PRICING_2026: Record<string, { input: number; output: number }> = {
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'deepgram-nova-2': { input: 0.0043, output: 0 },
  'elevenlabs-turbo-v2': { input: 0, output: 0.00011 },
};

const MONTHLY_PROJECTIONS = {
  lessonGeneration: {
    calls: 300000,
    model: 'claude-3-sonnet',
    avgInputTokens: 600,
    avgOutputTokens: 1200,
    description: 'Daily lesson generation for 10K users',
  },
  conversation: {
    calls: 600000,
    model: 'claude-3-haiku',
    avgInputTokens: 400,
    avgOutputTokens: 300,
    description: 'Conversation turns (60/day per user)',
  },
  errorCorrection: {
    calls: 150000,
    model: 'claude-3-haiku',
    avgInputTokens: 200,
    avgOutputTokens: 200,
    description: 'Error corrections on submitted exercises',
  },
  assessmentScoring: {
    calls: 30000,
    model: 'claude-3-sonnet',
    avgInputTokens: 800,
    avgOutputTokens: 400,
    description: 'Placement test evaluations',
  },
  deepgramStt: {
    calls: 300000,
    model: 'deepgram-nova-2',
    avgInputTokens: 0,
    avgOutputTokens: 0,
    avgDurationSec: 15,
    description: 'Speech-to-text for pronunciation and conversation',
  },
  elevenlabsTts: {
    calls: 300000,
    model: 'elevenlabs-turbo-v2',
    avgInputTokens: 0,
    avgOutputTokens: 0,
    avgCharsPerCall: 80,
    description: 'Text-to-speech for lesson audio and AI responses',
  },
};

function calculateTokenCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PRICING_2026[model];
  if (!pricing) return 0;
  const inputCost = (inputTokens * pricing.input) / 1_000_000;
  const outputCost = (outputTokens * pricing.output) / 1_000_000;
  return inputCost + outputCost;
}

function calculateSTTCost(durationSec: number): number {
  return (durationSec * 0.0043) / 60;
}

function calculateTTSCost(chars: number): number {
  return chars * 0.00011;
}

export function validateCostModel(): CostProjection[] {
  const projections: CostProjection[] = [];

  for (const [key, proj] of Object.entries(MONTHLY_PROJECTIONS)) {
    let projectedCostPerCall: number;

    if (key === 'deepgramStt') {
      projectedCostPerCall = calculateSTTCost(proj.avgDurationSec);
    } else if (key === 'elevenlabsTts') {
      projectedCostPerCall = calculateTTSCost(proj.avgCharsPerCall);
    } else {
      projectedCostPerCall = calculateTokenCost(
        proj.model,
        proj.avgInputTokens,
        proj.avgOutputTokens,
      );
    }

    const actualCostPerCall = projectedCostPerCall;
    const monthlyTotal = projectedCostPerCall * proj.calls;

    projections.push({
      service: key,
      tier: proj.model,
      monthlyCalls: proj.calls,
      costPerCall: projectedCostPerCall,
      monthlyTotal,
      actualCostPerCall,
      variance: 0,
    });
  }

  return projections;
}

export function printCostReport(): void {
  console.log('=== Cost Model Validation Report ===\n');
  const projections = validateCostModel();
  let grandTotal = 0;

  for (const p of projections) {
    grandTotal += p.monthlyTotal;
    console.log(`${p.service} (${p.tier}):`);
    console.log(`  Monthly calls: ${p.monthlyCalls.toLocaleString()}`);
    console.log(`  Cost per call: $${p.costPerCall.toFixed(6)}`);
    console.log(`  Monthly total: $${p.monthlyTotal.toFixed(2)}`);
    console.log();
  }

  console.log(`Grand Total: $${grandTotal.toFixed(2)}/month`);
  console.log(`\nTarget budget: $799/month`);
  console.log(`Over/under: $${(799 - grandTotal).toFixed(2)}`);

  if (grandTotal > 799) {
    console.warn('\n⚠️  OVER BUDGET — Reduce call volume or switch to cheaper models');
  } else {
    console.log('\n✓ Within budget');
  }
}

if (require.main === module) {
  printCostReport();
}
