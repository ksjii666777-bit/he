import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateProfileDto, UpdatePreferencesDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        tier: true,
        consentGranted: true,
        createdAt: true,
        profile: true,
        languages: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    return this.prisma.userProfile.update({
      where: { userId },
      data: dto,
    });
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    return this.prisma.userProfile.update({
      where: { userId },
      data: dto,
    });
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true };
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        languages: true,
        dailyActivity: true,
        errorCorrections: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            assessments: true,
            lessonsProgress: true,
            conversationSessions: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
