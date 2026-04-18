import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewFilterDto } from './dto/review-filter.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('reviews')
@ApiBearerAuth('access-token')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

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
