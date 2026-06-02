import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ContentValidator } from '../ai-gateway/validators/content-validator';

export interface PlacementQuestion {
  id: number;
  type: 'grammar' | 'vocabulary' | 'reading' | 'listening';
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: 'A1' | 'A2' | 'B1';
}

@Injectable()
export class PlacementTestService {
  private readonly logger = new Logger(PlacementTestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: ContentValidator,
  ) {}

  async generateTest(): Promise<PlacementQuestion[]> {
    const questions: PlacementQuestion[] = [];

    const grammarA1 = await this.getOrGenerateQuestions('grammar', 'A1', 5);
    const grammarA2 = await this.getOrGenerateQuestions('grammar', 'A2', 3);
    const grammarB1 = await this.getOrGenerateQuestions('grammar', 'B1', 2);

    const vocabA1 = await this.getOrGenerateQuestions('vocabulary', 'A1', 5);
    const vocabA2 = await this.getOrGenerateQuestions('vocabulary', 'A2', 3);
    const vocabB1 = await this.getOrGenerateQuestions('vocabulary', 'B1', 2);

    const readingA1 = await this.getOrGenerateQuestions('reading', 'A1', 3);
    const readingA2 = await this.getOrGenerateQuestions('reading', 'A2', 2);

    questions.push(
      ...grammarA1, ...grammarA2, ...grammarB1,
      ...vocabA1, ...vocabA2, ...vocabB1,
      ...readingA1, ...readingA2,
    );

    return questions.slice(0, 25);
  }

  async evaluateTest(
    userId: string,
    answers: { questionId: number; selectedIndex: number }[],
  ): Promise<{
    cefrLevel: string;
    score: number;
    weakAreas: string[];
    strongAreas: string[];
    grammarScore: number;
    vocabularyScore: number;
    readingScore: number;
  }> {
    const correctMap = new Map<number, number>();
    let totalCorrect = 0;
    let grammarCorrect = 0;
    let grammarTotal = 0;
    let vocabCorrect = 0;
    let vocabTotal = 0;
    let readingCorrect = 0;
    let readingTotal = 0;

    for (const answer of answers) {
      const question = await this.getCachedQuestion(answer.questionId);
      if (!question) continue;

      const correct = answer.selectedIndex === question.correctIndex;
      correctMap.set(answer.questionId, correct ? 1 : 0);
      if (correct) totalCorrect++;

      switch (question.type) {
        case 'grammar':
          grammarTotal++;
          if (correct) grammarCorrect++;
          break;
        case 'vocabulary':
          vocabTotal++;
          if (correct) vocabCorrect++;
          break;
        case 'reading':
          readingTotal++;
          if (correct) readingCorrect++;
          break;
      }
    }

    const total = answers.length;
    const score = total > 0 ? Math.round((totalCorrect / total) * 100) : 0;
    const grammarScore =
      grammarTotal > 0
        ? Math.round((grammarCorrect / grammarTotal) * 100)
        : 0;
    const vocabularyScore =
      vocabTotal > 0 ? Math.round((vocabCorrect / vocabTotal) * 100) : 0;
    const readingScore =
      readingTotal > 0
        ? Math.round((readingCorrect / readingTotal) * 100)
        : 0;

    const cefrLevel = this.computeCefr(score, {
      grammarScore,
      vocabularyScore,
      readingScore,
    });

    const weakAreas: string[] = [];
    if (grammarScore < 60) weakAreas.push('grammar');
    if (vocabularyScore < 60) weakAreas.push('vocabulary');
    if (readingScore < 60) weakAreas.push('reading');

    const strongAreas: string[] = [];
    if (grammarScore >= 80) strongAreas.push('grammar');
    if (vocabularyScore >= 80) strongAreas.push('vocabulary');
    if (readingScore >= 80) strongAreas.push('reading');

    return {
      cefrLevel,
      score,
      weakAreas,
      strongAreas,
      grammarScore,
      vocabularyScore,
      readingScore,
    };
  }

  private computeCefr(
    score: number,
    subscores: {
      grammarScore: number;
      vocabularyScore: number;
      readingScore: number;
    },
  ): string {
    const minSub = Math.min(
      subscores.grammarScore,
      subscores.vocabularyScore,
      subscores.readingScore,
    );
    const effective = Math.min(score, minSub + 20);
    if (effective >= 80) return 'B1';
    if (effective >= 55) return 'A2';
    return 'A1';
  }

  private async getOrGenerateQuestions(
    type: string,
    difficulty: string,
    count: number,
  ): Promise<PlacementQuestion[]> {
    const questions: PlacementQuestion[] = [];
    for (let i = 0; i < count; i++) {
      questions.push(this.generateStaticQuestion(type, difficulty, i));
    }
    return questions;
  }

  private generateStaticQuestion(
    type: string,
    difficulty: string,
    seed: number,
  ): PlacementQuestion {
    const baseId = this.hashCode(`${type}:${difficulty}:${seed}`);
    const q: PlacementQuestion = {
      id: baseId,
      type: type as any,
      question: '',
      options: [],
      correctIndex: 0,
      difficulty: difficulty as any,
    };

    if (type === 'grammar') {
      if (difficulty === 'A1') {
        q.question = `Choose the correct word: "She ___ a student."`;
        q.options = ['is', 'am', 'are', 'be'];
        q.correctIndex = 0;
      } else if (difficulty === 'A2') {
        q.question = `Choose the correct form: "They ___ to the park yesterday."`;
        q.options = ['go', 'goes', 'went', 'going'];
        q.correctIndex = 2;
      } else {
        q.question = `Choose the correct form: "If I ___ you, I would study more."`;
        q.options = ['am', 'was', 'were', 'be'];
        q.correctIndex = 2;
      }
    } else if (type === 'vocabulary') {
      if (difficulty === 'A1') {
        q.question = `What does "happy" mean?`;
        q.options = ['sad', 'angry', 'glad', 'tired'];
        q.correctIndex = 2;
      } else if (difficulty === 'A2') {
        q.question = `What does "expensive" mean?`;
        q.options = ['cheap', 'costing a lot', 'free', 'broken'];
        q.correctIndex = 1;
      } else {
        q.question = `What does "significant" mean?`;
        q.options = ['small', 'unimportant', 'important', 'difficult'];
        q.correctIndex = 2;
      }
    } else {
      if (difficulty === 'A1') {
        q.question = `Read: "The cat is on the mat. It is sleeping." Where is the cat?`;
        q.options = ['On the chair', 'On the mat', 'Under the bed', 'In the box'];
        q.correctIndex = 1;
      } else {
        q.question = `Read: "Although it was raining, Sarah decided to go for a walk. She took her umbrella and enjoyed the fresh air." Why did Sarah take an umbrella?`;
        q.options = [
          'It was sunny',
          'It was raining',
          'She was going to work',
          'She was tired',
        ];
        q.correctIndex = 1;
      }
    }

    return q;
  }

  private async getCachedQuestion(
    _id: number,
  ): Promise<PlacementQuestion | null> {
    const all = await this.getOrGenerateQuestions('grammar', 'A1', 5);
    const all2 = await this.getOrGenerateQuestions('vocabulary', 'A1', 5);
    const all3 = await this.getOrGenerateQuestions('reading', 'A1', 3);
    return (
      [...all, ...all2, ...all3].find((q) => q.id === _id) || null
    );
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
