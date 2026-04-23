import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum AnalyticsRange {
  WEEK = '7d',
  MONTH = '30d',
  QUARTER = '90d',
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: AnalyticsRange,
    default: AnalyticsRange.MONTH,
    description: 'Time window for the analytics aggregation',
  })
  @IsOptional()
  @IsEnum(AnalyticsRange)
  range?: AnalyticsRange = AnalyticsRange.MONTH;
}

/** Convert a range string to a UTC Date cutoff (N days ago, at 00:00:00). */
export function rangeCutoff(range: AnalyticsRange): Date {
  const days = { [AnalyticsRange.WEEK]: 7, [AnalyticsRange.MONTH]: 30, [AnalyticsRange.QUARTER]: 90 }[range];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}
