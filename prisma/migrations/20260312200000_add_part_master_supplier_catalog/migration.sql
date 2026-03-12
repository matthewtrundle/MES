-- CreateTable
CREATE TABLE "part_masters" (
    "id" TEXT NOT NULL,
    "part_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "revision" TEXT NOT NULL DEFAULT 'A',
    "category" TEXT NOT NULL,
    "unit_of_measure" TEXT NOT NULL DEFAULT 'EA',
    "country_of_origin" TEXT,
    "reorder_point" DOUBLE PRECISION,
    "target_stock_level" DOUBLE PRECISION,
    "standard_cost" DOUBLE PRECISION,
    "serialization_type" TEXT NOT NULL DEFAULT 'none',
    "hazardous" BOOLEAN NOT NULL DEFAULT false,
    "hazardous_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "country_of_origin" TEXT,
    "qualification_status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_suppliers" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "supplier_part_number" TEXT,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "unit_cost" DOUBLE PRECISION,
    "lead_time_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "part_masters_part_number_key" ON "part_masters"("part_number");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplier_id_key" ON "suppliers"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "part_suppliers_part_id_supplier_id_key" ON "part_suppliers"("part_id", "supplier_id");

-- AlterTable
ALTER TABLE "material_lots" ADD COLUMN "supplier_id" TEXT;

-- AddForeignKey
ALTER TABLE "part_suppliers" ADD CONSTRAINT "part_suppliers_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_suppliers" ADD CONSTRAINT "part_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_lots" ADD CONSTRAINT "material_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
