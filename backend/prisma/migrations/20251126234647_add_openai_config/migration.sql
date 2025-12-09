-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "openaiApiKey" TEXT,
ADD COLUMN     "openaiMaxTokens" INTEGER DEFAULT 500,
ADD COLUMN     "openaiModel" TEXT DEFAULT 'gpt-4-turbo',
ADD COLUMN     "openaiTemperature" DOUBLE PRECISION DEFAULT 0.7;
