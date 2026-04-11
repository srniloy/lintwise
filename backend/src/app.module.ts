import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';

import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

@Module({
  imports: [
    // ── Config (global) ───────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    // ── JWT (global — consumed by JwtAuthGuard) ───────────────────
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret') as string,
        signOptions: {
          // Cast to 'any' — ConfigService returns string but jwt expects StringValue
          expiresIn: config.get<string>('jwt.accessExpiry', '7d') as any,
        },
      }),
    }),

    // ── Database ──────────────────────────────────────────────────
    PrismaModule,

    // ── Cache ─────────────────────────────────────────────────────
    CacheModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,

    // ── Global guards (applied in order: JWT first, then Roles) ───
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    // ── Global interceptors ────────────────────────────────────────
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },

    // ── Global exception filters (specific before generic) ─────────
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
