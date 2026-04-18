import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReviewsService } from './reviews.service';
import { ExportService } from './export/export.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewFilterDto } from './dto/review-filter.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

type ExportFormat = 'json' | 'markdown' | 'csv' | 'pdf';
const VALID_FORMATS: ExportFormat[] = ['json', 'markdown', 'csv', 'pdf'];

@ApiTags('reviews')
@ApiBearerAuth('access-token')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * POST /reviews
   * Creates a review and immediately triggers background AI processing.
   * Returns the review with PENDING status (201).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit code for AI review' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.sub, dto);
  }

  /**
   * GET /reviews
   * Returns paginated list of the current user's reviews with optional filters.
   */
  @Get()
  @ApiOperation({ summary: 'List reviews for the current user' })
  findAll(@CurrentUser() user: JwtPayload, @Query() filters: ReviewFilterDto) {
    return this.reviewsService.findAllByUser(user.sub, filters);
  }

  /**
   * GET /reviews/:id/status
   * Returns { id, status, createdAt, updatedAt }.
   * Frontend polls this every 3 seconds until status is COMPLETED or FAILED.
   */
  @Get(':id/status')
  @ApiOperation({ summary: 'Get review processing status' })
  getStatus(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewsService.getStatus(id, user.sub);
  }

  /**
   * GET /reviews/:id/export?format=json|markdown|csv|pdf
   * Downloads the review in the requested format.
   * Must be declared before GET :id to avoid route shadowing.
   */
  @Get(':id/export')
  @ApiOperation({ summary: 'Export a review in json, markdown, csv, or pdf format' })
  @ApiQuery({ name: 'format', enum: VALID_FORMATS, required: true })
  async export(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    if (!VALID_FORMATS.includes(format as ExportFormat)) {
      throw new BadRequestException(
        `Invalid export format "${format}". Allowed: ${VALID_FORMATS.join(', ')}`,
      );
    }

    const review = await this.reviewsService.getFullResult(id, user.sub);
    const slug = (review.title ?? review.id).replace(/\s+/g, '_').slice(0, 60);

    switch (format as ExportFormat) {
      case 'json': {
        const body = this.exportService.exportAsJson(review, review.issues);
        res
          .setHeader('Content-Type', 'application/json')
          .setHeader('Content-Disposition', `attachment; filename="${slug}.json"`)
          .send(body);
        break;
      }
      case 'markdown': {
        const body = this.exportService.exportAsMarkdown(review, review.issues);
        res
          .setHeader('Content-Type', 'text/markdown; charset=utf-8')
          .setHeader('Content-Disposition', `attachment; filename="${slug}.md"`)
          .send(body);
        break;
      }
      case 'csv': {
        const body = this.exportService.exportAsCsv(review.issues);
        res
          .setHeader('Content-Type', 'text/csv; charset=utf-8')
          .setHeader('Content-Disposition', `attachment; filename="${slug}.csv"`)
          .send(body);
        break;
      }
      case 'pdf': {
        const buffer = await this.exportService.exportAsPdf(review, review.issues);
        res
          .setHeader('Content-Type', 'application/pdf')
          .setHeader('Content-Disposition', `attachment; filename="${slug}.pdf"`)
          .send(buffer);
        break;
      }
    }
  }

  /**
   * GET /reviews/:id
   * Returns the full review with issues (cached 30 days).
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single review with all issues' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewsService.getFullResult(id, user.sub);
  }

  /**
   * DELETE /reviews/:id
   * Deletes the review and invalidates its cache entry. Returns 204.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a review' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewsService.delete(id, user.sub);
  }
}
