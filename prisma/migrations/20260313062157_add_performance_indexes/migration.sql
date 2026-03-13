-- CreateIndex
CREATE INDEX "material_lots_status_qty_remaining_idx" ON "material_lots"("status", "qty_remaining");

-- CreateIndex
CREATE INDEX "material_lots_purchase_order_number_idx" ON "material_lots"("purchase_order_number");

-- CreateIndex
CREATE INDEX "nonconformance_records_station_id_status_idx" ON "nonconformance_records"("station_id", "status");

-- CreateIndex
CREATE INDEX "quality_check_results_timestamp_idx" ON "quality_check_results"("timestamp");

-- CreateIndex
CREATE INDEX "quality_check_results_definition_id_timestamp_idx" ON "quality_check_results"("definition_id", "timestamp");

-- CreateIndex
CREATE INDEX "unit_operation_executions_station_id_completed_at_idx" ON "unit_operation_executions"("station_id", "completed_at");

-- CreateIndex
CREATE INDEX "unit_operation_executions_operator_id_completed_at_idx" ON "unit_operation_executions"("operator_id", "completed_at");

-- CreateIndex
CREATE INDEX "units_current_station_id_idx" ON "units"("current_station_id");
