CREATE TABLE "series_popularity" (
	"series_id" bigint NOT NULL,
	"source" "rating_source" NOT NULL,
	"value" integer NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_popularity_series_id_source_pk" PRIMARY KEY("series_id","source")
);
--> statement-breakpoint
ALTER TABLE "series_popularity" ADD CONSTRAINT "series_popularity_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "series_popularity_source_value_idx" ON "series_popularity" USING btree ("source","value");