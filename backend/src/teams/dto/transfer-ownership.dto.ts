import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferOwnershipDto {
  @ApiProperty({ example: 'cuid_of_new_owner' })
  @IsString()
  newOwnerId: string;
}
