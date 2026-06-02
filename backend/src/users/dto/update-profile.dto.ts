import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  age?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  learningGoal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(180)
  dailyStudyMin?: number;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: ['friendly', 'professional'] })
  @IsOptional()
  @IsString()
  teacherMode?: string;

  @ApiPropertyOptional({ enum: ['visual', 'auditory', 'reading', 'mixed'] })
  @IsOptional()
  @IsString()
  learningStyle?: string;
}
