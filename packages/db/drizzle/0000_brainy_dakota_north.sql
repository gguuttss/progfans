CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."eligibility_status" AS ENUM('eligible', 'below_threshold', 'manual_include', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."external_source" AS ENUM('royalroad', 'amazon', 'audible', 'goodreads');--> statement-breakpoint
CREATE TYPE "public"."list_status" AS ENUM('reading', 'read', 'plan', 'dropped', 'paused');--> statement-breakpoint
CREATE TYPE "public"."mc_gender" AS ENUM('male', 'female', 'nonbinary', 'ensemble');--> statement-breakpoint
CREATE TYPE "public"."pov" AS ENUM('single', 'multiple');--> statement-breakpoint
CREATE TYPE "public"."progression_pace" AS ENUM('slow', 'moderate', 'fast');--> statement-breakpoint
CREATE TYPE "public"."rating_source" AS ENUM('progfans', 'royalroad', 'goodreads', 'audible');--> statement-breakpoint
CREATE TYPE "public"."romance" AS ENUM('none', 'subplot', 'central');--> statement-breakpoint
CREATE TYPE "public"."series_status" AS ENUM('ongoing', 'completed', 'hiatus', 'dropped', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."trope_category" AS ENUM('power_system', 'setting', 'progression', 'protagonist', 'tone', 'relationships', 'content_warning');--> statement-breakpoint
CREATE TYPE "public"."trope_source" AS ENUM('royalroad', 'goodreads', 'admin', 'user');--> statement-breakpoint
CREATE TABLE "authors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "authors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "nominations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"series_id" bigint,
	"raw_title" text,
	"note" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_records" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" "external_source" NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raw_records_source_external_uq" UNIQUE("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_url" text,
	"first_published_at" date,
	"status" "series_status" DEFAULT 'unknown' NOT NULL,
	"pov" "pov",
	"mc_gender" "mc_gender",
	"progression_pace" "progression_pace",
	"romance" "romance",
	"has_web" boolean DEFAULT false NOT NULL,
	"has_ebook" boolean DEFAULT false NOT NULL,
	"has_ku" boolean DEFAULT false NOT NULL,
	"has_audio" boolean DEFAULT false NOT NULL,
	"length_chapters" integer,
	"length_words" integer,
	"length_audio_minutes" integer,
	"popularity" integer DEFAULT 0 NOT NULL,
	"eligibility_status" "eligibility_status" DEFAULT 'eligible' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "series_authors" (
	"series_id" bigint NOT NULL,
	"author_id" bigint NOT NULL,
	CONSTRAINT "series_authors_series_id_author_id_pk" PRIMARY KEY("series_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "series_ratings" (
	"series_id" bigint NOT NULL,
	"source" "rating_source" NOT NULL,
	"value" numeric(4, 2),
	"votes" integer DEFAULT 0 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_ratings_series_id_source_pk" PRIMARY KEY("series_id","source")
);
--> statement-breakpoint
CREATE TABLE "series_tropes" (
	"series_id" bigint NOT NULL,
	"trope_id" bigint NOT NULL,
	"source" "trope_source" DEFAULT 'admin' NOT NULL,
	"confidence" real,
	CONSTRAINT "series_tropes_series_id_trope_id_pk" PRIMARY KEY("series_id","trope_id")
);
--> statement-breakpoint
CREATE TABLE "source_links" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"series_id" bigint NOT NULL,
	"source" "external_source" NOT NULL,
	"url" text NOT NULL,
	"external_id" text,
	"is_affiliate" boolean DEFAULT false NOT NULL,
	CONSTRAINT "source_links_series_source_uq" UNIQUE("series_id","source")
);
--> statement-breakpoint
CREATE TABLE "tropes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "trope_category" NOT NULL,
	"description" text,
	CONSTRAINT "tropes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "list_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"series_id" bigint NOT NULL,
	"status" "list_status" NOT NULL,
	"score" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_entries_user_series_uq" UNIQUE("user_id","series_id"),
	CONSTRAINT "list_entries_score_chk" CHECK ("list_entries"."score" is null or "list_entries"."score" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "tier_list_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tier_list_id" bigint NOT NULL,
	"series_id" bigint NOT NULL,
	"tier_id" bigint NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_list_tiers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tier_list_id" bigint NOT NULL,
	"label" text NOT NULL,
	"color" text,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_lists" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"owner_id" uuid,
	"title" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"remixed_from" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tier_lists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_authors" ADD CONSTRAINT "series_authors_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_authors" ADD CONSTRAINT "series_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_ratings" ADD CONSTRAINT "series_ratings_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_tropes" ADD CONSTRAINT "series_tropes_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_tropes" ADD CONSTRAINT "series_tropes_trope_id_tropes_id_fk" FOREIGN KEY ("trope_id") REFERENCES "public"."tropes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_links" ADD CONSTRAINT "source_links_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_entries" ADD CONSTRAINT "list_entries_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_entries" ADD CONSTRAINT "list_entries_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_list_items" ADD CONSTRAINT "tier_list_items_tier_list_id_tier_lists_id_fk" FOREIGN KEY ("tier_list_id") REFERENCES "public"."tier_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_list_items" ADD CONSTRAINT "tier_list_items_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_list_items" ADD CONSTRAINT "tier_list_items_tier_id_tier_list_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tier_list_tiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_list_tiers" ADD CONSTRAINT "tier_list_tiers_tier_list_id_tier_lists_id_fk" FOREIGN KEY ("tier_list_id") REFERENCES "public"."tier_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_lists" ADD CONSTRAINT "tier_lists_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_lists" ADD CONSTRAINT "tier_lists_remixed_from_tier_lists_id_fk" FOREIGN KEY ("remixed_from") REFERENCES "public"."tier_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "series_popularity_idx" ON "series" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "series_status_idx" ON "series" USING btree ("status");--> statement-breakpoint
CREATE INDEX "series_search_idx" ON "series" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "series_title_trgm_idx" ON "series" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "series_ratings_source_value_idx" ON "series_ratings" USING btree ("source","value");--> statement-breakpoint
CREATE INDEX "series_tropes_trope_idx" ON "series_tropes" USING btree ("trope_id");