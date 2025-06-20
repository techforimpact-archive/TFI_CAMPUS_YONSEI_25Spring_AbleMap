import { pgTable, unique, serial, text, timestamp, varchar, integer, foreignKey, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const categories = pgTable("categories", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	key: text().notNull(),
	markerColor: text("marker_color").notNull(),
	icon: text(),
}, (table) => [
	unique("categories_key_unique").on(table.key),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	nickname: text().notNull(),
	authProvider: text("auth_provider").default('kakao').notNull(),
	authProviderId: text("auth_provider_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	bookmarkedPlaceIds: text("bookmarked_place_ids").array().default([""]),
}, (table) => [
	unique("users_auth_provider_id_unique").on(table.authProviderId),
]);

export const serviceFeedback = pgTable("service_feedback", {
	id: serial().primaryKey().notNull(),
	satisfactionLevel: text("satisfaction_level").notNull(),
	feedbackDetails: text("feedback_details").array(),
	userAgent: text("user_agent"),
	deviceId: text("device_id"),
	userId: text("user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const placesAccessibility = pgTable("places_accessibility", {
	id: serial().primaryKey().notNull(),
	kakaoPlaceId: varchar("kakao_place_id").notNull(),
	placeName: varchar("place_name").notNull(),
	latitude: varchar(),
	longitude: varchar(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	accessibilityScore: integer("accessibility_score"),
});

export const placeTemp = pgTable("place_temp", {
	id: serial().primaryKey().notNull(),
	placeId: varchar("place_id").notNull(),
	placeName: varchar("place_name").notNull(),
	coordinatesLat: varchar("coordinates_lat").notNull(),
	coordinatesLng: varchar("coordinates_lng").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const userImages = pgTable("user_images", {
	id: serial().primaryKey().notNull(),
	poiId: text("poi_id").notNull(),
	placeName: text("place_name").notNull(),
	username: text().notNull(),
	imageUrl: text("image_url").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
});

export const accessibilityReports = pgTable("accessibility_reports", {
	id: serial().primaryKey().notNull(),
	placeId: integer("place_id").notNull(),
	kakaoPlaceId: varchar("kakao_place_id").notNull(),
	summary: text().notNull(),
	accessibilityScore: integer("accessibility_score").notNull(),
	recommendations: jsonb().notNull(),
	highlightedObstacles: jsonb("highlighted_obstacles").notNull(),
	aiAnalysis: jsonb("ai_analysis"),
	facilityDetails: jsonb("facility_details"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.placeId],
			foreignColumns: [placesAccessibility.id],
			name: "accessibility_reports_place_id_places_accessibility_id_fk"
		}),
]);

export const placeImages = pgTable("place_images", {
	id: serial().primaryKey().notNull(),
	placeId: integer("place_id").notNull(),
	accessibilityReportId: integer("accessibility_report_id"),
	imageType: varchar("image_type").notNull(),
	imageUrl: text("image_url").notNull(),
	description: text(),
	uploadedBy: integer("uploaded_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.placeId],
			foreignColumns: [placesAccessibility.id],
			name: "place_images_place_id_places_accessibility_id_fk"
		}),
	foreignKey({
			columns: [table.accessibilityReportId],
			foreignColumns: [accessibilityReports.id],
			name: "place_images_accessibility_report_id_accessibility_reports_id_f"
		}),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "place_images_uploaded_by_users_id_fk"
		}),
]);

export const bookmarks = pgTable("bookmarks", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	placeId: integer("place_id").notNull(),
	placeName: text("place_name").notNull(),
	placeAddress: text("place_address"),
	placeLatitude: text("place_latitude"),
	placeLongitude: text("place_longitude"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "bookmarks_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.placeId],
			foreignColumns: [placesAccessibility.id],
			name: "bookmarks_place_id_places_accessibility_id_fk"
		}),
]);
