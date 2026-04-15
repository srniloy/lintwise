import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MAX_CODE_CHARS = 50_000;
const MAX_CODE_LINES = 10_000;

export class CreateReviewDto {
  @ApiPropertyOptional({ description: 'Optional review title', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ description: 'Programming language of the code', example: 'typescript' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  language: string;

  @ApiProperty({
    description: `Source code to review (max ${MAX_CODE_CHARS.toLocaleString()} characters)`,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Code must be at least 10 characters' })
  @MaxLength(MAX_CODE_CHARS, {
    message: `Code must not exceed ${MAX_CODE_CHARS.toLocaleString()} characters`,
  })
  code: string;

  /** Derived validation — checked in service since class-validator can't count lines easily */
  static readonly MAX_CODE_CHARS = MAX_CODE_CHARS;
  static readonly MAX_CODE_LINES = MAX_CODE_LINES;
}
