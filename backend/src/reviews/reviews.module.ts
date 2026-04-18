import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ExportService } from './export/export.service';
import { GeminiModule } from '../gemini/gemini.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, GeminiModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ExportService],
  exports: [ReviewsService, ExportService],
})
export class ReviewsModule {}
