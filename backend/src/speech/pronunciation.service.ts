import { Injectable, Logger } from '@nestjs/common';
import { alignWords } from './word-aligner';

export interface PronunciationResult {
  overallScore: number;
  fluencyScore: number;
  accuracyScore: number;
  wordScores: { word: string; score: number; confidence: number }[];
  feedback: string[];
}

@Injectable()
export class PronunciationService {
  private readonly logger = new Logger(PronunciationService.name);

  score(
    referenceText: string,
    transcription: { text: string; confidence: number; words: { word: string; confidence: number }[] },
  ): PronunciationResult {
    const wordScores = this.alignAndScore(referenceText, transcription);
    const accuracyScore = this.calculateAccuracy(wordScores);
    const fluencyScore = this.calculateFluency(
      transcription.words.map((w: any) => ({ start: 0, end: 0, confidence: w.confidence })),
      referenceText.split(' ').length,
    );
    const overallScore = Math.round(
      accuracyScore * 0.6 + fluencyScore * 0.4,
    );

    return {
      overallScore,
      fluencyScore,
      accuracyScore,
      wordScores,
      feedback: this.generateFeedback(overallScore, accuracyScore, fluencyScore, wordScores),
    };
  }

  private alignAndScore(
    referenceText: string,
    transcription: { text: string; words: { word: string; confidence: number }[] },
  ): { word: string; score: number; confidence: number }[] {
    const alignment = alignWords(referenceText, transcription.words);
    return alignment.map((a) => ({
      word: a.refWord,
      score: a.score,
      confidence: a.confidence,
    }));
  }

  private calculateAccuracy(
    wordScores: { word: string; score: number }[],
  ): number {
    if (wordScores.length === 0) return 0;
    const avg =
      wordScores.reduce((sum, w) => sum + w.score, 0) / wordScores.length;
    return Math.round(avg);
  }

  private calculateFluency(
    words: { start: number; end: number; confidence: number }[],
    referenceWordCount: number,
  ): number {
    if (words.length < 2) return 50;
    const totalDuration = words[words.length - 1].end - words[0].start;
    if (totalDuration <= 0) return 50;
    const spokenWpm = (words.length / totalDuration) * 60;
    const idealWpm = 140;
    const ratio = spokenWpm / idealWpm;
    if (ratio > 1.5) return Math.round(Math.max(0, 100 - (ratio - 1.5) * 40));
    if (ratio < 0.5) return Math.round(Math.max(0, 100 - (0.5 - ratio) * 40));
    return Math.round(100 - Math.abs(1 - ratio) * 30);
  }

  private generateFeedback(
    overallScore: number,
    accuracyScore: number,
    fluencyScore: number,
    wordScores: { word: string; score: number }[],
  ): string[] {
    const feedback: string[] = [];
    if (overallScore >= 80) {
      feedback.push('Great pronunciation! Keep practicing.');
    } else if (overallScore >= 60) {
      feedback.push('Good effort. Focus on problem words below.');
    } else {
      feedback.push('Keep practicing. Slow down and focus on each word.');
    }
    if (fluencyScore < 60) {
      feedback.push('Try to speak at a more natural pace.');
    }
    if (accuracyScore < 60) {
      const lowWords = wordScores
        .filter((w) => w.score < 50)
        .map((w) => w.word);
      if (lowWords.length > 0) {
        feedback.push(`Practice these words: ${lowWords.join(', ')}`);
      }
    }
    return feedback;
  }
}
