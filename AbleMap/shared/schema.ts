import { pgTable, text, varchar, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  markerColor: text("marker_color").notNull(),
  icon: text("icon"),
});

// Using places_accessibility as the main place table now
export const places = pgTable("places_accessibility", {
  id: serial("id").primaryKey(),
  kakaoPlaceId: varchar("kakao_place_id").notNull(),
  placeName: varchar("place_name").notNull(),
  latitude: varchar("latitude"),
  longitude: varchar("longitude"),
  accessibilityScore: integer("accessibility_score"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export const insertPlaceSchema = createInsertSchema(places).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Place = typeof places.$inferSelect & {
  accessibilityScore?: number | null;
  accessibilitySummary?: string | null;
  name?: string;
  address?: string;
  phone?: string;
  kakaoUrl?: string;
  facilities?: Facility[];
  categoryId?: number;
};
export type InsertPlace = z.infer<typeof insertPlaceSchema>;

export type Facility = {
  name: string;
  available: boolean;
};

export type SearchResult = {
  id: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  nickname: text("nickname").notNull(),
  authProvider: text("auth_provider").notNull().default("kakao"),
  authProviderId: text("auth_provider_id").notNull().unique(),
  bookmarkedPlaceIds: text("bookmarked_place_ids").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  nickname: z.string(),
  authProvider: z.string().default("kakao"),
  authProviderId: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;



// 접근성 정보 타입 정의
export type AccessibilityReport = {
  summary: string;
  recommendations: string[];
  accessibility_score: number;
  highlighted_obstacles: string[];
  ai_analysis?: {
    has_stairs: boolean;
    has_ramp: boolean;
    entrance_accessible: boolean;
    obstacles: string[];
    obstacle_details?: Record<string, any>;
  };
  facility_details?: {
    entrance: {
      accessible: boolean;
      features: string[];
    };
    restroom: {
      available: boolean;
      features: string[];
    };
    parking: {
      available: boolean;
      features: string[];
    };
    elevator: {
      available: boolean;
    };
  };
};



// 서비스 피드백 테이블
export const serviceFeedback = pgTable("service_feedback", {
  id: serial("id").primaryKey(),
  satisfactionLevel: text("satisfaction_level").notNull(), // 'satisfied' or 'dissatisfied'
  feedbackDetails: text("feedback_details").array(), // 상세 피드백 옵션들
  userAgent: text("user_agent"), // 브라우저 정보
  deviceId: text("device_id"), // 비로그인 사용자용
  userId: text("user_id"), // 로그인 사용자용 (auth_provider_id)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertServiceFeedbackSchema = createInsertSchema(serviceFeedback).omit({
  id: true,
  createdAt: true,
});

export type ServiceFeedback = typeof serviceFeedback.$inferSelect;
export type InsertServiceFeedback = z.infer<typeof insertServiceFeedbackSchema>;

// 북마크 테이블 - user_id 배열 기반 구조
export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").array().notNull().default([]), // 북마크한 유저 ID들의 배열
  placeId: text("place_id").notNull().unique(), // 카카오 POI ID
  placeName: text("place_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;

// place_temp 테이블 추가
export const placeTemp = pgTable("place_temp", {
  id: serial("id").primaryKey(),
  placeId: varchar("place_id").notNull(),
  placeName: varchar("place_name").notNull(),
  coordinatesLat: varchar("coordinates_lat").notNull(),
  coordinatesLng: varchar("coordinates_lng").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlaceTempSchema = createInsertSchema(placeTemp).omit({
  id: true,
  createdAt: true,
});

export type PlaceTemp = typeof placeTemp.$inferSelect;
export type InsertPlaceTemp = z.infer<typeof insertPlaceTempSchema>;

// 접근성 리포트 테이블
export const accessibilityReports = pgTable("accessibility_reports", {
  id: serial("id").primaryKey(),
  placeId: integer("place_id").references(() => places.id).notNull(),
  kakaoPlaceId: varchar("kakao_place_id").notNull(),
  summary: text("summary").notNull(),
  accessibilityScore: integer("accessibility_score").notNull(),
  recommendations: jsonb("recommendations").notNull(), // string[]
  highlightedObstacles: jsonb("highlighted_obstacles").notNull(), // string[]
  aiAnalysis: jsonb("ai_analysis"), // AI 분석 결과 객체
  facilityDetails: jsonb("facility_details"), // 시설별 상세 정보 객체
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAccessibilityReportSchema = createInsertSchema(accessibilityReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AccessibilityReportDb = typeof accessibilityReports.$inferSelect;
export type InsertAccessibilityReport = z.infer<typeof insertAccessibilityReportSchema>;

// 장소 이미지 테이블
export const placeImages = pgTable("place_images", {
  id: serial("id").primaryKey(),
  placeId: integer("place_id").references(() => places.id).notNull(),
  accessibilityReportId: integer("accessibility_report_id").references(() => accessibilityReports.id),
  imageType: varchar("image_type").notNull(), // entrance, elevator, toilet, general 등
  imageUrl: text("image_url").notNull(), // 파일 경로
  description: text("description"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlaceImageSchema = createInsertSchema(placeImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlaceImage = typeof placeImages.$inferSelect;
export type InsertPlaceImage = z.infer<typeof insertPlaceImageSchema>;

// 사용자 업로드 이미지 테이블
export const userImages = pgTable("user_images", {
  id: serial("id").primaryKey(),
  poiId: text("poi_id").notNull(), // 카카오 POI ID
  placeName: text("place_name").notNull(), // 장소 이름
  username: text("username").notNull(), // 사용자명
  imageUrl: text("image_url").notNull(), // 저장된 이미지 경로
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(), // 업로드 시간
});

export const insertUserImageSchema = createInsertSchema(userImages).omit({
  id: true,
  uploadedAt: true,
});

export type UserImage = typeof userImages.$inferSelect;
export type InsertUserImage = z.infer<typeof insertUserImageSchema>;

