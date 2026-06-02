import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OpenRouterService } from '../ai-gateway/openrouter/openrouter.service';

@Injectable()
export class RoadmapEnhancerService {
  private readonly logger = new Logger(RoadmapEnhancerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bedrock: OpenRouterService,
  ) {}

  async enhanceRoadmap(roadmapId: string): Promise<any> {
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        milestones: true,
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!roadmap) throw new Error('Roadmap not found');

    const currentMilestone = roadmap.milestones.find(
      (m) => !m.isCompleted,
    );
    const completedMilestones = roadmap.milestones.filter(
      (m) => m.isCompleted,
    );

    const prompt = `You are an English learning advisor. Review this student's learning roadmap:

Student level: ${roadmap.currentCefr || 'A1'}
Goal: ${roadmap.targetCefr || 'General'}
Target: ${roadmap.targetCefr}
Study minutes/day: ${roadmap.user.profile?.dailyStudyMin || 15}

${
  completedMilestones.length > 0
    ? `Completed milestones: ${completedMilestones.map((m) => m.title).join(', ')}`
    : 'No milestones completed yet.'
}
Current milestone: ${currentMilestone?.title || 'Starting'}
Current focus: ${roadmap.targetCefr || 'General English'}

Provide personalized recommendations:
1. What should the student focus on next?
2. How can they improve their weak areas?
3. Suggest specific resources or practice methods

Output JSON:
{
  "recommendations": ["string"],
  "nextFocus": "string",
  "suggestedResources": [{"name": "string", "type": "string", "reason": "string"}],
  "estimatedTimeline": "string"
}`;

    const response = await this.bedrock.generateRoadmap(prompt);

    let parsed: any;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      parsed = {
        recommendations: [response.content],
        nextFocus: 'Continue current milestone',
        suggestedResources: [],
        estimatedTimeline: 'Continue at current pace',
      };
    }

    await this.prisma.roadmap.update({
      where: { id: roadmapId },
      data: {
        generatedAt: new Date(),
      },
    });

    return parsed;
  }
}
