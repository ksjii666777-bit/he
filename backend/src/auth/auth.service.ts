import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto, LoginDto, ConsentDto, RefreshTokenDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        profile: {
          create: {
            name: dto.name,
            age: dto.age,
            countryCode: dto.countryCode,
            nativeLanguage: dto.nativeLanguage,
            learningGoal: dto.learningGoal,
            dailyStudyMin: dto.dailyStudyMin,
          },
        },
        languages: {
          create: {
            languageCode: 'en',
            goalCefr: 'B2',
            isPrimary: true,
          },
        },
      },
      select: {
        id: true,
        email: true,
        tier: true,
        profile: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.tier);

    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        tier: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash!);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.tier);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
    });

    return {
      user: { id: user.id, email: user.email, tier: user.tier },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          tier: true,
          refreshToken: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(
        user.id,
        user.email,
        user.tier,
      );
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async grantConsent(userId: string, dto: ConsentDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        consentGranted: dto.voiceRecording,
        consentGrantedAt: dto.voiceRecording ? new Date() : null,
      },
    });

    await this.prisma.consentLog.create({
      data: {
        userId,
        consentType: 'voice_recording',
        granted: dto.voiceRecording,
      },
    });

    await this.prisma.consentLog.create({
      data: {
        userId,
        consentType: 'data_processing',
        granted: dto.dataProcessing,
      },
    });

    return { consentGranted: dto.voiceRecording };
  }

  private async generateTokens(
    userId: string,
    email: string,
    tier: string,
  ) {
    const payload = { sub: userId, email, tier };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: process.env.JWT_EXPIRATION || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
