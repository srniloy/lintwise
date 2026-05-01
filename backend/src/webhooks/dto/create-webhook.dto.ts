import { ApiProperty } from '@nestjs/swagger';
import { WebhookEvent } from '@prisma/client';
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsUrl } from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://example.com/hooks/lintwise' })
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'url must be a valid http(s) URL' })
  url: string;

  @ApiProperty({
    isArray: true,
    enum: WebhookEvent,
    example: ['REVIEW_COMPLETED', 'CRITICAL_ISSUE_FOUND'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'at least one event is required' })
  @ArrayUnique()
  @IsEnum(WebhookEvent, { each: true })
  events: WebhookEvent[];
}
