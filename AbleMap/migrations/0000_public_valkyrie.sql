CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"marker_color" text NOT NULL,
	"icon" text,
	CONSTRAINT "categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "place_id_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"kakao_id" text NOT NULL,
	"internal_id" integer NOT NULL,
	"place_id" integer,
	"mapping_source" text DEFAULT 'manual',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "place_id_mappings_kakao_id_unique" UNIQUE("kakao_id")
);
--> statement-breakpoint
CREATE TABLE "place_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"place_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"image_type" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"phone" text,
	"hours" text,
	"category_id" integer NOT NULL,
	"rating" text,
	"review_count" integer,
	"distance" text,
	"facilities" jsonb,
	"accessibility" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"auth_provider" text DEFAULT 'kakao' NOT NULL,
	"auth_provider_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_provider_id_unique" UNIQUE("auth_provider_id")
);
--> statement-breakpoint
ALTER TABLE "place_id_mappings" ADD CONSTRAINT "place_id_mappings_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_images" ADD CONSTRAINT "place_images_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;