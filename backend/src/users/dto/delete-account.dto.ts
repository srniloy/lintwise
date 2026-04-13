import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ description: 'Current password to confirm account deletion' })
  @IsString()
  password: string;
}
