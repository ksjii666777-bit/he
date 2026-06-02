import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 25 })
  @IsInt()
  @Min(5)
  @Max(120)
  age!: number;

  @ApiProperty({ example: 'IN' })
  @IsString()
  @MinLength(2)
  @MaxLength(3)
  countryCode!: string;

  @ApiProperty({ example: 'hi' })
  @IsString()
  @MinLength(2)
  nativeLanguage!: string;

  @ApiProperty({ example: 'general' })
  @IsString()
  learningGoal!: string;

  @ApiProperty({ example: 15 })
  @IsInt()
  @Min(5)
  @Max(180)
  dailyStudyMin!: number;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class ConsentDto {
  @ApiProperty({ description: 'Consent to voice recording' })
  voiceRecording!: boolean;

  @ApiProperty({ description: 'Consent to data processing' })
  dataProcessing!: boolean;
}
