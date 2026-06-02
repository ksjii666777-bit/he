import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoadmapsService } from './roadmaps.service';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Roadmaps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/roadmaps')
export class RoadmapsController {
  constructor(private roadmapsService: RoadmapsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new learning roadmap' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRoadmapDto,
  ) {
    return this.roadmapsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get active roadmap' })
  async getActive(@CurrentUser('id') userId: string) {
    return this.roadmapsService.getActive(userId);
  }

  @Get(':id/goals')
  @ApiOperation({ summary: 'Get roadmap goals' })
  async getGoals(
    @CurrentUser('id') userId: string,
    @Param('id') roadmapId: string,
  ) {
    return this.roadmapsService.getGoals(userId, roadmapId);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's learning plan" })
  async getTodayPlan(@CurrentUser('id') userId: string) {
    return this.roadmapsService.getTodayPlan(userId);
  }
}
