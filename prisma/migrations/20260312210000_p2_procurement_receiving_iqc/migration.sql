-- DropForeignKey
ALTER TABLE "nonconformance_records" DROP CONSTRAINT "nonconformance_records_station_id_fkey";

-- DropForeignKey
ALTER TABLE "nonconformance_records" DROP CONSTRAINT "nonconformance_records_unit_id_fkey";

-- AlterTable
ALTER TABLE "material_lots" ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "condition_notes" TEXT,
ADD COLUMN     "po_line_item_id" TEXT,
ADD COLUMN     "tracking_number" TEXT;

-- AlterTable
ALTER TABLE "nonconformance_records" ADD COLUMN     "action_due_date" TIMESTAMP(3),
ADD COLUMN     "affected_qty" DOUBLE PRECISION,
ADD COLUMN     "corrective_action" TEXT,
ADD COLUMN     "disposition_rationale" TEXT,
ADD COLUMN     "failed_dimensions" JSONB,
ADD COLUMN     "material_lot_id" TEXT,
ADD COLUMN     "ncr_number" TEXT,
ADD COLUMN     "part_number" TEXT,
ADD COLUMN     "part_revision" TEXT,
ADD COLUMN     "purchase_order_id" TEXT,
ADD COLUMN     "responsible_party" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'production',
ADD COLUMN     "supplier_notified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplier_notified_at" TIMESTAMP(3),
ALTER COLUMN "unit_id" DROP NOT NULL,
ALTER COLUMN "station_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "buyer_name" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_terms" TEXT,
    "shipping_method" TEXT,
    "total_value" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_line_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "part_number" TEXT NOT NULL,
    "part_revision" TEXT NOT NULL DEFAULT 'A',
    "supplier_part_number" TEXT,
    "description" TEXT,
    "qty_ordered" DOUBLE PRECISION NOT NULL,
    "qty_received" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_of_measure" TEXT NOT NULL DEFAULT 'EA',
    "unit_cost" DOUBLE PRECISION,
    "total_cost" DOUBLE PRECISION,
    "country_of_origin" TEXT,
    "expected_lead_time_days" INTEGER,
    "drawing_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incoming_inspections" (
    "id" TEXT NOT NULL,
    "material_lot_id" TEXT NOT NULL,
    "inspector_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "overall_result" TEXT,
    "disposition_notes" TEXT,
    "approved_by_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incoming_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iqc_results" (
    "id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "ctq_definition_id" TEXT NOT NULL,
    "sample_number" INTEGER NOT NULL,
    "measured_value" DOUBLE PRECISION NOT NULL,
    "result" TEXT NOT NULL,
    "inspector_id" TEXT NOT NULL,
    "notes" TEXT,
    "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iqc_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_order_date_idx" ON "purchase_orders"("order_date");

-- CreateIndex
CREATE INDEX "purchase_order_line_items_part_number_idx" ON "purchase_order_line_items"("part_number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_line_items_purchase_order_id_line_number_key" ON "purchase_order_line_items"("purchase_order_id", "line_number");

-- CreateIndex
CREATE INDEX "incoming_inspections_material_lot_id_idx" ON "incoming_inspections"("material_lot_id");

-- CreateIndex
CREATE INDEX "incoming_inspections_status_idx" ON "incoming_inspections"("status");

-- CreateIndex
CREATE INDEX "incoming_inspections_inspector_id_idx" ON "incoming_inspections"("inspector_id");

-- CreateIndex
CREATE INDEX "iqc_results_inspection_id_idx" ON "iqc_results"("inspection_id");

-- CreateIndex
CREATE INDEX "iqc_results_ctq_definition_id_idx" ON "iqc_results"("ctq_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "nonconformance_records_ncr_number_key" ON "nonconformance_records"("ncr_number");

-- CreateIndex
CREATE INDEX "nonconformance_records_material_lot_id_idx" ON "nonconformance_records"("material_lot_id");

-- AddForeignKey
ALTER TABLE "nonconformance_records" ADD CONSTRAINT "nonconformance_records_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonconformance_records" ADD CONSTRAINT "nonconformance_records_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonconformance_records" ADD CONSTRAINT "nonconformance_records_material_lot_id_fkey" FOREIGN KEY ("material_lot_id") REFERENCES "material_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_line_items" ADD CONSTRAINT "purchase_order_line_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incoming_inspections" ADD CONSTRAINT "incoming_inspections_material_lot_id_fkey" FOREIGN KEY ("material_lot_id") REFERENCES "material_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incoming_inspections" ADD CONSTRAINT "incoming_inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incoming_inspections" ADD CONSTRAINT "incoming_inspections_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iqc_results" ADD CONSTRAINT "iqc_results_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "incoming_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iqc_results" ADD CONSTRAINT "iqc_results_ctq_definition_id_fkey" FOREIGN KEY ("ctq_definition_id") REFERENCES "ctq_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iqc_results" ADD CONSTRAINT "iqc_results_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
