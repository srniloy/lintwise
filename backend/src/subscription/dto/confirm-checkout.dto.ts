import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmCheckoutDto {
  @ApiProperty({ description: 'Stripe Checkout Session ID' })
  @IsString()
  sessionId!: string;
}
