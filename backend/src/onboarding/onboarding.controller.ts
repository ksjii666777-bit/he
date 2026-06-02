import { Controller, Post, Get, Body, Req, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Controller('onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);
  private readonly betaInviteCodes: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const codes = config.get<string>('BETA_INVITE_CODES') || 'beta2024';
    this.betaInviteCodes = new Set(codes.split(',').map((c) => c.trim()));
  }

  @Post('verify-invite')
  async verifyInvite(@Body() body: { code: string }) {
    const valid = this.betaInviteCodes.has(body.code);
    return { valid, message: valid ? 'Welcome to the beta!' : 'Invalid invite code' };
  }

  @Get('welcome')
  async getWelcome(@Req() req: any) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId: req.user.sub },
    });

    return {
      steps: [
        { id: 'profile', title: 'Complete your profile', done: !!profile?.name },
        { id: 'consent', title: 'Grant data consent', done: false },
        { id: 'placement', title: 'Take placement test', done: !!profile?.onboardingComplete },
        { id: 'first-lesson', title: 'Complete your first lesson', done: false },
      ],
      profile: profile ? { name: profile.name, level: profile.nativeLanguage } : null,
    };
  }

  @Post('complete')
  async completeOnboarding(@Req() req: any) {
    await this.prisma.userProfile.update({
      where: { userId: req.user.sub },
      data: { onboardingComplete: true },
    });
    return { status: 'onboarding_complete' };
  }
}
