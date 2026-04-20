import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSnippetDto {
  @ApiProperty({ example: 'My Utility Function', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiProperty({ example: 'typescript', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  language: string;

  @ApiProperty({ description: 'Source code to save' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
