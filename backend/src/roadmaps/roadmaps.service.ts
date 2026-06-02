import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';

@Injectable()
export class RoadmapsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateRoadmapDto) {
    const existing = await this.prisma.roadmap.findFirst({
      where: { userId, isActive: true },
    });

    if (existing) {
      throw new BadRequestException('Active roadmap already exists');
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + dto.durationMonths);

    const roadmap = await this.prisma.roadmap.create({
      data: {
        userId,
        languageCode: 'en',
        durationMonths: dto.durationMonths,
        startDate: now,
        endDate,
        currentCefr: dto.currentCefr,
        targetCefr: dto.targetCefr,
        milestones: {
          create: this.generateMilestones(
            dto.durationMonths,
            dto.currentCefr,
            dto.targetCefr,
          ),
        },
      },
      include: {
        milestones: { orderBy: { monthNumber: 'asc' } },
      },
    });

    return roadmap;
  }

  async getActive(userId: string) {
    const roadmap = await this.prisma.roadmap.findFirst({
      where: { userId, isActive: true },
      include: {
        milestones: { orderBy: { monthNumber: 'asc' } },
      },
    });

    if (!roadmap) throw new NotFoundException('No active roadmap');
    return roadmap;
  }

  async getGoals(userId: string, roadmapId: string) {
    const roadmap = await this.prisma.roadmap.findFirst({
      where: { id: roadmapId, userId },
      include: {
        milestones: {
          orderBy: { monthNumber: 'asc' },
          where: { monthNumber: { lte: 3 } },
        },
      },
    });

    if (!roadmap) throw new NotFoundException('Roadmap not found');
    return roadmap;
  }

  async getTodayPlan(userId: string) {
    const roadmap = await this.prisma.roadmap.findFirst({
      where: { userId, isActive: true },
      include: {
        milestones: {
          orderBy: { monthNumber: 'asc' },
          take: 1,
        },
      },
    });

    if (!roadmap) {
      return {
        needsRoadmap: true,
        message: 'Complete placement test to get your roadmap',
      };
    }

    return {
      roadmap: {
        id: roadmap.id,
        currentCefr: roadmap.currentCefr,
        targetCefr: roadmap.targetCefr,
        currentMilestone: roadmap.milestones[0],
      },
      lesson: null,
    };
  }

  private generateMilestones(
    durationMonths: number,
    from: string,
    to: string,
  ) {
    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const fromIndex = cefrLevels.indexOf(from);
    const toIndex = cefrLevels.indexOf(to);
    const levelsToGain = toIndex - fromIndex;
    const levelsPerMonth = Math.max(1, Math.ceil(levelsToGain / durationMonths));

    const milestones = [];
    let currentLevelIndex = fromIndex;

    for (let month = 1; month <= durationMonths; month++) {
      milestones.push({
        monthNumber: month,
        title: `${cefrLevels[currentLevelIndex]} Level — Month ${month}`,
        description: `Focus on ${cefrLevels[currentLevelIndex]} level skills: vocabulary, grammar, speaking, and listening.`,
        sortOrder: month,
      });

      if (month % Math.ceil(durationMonths / Math.max(1, levelsToGain)) === 0) {
        if (currentLevelIndex < toIndex) {
          currentLevelIndex++;
        }
      }
    }

    return milestones;
  }
}
