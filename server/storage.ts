import { 
  users, type User, type InsertUser,
  categories, type Category, type InsertCategory,
  places, type Place, type InsertPlace, Facility, AccessibilityReport,
  serviceFeedback, type ServiceFeedback, type InsertServiceFeedback,
  bookmarks, type Bookmark, type InsertBookmark,
  accessibilityReports, type AccessibilityReportDb, type InsertAccessibilityReport,
  placeImages, type PlaceImage, type InsertPlaceImage,
  userImages, type UserImage, type InsertUserImage
} from "@shared/schema";
import { db } from "./db";
import { eq, like, or, and, sql } from "drizzle-orm";

// Interface defining all storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByNickname(nickname: string): Promise<User | undefined>;
  getUserByAuthId(authProviderId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLoginTime(id: number): Promise<void>;
  
  // Category operations
  getAllCategories(): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Place operations
  getAllPlaces(): Promise<Place[]>;
  getPlaceById(id: number): Promise<Place | undefined>;
  getPlaceByKakaoId(kakaoId: string): Promise<Place | undefined>;
  getPlacesByCategory(categoryId: number): Promise<Place[]>;
  searchPlaces(query: string): Promise<Place[]>;
  getNearbyPlaces(lat: string, lng: string, radius?: number): Promise<Place[]>;
  createPlace(place: InsertPlace): Promise<Place>;
  updatePlaceAccessibility(id: number, accessibilityInfo: AccessibilityReport): Promise<Place>;
  
  // Accessibility Report operations
  getAccessibilityReport(placeId: number): Promise<AccessibilityReportDb | undefined>;
  getAccessibilityReportByKakaoId(kakaoPlaceId: string): Promise<AccessibilityReportDb | undefined>;
  createAccessibilityReport(report: InsertAccessibilityReport): Promise<AccessibilityReportDb>;
  updateAccessibilityReport(id: number, report: Partial<InsertAccessibilityReport>): Promise<AccessibilityReportDb>;
  
  // Place Image operations
  getPlaceImages(placeId: number, imageType?: string): Promise<PlaceImage[]>;
  createPlaceImage(image: InsertPlaceImage): Promise<PlaceImage>;
  deletePlaceImage(id: number): Promise<void>;
  
  // Service Feedback operations
  createServiceFeedback(feedback: InsertServiceFeedback): Promise<ServiceFeedback>;
  
  // Bookmark operations
  getUserBookmarks(userId: number): Promise<Bookmark[]>;
  addBookmark(placeId: string, placeName: string, userId: number): Promise<Bookmark>;
  removeBookmark(placeId: string, userId: number): Promise<void>;
  isBookmarked(placeId: string, userId: number): Promise<boolean>;
  
  // User Image operations
  getUserImages(poiId?: string): Promise<UserImage[]>;
  getUserImagesByUsername(username: string): Promise<UserImage[]>;
  createUserImage(userImage: InsertUserImage): Promise<UserImage>;
  deleteUserImage(id: number): Promise<void>;
  
  // Database initialization
  initializeDefaultData(): Promise<void>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  constructor() {
    // No need for initialization here since we'll use the DB
  }

  async initializeDefaultData(): Promise<void> {
    // Check if we need to initialize (no categories exist)
    const existingCategories = await this.getAllCategories();
    if (existingCategories.length > 0) {
      return; // Data already exists
    }

    // Add categories only (no sample places)
    await this.createCategory({ name: "음식점", key: "food", markerColor: "#FF5757", icon: "🍽️" });
    await this.createCategory({ name: "카페", key: "cafe", markerColor: "#7FB77E", icon: "☕" });
    await this.createCategory({ name: "쇼핑", key: "shopping", markerColor: "#F7D060", icon: "🛍️" });
    await this.createCategory({ name: "문화/관광", key: "culture", markerColor: "#98ABEE", icon: "🎭" });
    await this.createCategory({ name: "교통", key: "transport", markerColor: "#A9A9A9", icon: "🚆" });
    await this.createCategory({ name: "교육", key: "education", markerColor: "#9C56D5", icon: "🎓" });
    await this.createCategory({ name: "편의점", key: "convenience", markerColor: "#FF9800", icon: "🏪" });

    console.log("✅ 카테고리 데이터가 성공적으로 생성되었습니다.");
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByNickname(nickname: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.nickname, nickname));
    return user;
  }
  
  async getUserByAuthId(authProviderId: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.authProviderId, authProviderId));
      return user;
    } catch (e) {
      console.error("getUserByAuthId 오류:", e);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      console.log("Creating user with data:", JSON.stringify(insertUser));
      const now = new Date();
      const [user] = await db.insert(users).values({
        nickname: insertUser.nickname,
        authProvider: insertUser.authProvider,
        authProviderId: insertUser.authProviderId,
        updatedAt: now
      }).returning();
      console.log("User created successfully:", JSON.stringify(user));
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUserLoginTime(id: number): Promise<void> {
    try {
      const now = new Date();
      await db.update(users)
        .set({ updatedAt: now })
        .where(eq(users.id, id));
      console.log(`사용자 로그인 시간 업데이트 완료: ID=${id}, 시간=${now.toISOString()}`);
    } catch (error) {
      console.error("Error updating user login time:", error);
      throw error;
    }
  }

  // Category operations
  async getAllCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  // Place operations
  async getAllPlaces(): Promise<Place[]> {
    try {
      console.log("🚀 getAllPlaces 호출됨");
      // 원시 SQL로 places_accessibility 테이블에서 직접 조회
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.kakao_place_id,
          p.place_name,
          p.latitude,
          p.longitude,
          p.created_at,
          p.updated_at,
          p.accessibility_score
        FROM places_accessibility p
      `);

      console.log("📊 SQL 결과:", result.rows.length, "개 행");
      console.log("🔍 첫 번째 행:", result.rows[0]);

      return result.rows.map((row: any) => {
        const accessibilityScore = row.accessibility_score ? Number(row.accessibility_score) : null;
        let accessibilitySummary = null;

        if (accessibilityScore !== null) {
          if (accessibilityScore >= 8) {
            accessibilitySummary = '접근성이 우수합니다';
          } else if (accessibilityScore >= 6) {
            accessibilitySummary = '접근성이 양호합니다';
          } else if (accessibilityScore >= 4) {
            accessibilitySummary = '접근성에 주의가 필요합니다';
          } else {
            accessibilitySummary = '접근성이 제한적입니다';
          }
        }

        return {
          id: row.id,
          kakaoPlaceId: row.kakao_place_id,
          placeName: row.place_name,
          latitude: row.latitude,
          longitude: row.longitude,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          accessibilityScore,
          accessibilitySummary,
          name: row.place_name,
          address: '',
          phone: '',
          kakaoUrl: '',
          facilities: [],
          categoryId: 1
        } as Place;
      });
    } catch (error) {
      console.error('getAllPlaces 오류:', error);
      return [];
    }
  }

  async getPlaceById(id: number): Promise<Place | undefined> {
    console.log("🔍 getPlaceById 호출됨:", id);
    
    try {
      const result = await db.execute(sql`
        SELECT 
          p.*
        FROM places_accessibility p
        WHERE p.id = ${id}
      `);
      
      console.log("📊 getPlaceById SQL 결과:", result.rowCount, "개");
      
      if (result.rowCount === 0) {
        console.log("❌ 내부 ID로 장소를 찾을 수 없음:", id);
        return undefined;
      }
      
      const row = result.rows[0];
      console.log("✅ 내부 ID로 장소 발견:", row.place_name, "접근성 점수:", row.accessibility_score);
      
      const accessibilityScore = row.accessibility_score as number || null;
      let accessibilitySummary = null;
      
      if (accessibilityScore !== null) {
        if (accessibilityScore >= 8) {
          accessibilitySummary = '접근성이 우수합니다';
        } else if (accessibilityScore >= 6) {
          accessibilitySummary = '접근성이 양호합니다';
        } else if (accessibilityScore >= 4) {
          accessibilitySummary = '접근성에 주의가 필요합니다';
        } else {
          accessibilitySummary = '접근성이 제한적입니다';
        }
      }
      
      return {
        id: row.id as number,
        kakaoPlaceId: row.kakao_place_id as string,
        placeName: row.place_name as string,
        latitude: row.latitude as string,
        longitude: row.longitude as string,
        createdAt: row.created_at ? new Date(row.created_at as string) : null,
        updatedAt: row.updated_at ? new Date(row.updated_at as string) : null,
        accessibilityScore,
        accessibilitySummary,
        name: row.place_name as string,
        address: "",
        phone: "",
        kakaoUrl: "",
        facilities: [],
        categoryId: 1
      };
    } catch (error) {
      console.error('getPlaceById 오류:', error);
      return undefined;
    }
  }

  async getPlaceByKakaoId(kakaoId: string): Promise<Place | undefined> {
    console.log("🔍 getPlaceByKakaoId 호출됨:", kakaoId);
    
    try {
      const result = await db.execute(sql`
        SELECT 
          p.*
        FROM places_accessibility p
        WHERE p.kakao_place_id = ${kakaoId}
      `);
      
      console.log("📊 getPlaceByKakaoId SQL 결과:", result.rowCount, "개");
      
      if (result.rowCount === 0) {
        console.log("❌ 카카오 ID로 장소를 찾을 수 없음:", kakaoId);
        return undefined;
      }
      
      const row = result.rows[0];
      console.log("✅ 카카오 ID로 장소 발견:", row.place_name, "접근성 점수:", row.accessibility_score);
      console.log("🔍 전체 row 객체:", row);
      
      const accessibilityScore = Number(row.accessibility_score) || null;
      console.log("🎯 처리된 접근성 점수:", accessibilityScore, "원본값:", row.accessibility_score, "타입:", typeof row.accessibility_score);
      let accessibilitySummary = null;
      
      if (accessibilityScore !== null) {
        if (accessibilityScore >= 8) {
          accessibilitySummary = '접근성이 우수합니다';
        } else if (accessibilityScore >= 6) {
          accessibilitySummary = '접근성이 양호합니다';
        } else if (accessibilityScore >= 4) {
          accessibilitySummary = '접근성에 주의가 필요합니다';
        } else {
          accessibilitySummary = '접근성이 제한적입니다';
        }
      }
      
      return {
        id: row.id as number,
        kakaoPlaceId: row.kakao_place_id as string,
        placeName: row.place_name as string,
        latitude: row.latitude as string,
        longitude: row.longitude as string,
        createdAt: row.created_at ? new Date(row.created_at as string) : null,
        updatedAt: row.updated_at ? new Date(row.updated_at as string) : null,
        accessibilityScore,
        accessibilitySummary,
        name: row.place_name as string,
        address: "",
        phone: "",
        kakaoUrl: "",
        facilities: [],
        categoryId: 1
      };
    } catch (error) {
      console.error('getPlaceByKakaoId 오류:', error);
      return undefined;
    }
  }

  async getPlacesByCategory(categoryId: number): Promise<Place[]> {
    // Since we no longer have categoryId in the new structure, return empty array
    return [];
  }

  async searchPlaces(query: string): Promise<Place[]> {
    const lowercaseQuery = `%${query.toLowerCase()}%`;
    return db.select().from(places).where(
      like(places.placeName, lowercaseQuery)
    );
  }

  async getNearbyPlaces(lat: string, lng: string, radius: number = 2000): Promise<Place[]> {
    // Return all places for now - in real implementation would use geospatial calculations
    return this.getAllPlaces();
  }

  async createPlace(insertPlace: InsertPlace): Promise<Place> {
    const [place] = await db.insert(places).values(insertPlace).returning();
    return place;
  }

  async updatePlaceAccessibility(id: number, accessibilityInfo: AccessibilityReport): Promise<Place> {
    // This method is no longer needed with the new structure
    // Return the place as-is for now
    const place = await this.getPlaceById(id);
    if (!place) throw new Error("Place not found");
    return place;
  }
  
  // Place Image operations (removed - using file-based system)

  // Service Feedback operations
  async createServiceFeedback(feedback: InsertServiceFeedback): Promise<ServiceFeedback> {
    const [savedFeedback] = await db.insert(serviceFeedback).values(feedback).returning();
    return savedFeedback;
  }

  // Bookmark operations - user_id 배열 기반
  async getUserBookmarks(userId: number): Promise<Bookmark[]> {
    try {
      const userBookmarks = await db
        .select()
        .from(bookmarks)
        .where(sql`${userId} = ANY(${bookmarks.userId})`)
        .orderBy(bookmarks.updatedAt);
      return userBookmarks;
    } catch (error) {
      console.error("사용자 북마크 조회 오류:", error);
      return [];
    }
  }

  async addBookmark(placeId: string, placeName: string, userId: number): Promise<Bookmark> {
    try {
      console.log("🔖 북마크 추가 시도:", { placeId, placeName, userId });
      
      // 기존 북마크가 있는지 확인
      const existing = await db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.placeId, placeId))
        .limit(1);

      console.log("📋 기존 북마크 조회 결과:", existing.length > 0 ? "있음" : "없음");

      if (existing.length > 0) {
        const bookmark = existing[0];
        console.log("📝 기존 북마크 정보:", {
          id: bookmark.id,
          userId: bookmark.userId,
          placeName: bookmark.placeName
        });
        
        // 이미 해당 유저가 북마크했는지 확인
        if (bookmark.userId && bookmark.userId.includes(userId)) {
          console.log("⚠️ 이미 북마크된 장소:", userId);
          throw new Error("이미 북마크에 추가된 장소입니다.");
        }

        // 유저 ID를 배열에 추가
        const currentUserIds = bookmark.userId || [];
        const updatedUserIds = [...currentUserIds, userId];
        console.log("🔄 유저 ID 배열 업데이트:", currentUserIds, "→", updatedUserIds);
        
        const [updatedBookmark] = await db
          .update(bookmarks)
          .set({ 
            userId: updatedUserIds,
            updatedAt: new Date()
          })
          .where(eq(bookmarks.id, bookmark.id))
          .returning();
        
        console.log("✅ 북마크 업데이트 완료:", updatedBookmark.id);
        return updatedBookmark;
      } else {
        // 새 북마크 생성
        console.log("🆕 새 북마크 생성 중...");
        const [newBookmark] = await db
          .insert(bookmarks)
          .values({
            placeId,
            placeName,
            userId: [userId]
          })
          .returning();
        
        console.log("✅ 새 북마크 생성 완료:", newBookmark.id);
        return newBookmark;
      }
    } catch (error) {
      console.error("❌ 북마크 추가 오류:", error);
      if (error instanceof Error) {
        console.error("에러 메시지:", error.message);
        console.error("에러 스택:", error.stack);
      }
      throw error;
    }
  }

  async removeBookmark(placeId: string, userId: number): Promise<void> {
    try {
      const existing = await db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.placeId, placeId))
        .limit(1);

      if (existing.length > 0) {
        const bookmark = existing[0];
        const updatedUserIds = bookmark.userId.filter(id => id !== userId);
        
        if (updatedUserIds.length === 0) {
          // 마지막 유저가 북마크를 제거한 경우 행 삭제
          await db
            .delete(bookmarks)
            .where(eq(bookmarks.id, bookmark.id));
        } else {
          // 유저 ID만 배열에서 제거
          await db
            .update(bookmarks)
            .set({ 
              userId: updatedUserIds,
              updatedAt: new Date()
            })
            .where(eq(bookmarks.id, bookmark.id));
        }
      }
    } catch (error) {
      console.error("북마크 제거 오류:", error);
      throw error;
    }
  }

  async isBookmarked(placeId: string, userId: number): Promise<boolean> {
    try {
      const existing = await db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.placeId, placeId),
            sql`${userId} = ANY(${bookmarks.userId})`
          )
        )
        .limit(1);
      return existing.length > 0;
    } catch (error) {
      console.error("북마크 상태 확인 오류:", error);
      return false;
    }
  }

  // 사용자 이미지 관련 메서드들
  async getUserImages(poiId?: string): Promise<UserImage[]> {
    try {
      if (poiId) {
        // 특정 POI의 사용자 이미지들 조회
        return await db
          .select()
          .from(userImages)
          .where(eq(userImages.poiId, poiId))
          .orderBy(sql`${userImages.uploadedAt} DESC`);
      } else {
        // 모든 사용자 이미지들 조회
        return await db
          .select()
          .from(userImages)
          .orderBy(sql`${userImages.uploadedAt} DESC`);
      }
    } catch (error) {
      console.error("사용자 이미지 조회 오류:", error);
      return [];
    }
  }

  async getUserImagesByUsername(username: string): Promise<UserImage[]> {
    try {
      return await db
        .select()
        .from(userImages)
        .where(eq(userImages.username, username))
        .orderBy(sql`${userImages.uploadedAt} DESC`);
    } catch (error) {
      console.error("사용자별 이미지 조회 오류:", error);
      return [];
    }
  }

  async createUserImage(userImage: InsertUserImage): Promise<UserImage> {
    try {
      const [savedUserImage] = await db.insert(userImages).values(userImage).returning();
      console.log("사용자 이미지 저장 완료:", savedUserImage);
      return savedUserImage;
    } catch (error) {
      console.error("사용자 이미지 저장 오류:", error);
      throw error;
    }
  }

  async deleteUserImage(id: number): Promise<void> {
    try {
      await db.delete(userImages).where(eq(userImages.id, id));
      console.log("사용자 이미지 삭제 완료:", id);
    } catch (error) {
      console.error("사용자 이미지 삭제 오류:", error);
      throw error;
    }
  }

  // Accessibility Report operations
  async getAccessibilityReport(placeId: number): Promise<AccessibilityReportDb | undefined> {
    const results = await db
      .select()
      .from(accessibilityReports)
      .where(eq(accessibilityReports.placeId, placeId))
      .limit(1);
    return results[0];
  }

  async getAccessibilityReportByKakaoId(kakaoPlaceId: string): Promise<AccessibilityReportDb | undefined> {
    const results = await db
      .select()
      .from(accessibilityReports)
      .where(eq(accessibilityReports.kakaoPlaceId, kakaoPlaceId))
      .limit(1);
    return results[0];
  }

  async createAccessibilityReport(report: InsertAccessibilityReport): Promise<AccessibilityReportDb> {
    const results = await db
      .insert(accessibilityReports)
      .values(report)
      .returning();
    return results[0];
  }

  async updateAccessibilityReport(id: number, report: Partial<InsertAccessibilityReport>): Promise<AccessibilityReportDb> {
    const results = await db
      .update(accessibilityReports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(accessibilityReports.id, id))
      .returning();
    return results[0];
  }

  // Place Image operations
  async getPlaceImages(placeId: number, imageType?: string): Promise<PlaceImage[]> {
    if (imageType) {
      return db
        .select()
        .from(placeImages)
        .where(
          and(
            eq(placeImages.placeId, placeId),
            eq(placeImages.imageType, imageType)
          )
        );
    }
    
    return db
      .select()
      .from(placeImages)
      .where(eq(placeImages.placeId, placeId));
  }

  async createPlaceImage(image: InsertPlaceImage): Promise<PlaceImage> {
    const results = await db
      .insert(placeImages)
      .values(image)
      .returning();
    return results[0];
  }

  async deletePlaceImage(id: number): Promise<void> {
    await db
      .delete(placeImages)
      .where(eq(placeImages.id, id));
  }
}

export const storage = new DatabaseStorage();