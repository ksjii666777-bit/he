import { IsString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoadmapDto {
  @ApiProperty({ enum: ['3', '6', '12'] })
  @IsInt()
  @Min(3)
  @Max(12)
  durationMonths!: number;

  @ApiProperty({ example: 'A1' })
  @IsString()
  currentCefr!: string;

  @ApiProperty({ example: 'B2' })
  @IsString()
  targetCefr!: string;
}
