import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Notify when a review completes' })
  @IsOptional()
  @IsBoolean()
  review_complete?: boolean;

  @ApiPropertyOptional({ description: 'Notify when critical issues are found' })
  @IsOptional()
  @IsBoolean()
  critical_issues?: boolean;

  @ApiPropertyOptional({ description: 'Notify when a teammate @mentions you' })
  @IsOptional()
  @IsBoolean()
  team_mentions?: boolean;
}
