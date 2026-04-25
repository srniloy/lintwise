-- Migration: add notificationPreferences JSONB column to User
ALTER TABLE "User" ADD COLUMN "notificationPreferences" JSONB;
