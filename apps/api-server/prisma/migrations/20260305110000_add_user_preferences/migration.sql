-- CreateTable
CREATE TABLE "user_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'zh-CN',
  "autoStart" BOOLEAN NOT NULL DEFAULT true,
  "minimizeToTray" BOOLEAN NOT NULL DEFAULT false,
  "notifyNewMessage" BOOLEAN NOT NULL DEFAULT true,
  "notifyMention" BOOLEAN NOT NULL DEFAULT true,
  "notifySystemUpdate" BOOLEAN NOT NULL DEFAULT true,
  "notifyTeamInvite" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_preferences_userId_idx" ON "user_preferences"("userId");

-- AddForeignKey
ALTER TABLE "user_preferences"
  ADD CONSTRAINT "user_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
