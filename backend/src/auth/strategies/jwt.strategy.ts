import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { authConfig } from '../../config/config.module';
import { PrismaService } from '../../common/prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  tier: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(authConfig.KEY) auth: ConfigType<typeof authConfig>,
    private prisma: PrismaService,
  ) {
    console.log(`DIAG: auth.jwtSecret present: ${!!auth?.jwtSecret}`);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: auth.jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    console.log('JWT payload:', payload);
    console.log('payload.sub:', payload.sub);

    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, tier: true, isActive: true },
      });
    } catch (err) {
      console.error('Exception caught in validate():', err);
      throw new UnauthorizedException('User not found or inactive');
    }

    console.log('Found user:', user);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return { ...user, sub: payload.sub };
  }
}
