-- CreateEnum
CREATE TYPE "Role" AS ENUM ('operator', 'supervisor', 'admin');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "timestamp_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "station_id" TEXT,
    "work_order_id" TEXT,
    "unit_id" TEXT,
    "operator_id" TEXT,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "config" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "station_type" TEXT NOT NULL,
    "sequence_order" INTEGER NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downtime_reasons" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "loss_type" TEXT NOT NULL,
    "is_planned" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "downtime_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_check_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "check_type" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "station_ids" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_check_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "product_code" TEXT NOT NULL,
    "operations" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'operator',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "routing_id" TEXT,
    "order_number" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT,
    "qty_ordered" INTEGER NOT NULL,
    "qty_completed" INTEGER NOT NULL DEFAULT 0,
    "qty_scrap" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "released_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_operations" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "estimated_minutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "current_station_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_operation_executions" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "result" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_operation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_lots" (
    "id" TEXT NOT NULL,
    "lot_number" TEXT NOT NULL,
    "material_code" TEXT NOT NULL,
    "description" TEXT,
    "qty_received" DOUBLE PRECISION NOT NULL,
    "qty_remaining" DOUBLE PRECISION NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_material_consumptions" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "material_lot_id" TEXT NOT NULL,
    "qty_consumed" DOUBLE PRECISION NOT NULL,
    "station_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_material_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_check_results" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "values_json" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nonconformance_records" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "defect_type" TEXT NOT NULL,
    "description" TEXT,
    "disposition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "nonconformance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downtime_intervals" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "reason_id" TEXT,
    "operator_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "downtime_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserSites" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserSites_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_idempotency_key_key" ON "events"("idempotency_key");

-- CreateIndex
CREATE INDEX "events_event_type_idx" ON "events"("event_type");

-- CreateIndex
CREATE INDEX "events_work_order_id_idx" ON "events"("work_order_id");

-- CreateIndex
CREATE INDEX "events_unit_id_idx" ON "events"("unit_id");

-- CreateIndex
CREATE INDEX "events_station_id_timestamp_utc_idx" ON "events"("station_id", "timestamp_utc");

-- CreateIndex
CREATE INDEX "events_site_id_timestamp_utc_idx" ON "events"("site_id", "timestamp_utc");

-- CreateIndex
CREATE INDEX "stations_site_id_idx" ON "stations"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "downtime_reasons_site_id_code_key" ON "downtime_reasons"("site_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_order_number_key" ON "work_orders"("order_number");

-- CreateIndex
CREATE INDEX "work_orders_site_id_status_idx" ON "work_orders"("site_id", "status");

-- CreateIndex
CREATE INDEX "work_orders_order_number_idx" ON "work_orders"("order_number");

-- CreateIndex
CREATE INDEX "work_order_operations_station_id_idx" ON "work_order_operations"("station_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_operations_work_order_id_sequence_key" ON "work_order_operations"("work_order_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "units_serial_number_key" ON "units"("serial_number");

-- CreateIndex
CREATE INDEX "units_work_order_id_idx" ON "units"("work_order_id");

-- CreateIndex
CREATE INDEX "units_status_idx" ON "units"("status");

-- CreateIndex
CREATE INDEX "unit_operation_executions_unit_id_idx" ON "unit_operation_executions"("unit_id");

-- CreateIndex
CREATE INDEX "unit_operation_executions_station_id_started_at_idx" ON "unit_operation_executions"("station_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "material_lots_lot_number_key" ON "material_lots"("lot_number");

-- CreateIndex
CREATE INDEX "material_lots_material_code_idx" ON "material_lots"("material_code");

-- CreateIndex
CREATE INDEX "unit_material_consumptions_unit_id_idx" ON "unit_material_consumptions"("unit_id");

-- CreateIndex
CREATE INDEX "unit_material_consumptions_material_lot_id_idx" ON "unit_material_consumptions"("material_lot_id");

-- CreateIndex
CREATE INDEX "quality_check_results_unit_id_idx" ON "quality_check_results"("unit_id");

-- CreateIndex
CREATE INDEX "nonconformance_records_unit_id_idx" ON "nonconformance_records"("unit_id");

-- CreateIndex
CREATE INDEX "nonconformance_records_status_idx" ON "nonconformance_records"("status");

-- CreateIndex
CREATE INDEX "downtime_intervals_station_id_started_at_idx" ON "downtime_intervals"("station_id", "started_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_timestamp_idx" ON "audit_logs"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "_UserSites_B_index" ON "_UserSites"("B");

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_reasons" ADD CONSTRAINT "downtime_reasons_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_routing_id_fkey" FOREIGN KEY ("routing_id") REFERENCES "routings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_operations" ADD CONSTRAINT "work_order_operations_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_operations" ADD CONSTRAINT "work_order_operations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_operation_executions" ADD CONSTRAINT "unit_operation_executions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_operation_executions" ADD CONSTRAINT "unit_operation_executions_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "work_order_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_operation_executions" ADD CONSTRAINT "unit_operation_executions_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_operation_executions" ADD CONSTRAINT "unit_operation_executions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_material_consumptions" ADD CONSTRAINT "unit_material_consumptions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_material_consumptions" ADD CONSTRAINT "unit_material_consumptions_material_lot_id_fkey" FOREIGN KEY ("material_lot_id") REFERENCES "material_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_material_consumptions" ADD CONSTRAINT "unit_material_consumptions_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_material_consumptions" ADD CONSTRAINT "unit_material_consumptions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_check_results" ADD CONSTRAINT "quality_check_results_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_check_results" ADD CONSTRAINT "quality_check_results_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "quality_check_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_check_results" ADD CONSTRAINT "quality_check_results_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonconformance_records" ADD CONSTRAINT "nonconformance_records_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonconformance_records" ADD CONSTRAINT "nonconformance_records_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_intervals" ADD CONSTRAINT "downtime_intervals_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_intervals" ADD CONSTRAINT "downtime_intervals_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "downtime_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_intervals" ADD CONSTRAINT "downtime_intervals_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserSites" ADD CONSTRAINT "_UserSites_A_fkey" FOREIGN KEY ("A") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserSites" ADD CONSTRAINT "_UserSites_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
