-- AlterTable
ALTER TABLE "material_lots" ADD COLUMN     "qty_reserved" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "part_masters" ALTER COLUMN "category" SET DEFAULT 'component';

-- AlterTable
ALTER TABLE "routings" ADD COLUMN     "serial_format" TEXT;

-- AlterTable
ALTER TABLE "unit_operation_executions" ADD COLUMN     "attempt_number" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "is_rework" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "units" ADD COLUMN     "serial_assigned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "customer_name" TEXT,
ADD COLUMN     "customer_order_ref" TEXT,
ADD COLUMN     "drafted_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "kitting_started_at" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "shipped_at" TIMESTAMP(3),
ADD COLUMN     "target_start_date" TIMESTAMP(3),
ADD COLUMN     "testing_started_at" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'draft';

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "material_lot_id" TEXT NOT NULL,
    "material_code" TEXT NOT NULL,
    "qty_reserved" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eol_test_suites" (
    "id" TEXT NOT NULL,
    "routing_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eol_test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eol_test_parameters" (
    "id" TEXT NOT NULL,
    "suite_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "min_value" DOUBLE PRECISION,
    "max_value" DOUBLE PRECISION,
    "target_value" DOUBLE PRECISION,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eol_test_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eol_test_results" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "suite_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "composite_result" TEXT NOT NULL,
    "parameter_results" JSONB NOT NULL,
    "notes" TEXT,
    "tested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eol_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "material_lot_id" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "previous_qty" DOUBLE PRECISION NOT NULL,
    "new_qty" DOUBLE PRECISION NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "reason" TEXT,
    "operator_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_reservations_work_order_id_idx" ON "inventory_reservations"("work_order_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_material_lot_id_idx" ON "inventory_reservations"("material_lot_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_material_code_idx" ON "inventory_reservations"("material_code");

-- CreateIndex
CREATE INDEX "eol_test_suites_routing_id_idx" ON "eol_test_suites"("routing_id");

-- CreateIndex
CREATE INDEX "eol_test_parameters_suite_id_idx" ON "eol_test_parameters"("suite_id");

-- CreateIndex
CREATE INDEX "eol_test_results_unit_id_idx" ON "eol_test_results"("unit_id");

-- CreateIndex
CREATE INDEX "eol_test_results_suite_id_idx" ON "eol_test_results"("suite_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_material_lot_id_timestamp_idx" ON "inventory_transactions"("material_lot_id", "timestamp");

-- CreateIndex
CREATE INDEX "inventory_transactions_transaction_type_idx" ON "inventory_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "inventory_transactions_reference_type_reference_id_idx" ON "inventory_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_operator_id_timestamp_idx" ON "inventory_transactions"("operator_id", "timestamp");

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_material_lot_id_fkey" FOREIGN KEY ("material_lot_id") REFERENCES "material_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eol_test_suites" ADD CONSTRAINT "eol_test_suites_routing_id_fkey" FOREIGN KEY ("routing_id") REFERENCES "routings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eol_test_parameters" ADD CONSTRAINT "eol_test_parameters_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "eol_test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eol_test_results" ADD CONSTRAINT "eol_test_results_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eol_test_results" ADD CONSTRAINT "eol_test_results_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "eol_test_suites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_material_lot_id_fkey" FOREIGN KEY ("material_lot_id") REFERENCES "material_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
