-- CreateTable
CREATE TABLE "broadcast_daily_sent" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "broadcast_daily_sent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_daily_sent_channelId_date_key" ON "broadcast_daily_sent"("channelId", "date");

-- CreateIndex
CREATE INDEX "broadcast_daily_sent_channelId_idx" ON "broadcast_daily_sent"("channelId");
