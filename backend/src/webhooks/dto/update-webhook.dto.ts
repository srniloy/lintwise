import { ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookEvent } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUrl,
} from 'class-validator';

export class UpdateWebhookDto {
  @ApiPropertyOptional({ example: 'https://example.com/hooks/lintwise' })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'url must be a valid http(s) URL' })
  url?: string;

  @ApiPropertyOptional({ isArray: true, enum: WebhookEvent })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(WebhookEvent, { each: true })
  events?: WebhookEvent[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
