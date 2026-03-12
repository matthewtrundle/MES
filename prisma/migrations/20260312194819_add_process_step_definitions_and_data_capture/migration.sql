-- CreateTable
CREATE TABLE "process_step_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "station_id" TEXT,
    "sequence_order" INTEGER NOT NULL DEFAULT 0,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "requires_signoff" BOOLEAN NOT NULL DEFAULT false,
    "triggers_qc" BOOLEAN NOT NULL DEFAULT false,
    "cycle_time_target" DOUBLE PRECISION,
    "data_fields" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_step_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_data_captures" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "step_definition_id" TEXT NOT NULL,
    "captured_data" JSONB NOT NULL,
    "operator_id" TEXT NOT NULL,
    "signed_off" BOOLEAN NOT NULL DEFAULT false,
    "signed_off_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_data_captures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "step_data_captures_execution_id_step_definition_id_key" ON "step_data_captures"("execution_id", "step_definition_id");

-- AddForeignKey
ALTER TABLE "process_step_definitions" ADD CONSTRAINT "process_step_definitions_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_data_captures" ADD CONSTRAINT "step_data_captures_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "unit_operation_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_data_captures" ADD CONSTRAINT "step_data_captures_step_definition_id_fkey" FOREIGN KEY ("step_definition_id") REFERENCES "process_step_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_data_captures" ADD CONSTRAINT "step_data_captures_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
