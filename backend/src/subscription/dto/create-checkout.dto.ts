import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiPropertyOptional({ description: 'Stripe Price ID (defaults to config)' })
  @IsString()
  @IsOptional()
  priceId?: string;

  @ApiPropertyOptional({ description: 'Success redirect URL (defaults to frontend /upgrade?success=1)' })
  @IsString()
  @IsOptional()
  successUrl?: string;

  @ApiPropertyOptional({ description: 'Cancel redirect URL (defaults to frontend /upgrade?cancelled=1)' })
  @IsString()
  @IsOptional()
  cancelUrl?: string;
}
