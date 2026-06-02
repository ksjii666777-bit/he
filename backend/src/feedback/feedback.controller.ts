import { Controller, Post, Get, Body, Req, Query, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('feedback')
export class FeedbackController {
  private readonly logger = new Logger(FeedbackController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async submitFeedback(
    @Req() req: any,
    @Body()
    body: {
      type: 'bug' | 'feature' | 'content' | 'general';
      category: string;
      message: string;
      rating?: number;
      page?: string;
    },
  ) {
    await this.prisma.$executeRaw`
      INSERT INTO feedback (id, user_id, type, category, message, rating, page, created_at)
      VALUES (gen_random_uuid()::text, ${req.user.sub}, ${body.type}, ${body.category}, ${body.message}, ${body.rating || null}, ${body.page || null}, NOW())
    `;
    return { status: 'submitted' };
  }

  @Get()
  async getFeedback(@Req() req: any, @Query('days') days?: string) {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT id, type, category, message, rating, page, created_at
      FROM feedback
      WHERE user_id = ${req.user.sub}
        AND created_at >= NOW() - ${(parseInt(days || '30'))}::integer * INTERVAL '1 day'
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return result;
  }
}
