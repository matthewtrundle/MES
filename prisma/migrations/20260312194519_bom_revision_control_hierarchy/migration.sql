-- AlterTable
ALTER TABLE "bill_of_materials" ADD COLUMN     "assembly_group" TEXT,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "routings" ADD COLUMN     "effective_date" TIMESTAMP(3),
ADD COLUMN     "revision" TEXT NOT NULL DEFAULT 'A',
ADD COLUMN     "superseded_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "routings" ADD CONSTRAINT "routings_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "routings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
