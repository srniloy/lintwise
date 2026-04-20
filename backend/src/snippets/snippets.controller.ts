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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SnippetsService } from './snippets.service';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('snippets')
@ApiBearerAuth('access-token')
@Controller('snippets')
export class SnippetsController {
  constructor(private readonly snippetsService: SnippetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a code snippet' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSnippetDto) {
    return this.snippetsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all snippets for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'language', required: false, type: String })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('language') language?: string,
  ) {
    return this.snippetsService.findAll(user.sub, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      language,
    });
  }

  // Must be declared before :id to avoid route shadowing
  @Get(':id/versions')
  @ApiOperation({ summary: 'Get version history for a snippet' })
  getVersionHistory(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.snippetsService.getVersionHistory(id, user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single snippet' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.snippetsService.findOne(id, user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a snippet (creates new version if code changes)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSnippetDto,
  ) {
    return this.snippetsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a snippet and all its versions' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.snippetsService.delete(id, user.sub);
  }
}
