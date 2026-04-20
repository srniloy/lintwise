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
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AddCollectionItemDto } from './dto/add-item.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('collections')
@ApiBearerAuth('access-token')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a collection' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCollectionDto) {
    return this.collectionsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all collections for the current user' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.collectionsService.findAll(user.sub);
  }

  // Must be before :id to avoid route shadowing
  @Get('shared/:token')
  @Public()
  @ApiOperation({ summary: 'Get a shared collection by token (no auth required)' })
  findByShareToken(@Param('token') token: string) {
    return this.collectionsService.findByShareToken(token);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single collection with items' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.collectionsService.findOne(id, user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Rename or update a collection description' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a collection and all its items' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.collectionsService.delete(id, user.sub);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a review or snippet to a collection' })
  addItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddCollectionItemDto,
  ) {
    return this.collectionsService.addItem(id, user.sub, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an item from a collection' })
  removeItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.collectionsService.removeItem(id, itemId, user.sub);
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Generate or refresh the share link for a collection' })
  share(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.collectionsService.generateShareLink(id, user.sub);
  }
}
