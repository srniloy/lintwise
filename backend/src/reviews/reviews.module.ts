import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ExportService } from './export/export.service';
import { GeminiModule } from '../gemini/gemini.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, GeminiModule, AnalyticsModule, NotificationsModule, MailModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ExportService],
  exports: [ReviewsService, ExportService],
})
export class ReviewsModule {}
