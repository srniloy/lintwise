import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
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
   * Returns the full review (used by ReviewDetailPage).
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single review by ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewsService.findOne(id, user.sub);
  }
}
