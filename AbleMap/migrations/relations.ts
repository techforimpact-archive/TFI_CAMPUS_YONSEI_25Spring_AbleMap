import { relations } from "drizzle-orm/relations";
import { placesAccessibility, accessibilityReports, placeImages, users, bookmarks } from "./schema";

export const accessibilityReportsRelations = relations(accessibilityReports, ({one, many}) => ({
	placesAccessibility: one(placesAccessibility, {
		fields: [accessibilityReports.placeId],
		references: [placesAccessibility.id]
	}),
	placeImages: many(placeImages),
}));

export const placesAccessibilityRelations = relations(placesAccessibility, ({many}) => ({
	accessibilityReports: many(accessibilityReports),
	placeImages: many(placeImages),
	bookmarks: many(bookmarks),
}));

export const placeImagesRelations = relations(placeImages, ({one}) => ({
	placesAccessibility: one(placesAccessibility, {
		fields: [placeImages.placeId],
		references: [placesAccessibility.id]
	}),
	accessibilityReport: one(accessibilityReports, {
		fields: [placeImages.accessibilityReportId],
		references: [accessibilityReports.id]
	}),
	user: one(users, {
		fields: [placeImages.uploadedBy],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	placeImages: many(placeImages),
	bookmarks: many(bookmarks),
}));

export const bookmarksRelations = relations(bookmarks, ({one}) => ({
	user: one(users, {
		fields: [bookmarks.userId],
		references: [users.id]
	}),
	placesAccessibility: one(placesAccessibility, {
		fields: [bookmarks.placeId],
		references: [placesAccessibility.id]
	}),
}));