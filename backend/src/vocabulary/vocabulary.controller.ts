import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Query,
} from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import { Sm5Service } from './sm-5.service';

@Controller('vocabulary')
export class VocabularyController {
  constructor(
    private readonly vocabulary: VocabularyService,
    private readonly sm5: Sm5Service,
  ) {}

  @Get('review')
  async getReviewQueue(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    return this.vocabulary.getDueReviews(req.user.sub, parseInt(limit || '10'));
  }

  @Post('review')
  async submitReview(
    @Req() req: any,
    @Body()
    body: { word: string; quality: number },
  ) {
    const result = this.sm5.calculate(body.quality);
    return this.vocabulary.updateReview(
      req.user.sub,
      body.word,
      body.quality,
      result,
    );
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    return this.vocabulary.getStats(req.user.sub);
  }
}
