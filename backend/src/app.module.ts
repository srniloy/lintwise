import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';

import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GeminiModule } from './gemini/gemini.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SnippetsModule } from './snippets/snippets.module';
import { CollectionsModule } from './collections/collections.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TeamsModule } from './teams/teams.module';
import { CommentsModule } from './comments/comments.module';

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

    // ── Rate limiting (global) ────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        // Default: 100 requests per 15 minutes per IP
        name: 'default',
        ttl: 15 * 60 * 1000,
        limit: 100,
      },
    ]),

    // ── JWT (global — consumed by JwtAuthGuard) ───────────────────
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret') as string,
        signOptions: {
          expiresIn: config.get<string>('jwt.accessExpiry', '7d') as any,
        },
      }),
    }),

    // ── Infrastructure ────────────────────────────────────────────
    PrismaModule,
    CacheModule,

    // ── Features ─────────────────────────────────────────────────
    MailModule,
    AuthModule,
    UsersModule,
    GeminiModule,
    ReviewsModule,
    SnippetsModule,
    CollectionsModule,
    AnalyticsModule,
    NotificationsModule,
    TeamsModule,
    CommentsModule,
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
