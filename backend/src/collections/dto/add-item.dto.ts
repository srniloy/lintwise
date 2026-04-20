import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CollectionItemType {
  REVIEW = 'REVIEW',
  SNIPPET = 'SNIPPET',
}

export class AddCollectionItemDto {
  @ApiProperty({ enum: CollectionItemType, description: 'Type of item being added' })
  @IsEnum(CollectionItemType)
  type: CollectionItemType;

  @ApiProperty({ example: 'cuid123', description: 'ID of the review or snippet' })
  @IsString()
  @IsNotEmpty()
  referenceId: string;

  @ApiPropertyOptional({ description: 'Optional display title (derived from entity if omitted)' })
  @IsOptional()
  @IsString()
  title?: string;
}
