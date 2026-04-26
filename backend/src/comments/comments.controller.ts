import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import type { Role } from '@prisma/client';

@ApiTags('comments')
@ApiBearerAuth('access-token')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /** GET /reviews/:reviewId/comments — list threaded comments for a review */
  @Get('reviews/:reviewId/comments')
  @ApiOperation({ summary: 'List comments for a review (threaded)' })
  findAll(@Param('reviewId') reviewId: string) {
    return this.commentsService.findAllByReview(reviewId);
  }

  /** POST /reviews/:reviewId/comments — add a comment (PREMIUM/ADMIN only) */
  @Post('reviews/:reviewId/comments')
  @HttpCode(HttpStatus.CREATED)
  @Roles('PREMIUM', 'ADMIN')
  @ApiOperation({ summary: 'Post a comment on a review' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId') reviewId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(reviewId, user.sub, dto);
  }

  /** PUT /comments/:id — edit a comment (owner only) */
  @Put('comments/:id')
  @ApiOperation({ summary: 'Edit a comment' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, user.sub, dto);
  }

  /** DELETE /comments/:id — delete a comment (owner or ADMIN) */
  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.commentsService.delete(id, user.sub, user.role as Role);
  }
}
