import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  passed: boolean;
  confidence: number;
  errors: ValidationError[];
  requiresHumanReview: boolean;
}

export interface ValidationError {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  field?: string;
}

interface SafetyRule {
  blockedPatterns: RegExp[];
  blockedCategories: string[];
}

const SAFETY_RULES: SafetyRule = {
  blockedPatterns: [
    /\b(violen|kill(ing|er|ed)?|murder|die|death|hurt|pain)\b/i,
    /\b(hate|racist|slur)\b/i,
    /\b(naked|nudity|porn|explicit|sexual)\b/i,
    /\b(suicide|self[- ]harm|cutting)\b/i,
    /\b(drugs|cocaine|heroin|meth|weed)\b/i,
  ],
  blockedCategories: [
    'violence',
    'hate_speech',
    'sexual',
    'self_harm',
    'drugs',
  ],
};

@Injectable()
export class ContentValidator {
  private readonly logger = new Logger(ContentValidator.name);
  private readonly MAX_EXERCISES = 8;
  private readonly MIN_EXERCISES = 4;
  private readonly MAX_TITLE_LENGTH = 200;
  private readonly MAX_RESPONSE_LENGTH = 1000;

  validateLesson(content: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!content || typeof content !== 'object') {
      return this.fail('critical', 'Lesson content is not an object');
    }

    if (!content.title || typeof content.title !== 'string') {
      errors.push({
        type: 'schema_failure',
        severity: 'critical',
        description: 'Missing or invalid lesson title',
        field: 'title',
      });
    } else if (content.title.length > this.MAX_TITLE_LENGTH) {
      errors.push({
        type: 'schema_failure',
        severity: 'medium',
        description: 'Title exceeds maximum length',
        field: 'title',
      });
    }

    if (!Array.isArray(content.exercises)) {
      errors.push({
        type: 'schema_failure',
        severity: 'critical',
        description: 'Exercises must be an array',
        field: 'exercises',
      });
    } else {
      if (content.exercises.length === 0) {
        errors.push({
          type: 'schema_failure',
          severity: 'critical',
          description: 'Exercises array is empty',
          field: 'exercises',
        });
      } else if (
        content.exercises.length < this.MIN_EXERCISES ||
        content.exercises.length > this.MAX_EXERCISES
      ) {
        errors.push({
          type: 'schema_failure',
          severity: 'high',
          description: `Exercise count ${content.exercises.length} outside range ${this.MIN_EXERCISES}-${this.MAX_EXERCISES}`,
          field: 'exercises',
        });
      }

      const validTypes = [
        'listening',
        'speaking',
        'vocabulary',
        'grammar',
        'pronunciation',
        'conversation',
      ];
      for (let i = 0; i < content.exercises.length; i++) {
        const ex = content.exercises[i];
        if (!validTypes.includes(ex.type)) {
          errors.push({
            type: 'schema_failure',
            severity: 'high',
            description: `Invalid exercise type: ${ex.type}`,
            field: `exercises[${i}].type`,
          });
        }
        if (!ex.question || typeof ex.question !== 'string') {
          errors.push({
            type: 'schema_failure',
            severity: 'high',
            description: `Exercise ${i} missing question`,
            field: `exercises[${i}].question`,
          });
        }
      }
    }

    const safetyErrors = this.checkSafety(content);
    errors.push(...safetyErrors);

    if (Array.isArray(content.vocabulary)) {
      for (let i = 0; i < content.vocabulary.length; i++) {
        const v = content.vocabulary[i];
        if (!v.word || !v.meaning) {
          errors.push({
            type: 'schema_failure',
            severity: 'medium',
            description: `Vocabulary item ${i} missing word or meaning`,
            field: `vocabulary[${i}]`,
          });
        }
      }
    }

    return this.buildResult(errors);
  }

  validateConversation(content: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!content || typeof content !== 'object') {
      return this.fail('critical', 'Conversation response is not an object');
    }
    if (!content.response || typeof content.response !== 'string') {
      errors.push({
        type: 'schema_failure',
        severity: 'critical',
        description: 'Missing AI response text',
        field: 'response',
      });
    } else if (content.response.length > this.MAX_RESPONSE_LENGTH) {
      errors.push({
        type: 'schema_failure',
        severity: 'medium',
        description: 'Response exceeds maximum length',
        field: 'response',
      });
    }
    if (content.corrections && !Array.isArray(content.corrections)) {
      errors.push({
        type: 'schema_failure',
        severity: 'medium',
        description: 'Corrections must be an array',
        field: 'corrections',
      });
    }

    const safetyErrors = this.checkSafety(content);
    errors.push(...safetyErrors);

    return this.buildResult(errors);
  }

  validateAssessment(content: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!content || typeof content !== 'object') {
      return this.fail('critical', 'Assessment content is not an object');
    }
    if (!Array.isArray(content.questions) || content.questions.length === 0) {
      errors.push({
        type: 'schema_failure',
        severity: 'critical',
        description: 'Assessment must have questions array',
        field: 'questions',
      });
    }

    const safetyErrors = this.checkSafety(content);
    errors.push(...safetyErrors);

    return this.buildResult(errors);
  }

  validateCorrection(content: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!content || typeof content !== 'object') {
      return this.fail('critical', 'Correction is not an object');
    }
    if (!content.corrected || typeof content.corrected !== 'string') {
      errors.push({
        type: 'schema_failure',
        severity: 'critical',
        description: 'Missing corrected text',
        field: 'corrected',
      });
    }
    if (
      content.errors &&
      !Array.isArray(content.errors)
    ) {
      errors.push({
        type: 'schema_failure',
        severity: 'medium',
        description: 'Errors must be an array',
        field: 'errors',
      });
    }

    return this.buildResult(errors);
  }

  private checkSafety(content: any): ValidationError[] {
    const errors: ValidationError[] = [];
    const text = JSON.stringify(content || '');

    for (const pattern of SAFETY_RULES.blockedPatterns) {
      if (pattern.test(text)) {
        errors.push({
          type: 'safety_content',
          severity: 'critical',
          description: `Content matched blocked pattern: ${pattern}`,
        });
      }
    }

    return errors;
  }

  private fail(severity: 'critical', description: string): ValidationResult {
    return {
      passed: false,
      confidence: 0,
      errors: [
        { type: 'schema_failure', severity, description },
      ],
      requiresHumanReview: true,
    };
  }

  private buildResult(errors: ValidationError[]): ValidationResult {
    const criticalCount = errors.filter(
      (e) => e.severity === 'critical',
    ).length;
    const highCount = errors.filter((e) => e.severity === 'high').length;
    const mediumCount = errors.filter((e) => e.severity === 'medium').length;

    let confidence = 100;
    confidence -= criticalCount * 50;
    confidence -= highCount * 25;
    confidence -= mediumCount * 10;
    confidence = Math.max(0, confidence);

    return {
      passed: criticalCount === 0,
      confidence,
      errors,
      requiresHumanReview: highCount > 0 || criticalCount > 0,
    };
  }
}
