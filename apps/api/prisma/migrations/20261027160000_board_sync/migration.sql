-- DropIndex
DROP INDEX "boards_user_id_idx";

-- AlterTable
ALTER TABLE "boards" ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "synced_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "boards_user_id_synced_at_idx" ON "boards"("user_id", "synced_at");

