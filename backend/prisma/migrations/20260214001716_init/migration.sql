-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "unreadCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "webhooks" ALTER COLUMN "events" SET NOT NULL,
ALTER COLUMN "events" SET DATA TYPE TEXT;
