-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('friend', 'professional', 'networking', 'dating', 'casual', 'unknown');

-- CreateEnum
CREATE TYPE "AiAccess" AS ENUM ('none', 'suggest', 'approve', 'auto');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "SentBy" AS ENUM ('contact', 'owner_manual', 'keel_approved', 'keel_auto');

-- CreateEnum
CREATE TYPE "MemoryKind" AS ENUM ('fact', 'answered_question', 'plan', 'boundary', 'avoid_topic');

-- CreateEnum
CREATE TYPE "SuggestionKind" AS ENUM ('reply', 'no_reply', 'starter');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('open', 'sent', 'edited_and_sent', 'dismissed', 'blocked', 'expired');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('suggested', 'approved', 'published', 'handoff', 'rejected', 'failed');

-- CreateEnum
CREATE TYPE "LogActor" AS ENUM ('ai', 'owner', 'system');

-- CreateEnum
CREATE TYPE "LogOutcome" AS ENUM ('ok', 'sent', 'published', 'blocked', 'skipped', 'failed');

-- CreateTable
CREATE TABLE "IgAccount" (
    "id" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "igAccountId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("igAccountId")
);

-- CreateTable
CREATE TABLE "Capability" (
    "igAccountId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" JSONB,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Capability_pkey" PRIMARY KEY ("igAccountId","key")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "igsid" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "relationship" "Relationship" NOT NULL DEFAULT 'unknown',
    "aiAccess" "AiAccess" NOT NULL DEFAULT 'suggest',
    "notes" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "igThreadId" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "tone" TEXT,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "igMid" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "sentBy" "SentBy" NOT NULL,
    "text" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMemory" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "kind" "MemoryKind" NOT NULL,
    "content" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "kind" "SuggestionKind" NOT NULL,
    "draft" TEXT,
    "rationale" TEXT NOT NULL,
    "critic" JSONB NOT NULL,
    "policy" JSONB NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "originalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryDraft" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "overlayText" TEXT,
    "caption" TEXT,
    "stickerIdea" JSONB,
    "musicIdea" TEXT,
    "hashtags" TEXT[],
    "quality" JSONB NOT NULL,
    "recommended" BOOLEAN NOT NULL,
    "status" "StoryStatus" NOT NULL DEFAULT 'suggested',
    "igMediaId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "StoryDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "igMediaId" TEXT,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalityProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "humor" INTEGER NOT NULL DEFAULT 2,
    "confidence" INTEGER NOT NULL DEFAULT 2,
    "formality" INTEGER NOT NULL DEFAULT 2,
    "flirting" INTEGER NOT NULL DEFAULT 0,
    "emojiRate" TEXT NOT NULL DEFAULT 'rare',
    "sentenceLength" TEXT NOT NULL DEFAULT 'short',
    "slang" TEXT[],
    "signaturePhrases" TEXT[],
    "bannedPhrases" TEXT[],
    "factsAboutMe" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleExample" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StyleExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "dailyCap" INTEGER NOT NULL DEFAULT 5,
    "activeFrom" INTEGER NOT NULL DEFAULT 9,
    "activeTo" INTEGER NOT NULL DEFAULT 22,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyRule" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SafetyRule_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "seq" BIGSERIAL NOT NULL,
    "actor" "LogActor" NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" JSONB,
    "outcome" "LogOutcome" NOT NULL,
    "ruleKeys" TEXT[],
    "payloadHash" TEXT NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "SystemState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "automationOn" BOOLEAN NOT NULL DEFAULT true,
    "messagesMode" TEXT NOT NULL DEFAULT 'approve',
    "storiesMode" TEXT NOT NULL DEFAULT 'approve',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "pausedAt" TIMESTAMP(3),
    "pausedReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IgAccount_igUserId_key" ON "IgAccount"("igUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_igAccountId_igsid_key" ON "Contact"("igAccountId", "igsid");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_contactId_key" ON "Conversation"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_igThreadId_key" ON "Conversation"("igThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_igMid_key" ON "Message"("igMid");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "InsightSnapshot_igMediaId_metric_idx" ON "InsightSnapshot"("igMediaId", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "ActionLog_hash_key" ON "ActionLog"("hash");

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "IgAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capability" ADD CONSTRAINT "Capability_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "IgAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "IgAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMemory" ADD CONSTRAINT "ConversationMemory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryDraft" ADD CONSTRAINT "StoryDraft_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
