-- DropForeignKey
ALTER TABLE "PlanComment" DROP CONSTRAINT "PlanComment_authorId_fkey";

-- AlterTable
ALTER TABLE "PlanComment" ALTER COLUMN "authorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PlanComment" ADD CONSTRAINT "PlanComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
