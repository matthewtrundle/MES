-- CreateTable
CREATE TABLE "ctq_definitions" (
    "id" TEXT NOT NULL,
    "part_number" TEXT NOT NULL,
    "revision" TEXT NOT NULL DEFAULT 'A',
    "dimension_name" TEXT NOT NULL,
    "nominal" DOUBLE PRECISION NOT NULL,
    "usl" DOUBLE PRECISION NOT NULL,
    "lsl" DOUBLE PRECISION NOT NULL,
    "unit_of_measure" TEXT NOT NULL,
    "measurement_tool" TEXT,
    "method_note" TEXT,
    "sample_size_rule" TEXT NOT NULL DEFAULT 'all',
    "sample_size" INTEGER,
    "safety_critical" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ctq_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctq_measurements" (
    "id" TEXT NOT NULL,
    "ctq_definition_id" TEXT NOT NULL,
    "material_lot_id" TEXT,
    "sample_number" INTEGER NOT NULL,
    "measured_value" DOUBLE PRECISION NOT NULL,
    "result" TEXT NOT NULL,
    "inspector_id" TEXT NOT NULL,
    "notes" TEXT,
    "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctq_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ctq_definitions_part_number_revision_idx" ON "ctq_definitions"("part_number", "revision");

-- CreateIndex
CREATE INDEX "ctq_measurements_ctq_definition_id_idx" ON "ctq_measurements"("ctq_definition_id");

-- CreateIndex
CREATE INDEX "ctq_measurements_material_lot_id_idx" ON "ctq_measurements"("material_lot_id");

-- AddForeignKey
ALTER TABLE "ctq_measurements" ADD CONSTRAINT "ctq_measurements_ctq_definition_id_fkey" FOREIGN KEY ("ctq_definition_id") REFERENCES "ctq_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctq_measurements" ADD CONSTRAINT "ctq_measurements_material_lot_id_fkey" FOREIGN KEY ("material_lot_id") REFERENCES "material_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctq_measurements" ADD CONSTRAINT "ctq_measurements_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
