CREATE INDEX IF NOT EXISTS "idx_vin_lookup" ON "vin_stubs" USING btree ("year","make_normalized","model_normalized","submodel_normalized");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vin_base" ON "vin_stubs" USING btree ("year","make_normalized","model_normalized");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vin_makes" ON "vin_stubs" USING btree ("make_normalized");--> statement-breakpoint
ALTER TABLE "vin_stubs" ADD CONSTRAINT "vin_stubs_year_make_model_submodel_unique" UNIQUE("year","make_normalized","model_normalized","submodel_normalized");