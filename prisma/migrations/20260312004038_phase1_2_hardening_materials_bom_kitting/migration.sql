-- AlterTable
ALTER TABLE "material_lots" ADD COLUMN     "purchase_order_number" TEXT,
ADD COLUMN     "received_by_id" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'available',
ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "unit_of_measure" TEXT NOT NULL DEFAULT 'EA';

-- AlterTable
ALTER TABLE "unit_operation_executions" ADD COLUMN     "cycle_time_minutes" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "bill_of_materials" (
    "id" TEXT NOT NULL,
    "routing_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "material_code" TEXT NOT NULL,
    "description" TEXT,
    "qty_per_unit" DOUBLE PRECISION NOT NULL,
    "unit_of_measure" TEXT NOT NULL DEFAULT 'EA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kits" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_by_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3),
    "issued_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_lines" (
    "id" TEXT NOT NULL,
    "kit_id" TEXT NOT NULL,
    "material_code" TEXT NOT NULL,
    "description" TEXT,
    "qty_required" DOUBLE PRECISION NOT NULL,
    "qty_picked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "material_lot_id" TEXT,
    "picked_by_id" TEXT,
    "picked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kit_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bill_of_materials_routing_id_idx" ON "bill_of_materials"("routing_id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_of_materials_routing_id_material_code_station_id_key" ON "bill_of_materials"("routing_id", "material_code", "station_id");

-- CreateIndex
CREATE UNIQUE INDEX "kits_work_order_id_key" ON "kits"("work_order_id");

-- CreateIndex
CREATE INDEX "kits_status_idx" ON "kits"("status");

-- CreateIndex
CREATE INDEX "kit_lines_kit_id_idx" ON "kit_lines"("kit_id");

-- CreateIndex
CREATE INDEX "material_lots_status_idx" ON "material_lots"("status");

-- AddForeignKey
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_routing_id_fkey" FOREIGN KEY ("routing_id") REFERENCES "routings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_lots" ADD CONSTRAINT "material_lots_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kits" ADD CONSTRAINT "kits_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kits" ADD CONSTRAINT "kits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kits" ADD CONSTRAINT "kits_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_lines" ADD CONSTRAINT "kit_lines_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "kits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_lines" ADD CONSTRAINT "kit_lines_material_lot_id_fkey" FOREIGN KEY ("material_lot_id") REFERENCES "material_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_lines" ADD CONSTRAINT "kit_lines_picked_by_id_fkey" FOREIGN KEY ("picked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
