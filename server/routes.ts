import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPlaceSchema, insertCategorySchema, insertUserSchema, insertServiceFeedbackSchema } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import path from "path";
import fs from "fs";

/**
 * 카카오 POI ID로 이미지 파일 조회
 * public/images/place_{kakao_id}/ 폴더에서 이미지 파일들을 찾음
 */
async function getImagesByKakaoId(kakaoId: string): Promise<any[]> {
  try {
    // 새로운 폴더 구조: place_{kakao_id}
    const imageDir = path.join(process.cwd(), 'public', 'images', `place_${kakaoId}`);

    if (!fs.existsSync(imageDir)) {
      console.log(`📁 카카오 POI ${kakaoId}의 이미지 폴더가 없습니다: ${imageDir}`);
      return [];
    }

    const files = fs.readdirSync(imageDir);
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );

    const images = imageFiles.map(file => {
      const fileName = path.parse(file).name;
      const imageType = getImageTypeFromFileName(fileName);

      return {
        id: `${kakaoId}_${fileName}`,
        image_url: `/images/place_${kakaoId}/${file}`,
        image_type: imageType,
        description: `${imageType} 이미지`,
        kakao_place_id: kakaoId
      };
    });

    console.log(`📸 카카오 POI ${kakaoId}에서 ${images.length}개 이미지 발견`);
    return images;

  } catch (error) {
    console.error(`이미지 조회 오류 (카카오 ID: ${kakaoId}):`, error);
    return [];
  }
}

/**
 * 파일명에서 이미지 타입 추론
 */
function getImageTypeFromFileName(fileName: string): string {
  const lowerName = fileName.toLowerCase();

  if (lowerName.includes('entrance') || lowerName.includes('입구')) {
    return 'entrance';
  } else if (lowerName.includes('toilet') || lowerName.includes('화장실')) {
    return 'toilet';
  } else if (lowerName.includes('elevator') || lowerName.includes('승강기') || lowerName.includes('엘리베이터')) {
    return 'elevator';
  } else if (lowerName.includes('parking') || lowerName.includes('주차')) {
    return 'parking';
  } else {
    return 'general';
  }
}


// 타입 선언 (request.user를 사용하기 위해)
declare global {
  namespace Express {
    interface Request {
      user?: any;
      isAuthenticated?: () => boolean;
    }
  }
}



export function registerRoutes(app: Express): Server {
  // CORS 설정
  app.use(cors({
    origin: true, // This allows the server to reflect the origin of the request
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
  }));

  // OAuth 콜백 처리
  app.get("/oauth/callback", (req: Request, res: Response) => {
    const code = req.query.code as string;
    const error = req.query.error as string;

    console.log("=== OAuth Callback Debug ===");
    console.log("Full request URL:", req.url);
    console.log("Query parameters:", req.query);
    console.log("Code parameter:", code ? `${code.substring(0, 10)}...` : "Missing");
    console.log("Error parameter:", error || "None");

    if (error) {
      console.error("Kakao Auth Error:", error);
      return res.redirect(`/?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      console.error("OAuth Callback - No code parameter found");
      return res.redirect("/?error=no_code");
    }

    // 성공적인 리다이렉트 - 코드를 포함하여 메인 페이지로 이동
    console.log("Redirecting to main page with code:", `${code.substring(0, 10)}...`);
    res.redirect(`/?code=${encodeURIComponent(code)}`);
  });

  // 카카오 액세스 토큰 요청 API
  app.post("/api/auth/kakao/token", async (req: Request, res: Response) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: "인증 코드가 필요합니다." });
      }

      // Frontend uses VITE_ prefix, but on the server side we access these directly
      const kakaoRestApiKey = process.env.KAKAO_API_KEY || process.env.KAKAO_REST_API_KEY || process.env.VITE_KAKAO_REST_API_KEY;

      // 고정 리다이렉트 URI 사용
      const redirectUri = 'https://kakao-map-info-hyuneee1.replit.app/oauth/callback';

      console.log("Kakao API Key:", kakaoRestApiKey ? "Available" : "Missing");
      console.log("Redirect URI:", redirectUri ? redirectUri : "Missing");

      if (!kakaoRestApiKey || !redirectUri) {
        return res.status(500).json({ message: "서버 설정 오류 (카카오 API 키 또는 리다이렉트 URI 누락)" });
      }

      const tokenUrl = "https://kauth.kakao.com/oauth/token";
      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("client_id", kakaoRestApiKey);
      params.append("redirect_uri", redirectUri);
      params.append("code", code);

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
        },
        body: params
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("카카오 토큰 요청 실패:", errorData);
        return res.status(tokenResponse.status).json({ 
          message: "카카오 토큰 요청 실패", 
          error: errorData 
        });
      }

      const tokenData = await tokenResponse.json();

      // 카카오 사용자 정보 요청
      const userInfoResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
        }
      });

      if (!userInfoResponse.ok) {
        const errorData = await userInfoResponse.text();
        console.error("카카오 사용자 정보 요청 실패:", errorData);
        return res.status(userInfoResponse.status).json({ 
          message: "카카오 사용자 정보 요청 실패", 
          error: errorData 
        });
      }

      const userData = await userInfoResponse.json() as any;

      // 사용자 정보 추출
      const authProviderId = userData.id?.toString();
      const nickname = userData.properties?.nickname || `사용자_${authProviderId.slice(-4)}`;
      const profileImage = userData.properties?.profile_image || null;

      // 기존 사용자 확인
      console.log(`카카오 사용자 ID(${authProviderId})로 DB에서 사용자 검색 시작...`);
      let user = await storage.getUserByAuthId(authProviderId);
      console.log('DB 사용자 검색 결과:', user ? `사용자 있음 (ID: ${user.id})` : '사용자 없음');

      let isNewUser = false;

      if (!user) {
        // 새 사용자 등록
        console.log('새 사용자 등록 시작:', nickname);
        const newUser = {
          authProvider: "kakao",
          authProviderId,
          nickname,
          bookmarkedPlaceIds: [] // Use the correct field name from schema
        };

        user = await storage.createUser(newUser);
        isNewUser = true;
        console.log(`새 사용자 등록 완료: ID=${user.id}, 닉네임=${user.nickname}`);
      } else {
        // 기존 사용자 로그인 - updated_at 업데이트
        console.log(`기존 사용자 로그인: ID=${user.id}, 닉네임=${user.nickname}`);
        await storage.updateUserLoginTime(user.id);
        console.log(`사용자 로그인 시간 업데이트 완료: ID=${user.id}`);
      }

      // 클라이언트에 토큰과 사용자 정보 전달
      if (user) {
        res.json({
          ...tokenData as any,
          user: {
            id: user.id,
            nickname: user.nickname,
            // Only include available fields
            authProviderId: user.authProviderId
          },
          isNewUser: isNewUser
        });
      } else {
        res.status(500).json({ message: "사용자 정보를 찾을 수 없습니다." });
      }

    } catch (error) {
      console.error("카카오 인증 처리 오류:", error);
      res.status(500).json({ message: "인증 처리 중 오류가 발생했습니다." });
    }
  });

  // 카카오 사용자 정보 가져오기 (디바이스 기반 시스템으로 비활성화)
  app.get("/api/auth/kakao/user", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(200).json({ user: null, message: "디바이스 기반 모드" });
      }

      const token = authHeader.split(" ")[1];
      const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
        }
      });

      if (!userResponse.ok) {
        return res.status(401).json({ message: "인증이 만료되었습니다." });
      }

      const userData = await userResponse.json() as any;
      const authProviderId = userData.id?.toString();

      if (!authProviderId) {
        return res.status(400).json({ message: "사용자 정보를 가져올 수 없습니다." });
      }

      // 데이터베이스에서 사용자 정보 가져오기
      const user = await storage.getUserByAuthId(authProviderId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }

      res.json({
        id: user.id,
        nickname: userData.properties?.nickname || user.nickname,
        profile_image: userData.properties?.profile_image || null,
        authProviderId: user.authProviderId,
        kakao: userData,
        dbUser: user
      });
    } catch (error) {
      console.error("카카오 사용자 정보 조회 오류:", error);
      res.status(500).json({ message: "사용자 정보를 가져오는 중 오류가 발생했습니다." });
    }
  });

  // 카카오 로그아웃
  app.post("/api/auth/kakao/logout", async (req: Request, res: Response) => {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({ message: "액세스 토큰이 필요합니다." });
      }

      const logoutUrl = "https://kapi.kakao.com/v1/user/logout";
      const logoutResponse = await fetch(logoutUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
        }
      });

      if (!logoutResponse.ok) {
        const errorData = await logoutResponse.text();
        console.error("카카오 로그아웃 실패:", errorData);
        return res.status(logoutResponse.status).json({ 
          message: "카카오 로그아웃 실패", 
          error: errorData 
        });
      }

      res.json({ message: "로그아웃 성공" });
    } catch (error) {
      console.error("카카오 로그아웃 오류:", error);
      res.status(500).json({ message: "로그아웃 처리 중 오류가 발생했습니다." });
    }
  });

  // 환경 변수 설정 정보 제공 API
  app.get("/api/config", (req: Request, res: Response) => {
    // 안전하게 제공할 수 있는 환경 변수만 전달
    const kakaoApiKey = process.env.KAKAO_API_KEY || process.env.VITE_KAKAO_REST_API_KEY;
    res.json({
      kakaoJavascriptKey: process.env.VITE_KAKAO_JAVASCRIPT_KEY,
      kakaoRestApiKey: kakaoApiKey,
      redirectUri: process.env.VITE_REDIRECT_URI || '/oauth/callback'
    });
  });

  // 카테고리 목록 가져오기
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Categories fetch error:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // 카테고리 추가
  app.post("/api/categories", async (req: Request, res: Response) => {
    try {
      const parsedData = insertCategorySchema.safeParse(req.body);

      if (!parsedData.success) {
        return res.status(400).json({ 
          message: "Invalid category data", 
          errors: parsedData.error.errors 
        });
      }

      const category = await storage.createCategory(parsedData.data);
      res.status(201).json(category);
    } catch (error) {
      console.error("Category creation error:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // 모든 장소 가져오기
  app.get("/api/places", async (req: Request, res: Response) => {
    try {
      const places = await storage.getAllPlaces();
      res.json(places);
    } catch (error) {
      console.error("Places fetch error:", error);
      res.status(500).json({ message: "Failed to fetch places" });
    }
  });

  // 장소 검색
  app.get("/api/places/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;

      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const places = await storage.searchPlaces(query);
      res.json(places);
    } catch (error) {
      console.error("Places search error:", error);
      res.status(500).json({ message: "Failed to search places" });
    }
  });

  // 주변 장소 검색
  app.get("/api/places/nearby", async (req: Request, res: Response) => {
    try {
      const { lat, lng, radius } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }

      const places = await storage.getNearbyPlaces(
        lat as string, 
        lng as string, 
        radius ? parseInt(radius as string) : undefined
      );

      res.json(places);
    } catch (error) {
      console.error("Nearby places fetch error:", error);
      res.status(500).json({ message: "Failed to fetch nearby places" });
    }
  });

  // 카테고리별 장소 가져오기
  app.get("/api/places/category/:categoryId", async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.categoryId);

      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const places = await storage.getPlacesByCategory(categoryId);
      res.json(places);
    } catch (error) {
      console.error("Places by category fetch error:", error);
      res.status(500).json({ message: "Failed to fetch places by category" });
    }
  });

  // 단일 장소 정보 가져오기
  app.get("/api/places/:id", async (req: Request, res: Response) => {
    try {
      const requestId = req.params.id;
      let foundPlace = null;

      console.log(`🔍 장소 조회 요청: ${requestId}`);

      // 카카오 Place ID로 먼저 조회 (대부분의 경우)
      foundPlace = await storage.getPlaceByKakaoId(requestId);

      // 카카오 ID로 찾지 못한 경우, 내부 ID로 조회 시도
      if (!foundPlace) {
        const placeId = parseInt(requestId);
        if (!isNaN(placeId)) {
          console.log(`🔍 내부 ID로 재시도: ${placeId}`);
          foundPlace = await storage.getPlaceById(placeId);
        }
      }

      if (!foundPlace) {
        console.log(`❌ 장소 찾을 수 없음: ${requestId} - 자동 생성 시도`);
        
        // 카카오 Maps API에서 장소 정보를 가져와 자동 생성
        try {
          const { placeName, latitude, longitude } = req.query;
          
          if (placeName && latitude && longitude) {
            console.log(`🔄 장소 자동 생성: ${placeName} (${latitude}, ${longitude})`);
            
            const newPlace = await storage.createPlace({
              kakaoPlaceId: requestId,
              placeName: placeName as string,
              latitude: latitude as string,
              longitude: longitude as string,
              accessibilityScore: null
            });
            
            console.log(`✅ 장소 자동 생성 완료: ${newPlace.placeName}`);
            foundPlace = newPlace;
          } else {
            // 쿼리 파라미터가 없으면 기본값으로 생성
            console.log(`🔄 기본값으로 장소 생성: ${requestId}`);
            
            const newPlace = await storage.createPlace({
              kakaoPlaceId: requestId,
              placeName: `장소 ${requestId}`,
              latitude: "37.5665",
              longitude: "126.9780",
              accessibilityScore: null
            });
            
            console.log(`✅ 기본 장소 생성 완료: ${newPlace.placeName}`);
            foundPlace = newPlace;
          }
        } catch (createError) {
          console.error("장소 자동 생성 실패:", createError);
          return res.status(404).json({ message: "Place not found and could not be created" });
        }
      }

      console.log(`✅ 장소 조회 성공: ${foundPlace.placeName}`);
      res.json(foundPlace);
    } catch (error) {
      console.error("Place fetch error:", error);
      res.status(500).json({ message: "Failed to fetch place" });
    }
  });

  // 장소의 접근성 정보 가져오기 (데이터베이스 기반)
  app.get("/api/places/:id/accessibility", async (req: Request, res: Response) => {
    try {
      const kakaoPlaceId = req.params.id;

      console.log(`📊 데이터베이스에서 접근성 정보 검색: ${kakaoPlaceId}`);

      // 데이터베이스에서 접근성 데이터 검색
      const accessibilityReport = await storage.getAccessibilityReportByKakaoId(kakaoPlaceId);

      if (!accessibilityReport) {
        console.log(`❌ 장소 "${kakaoPlaceId}"에 대한 접근성 정보가 데이터베이스에 없습니다`);
        return res.status(404).json({ 
          message: "Accessibility information not found for this place" 
        });
      }

      // AccessibilityReport 형식으로 변환
      const formattedData = {
        summary: accessibilityReport.summary,
        accessibility_score: accessibilityReport.accessibilityScore,
        recommendations: accessibilityReport.recommendations,
        highlighted_obstacles: accessibilityReport.highlightedObstacles,
        ai_analysis: accessibilityReport.aiAnalysis,
        facility_details: accessibilityReport.facilityDetails
      };

      console.log(`✅ 데이터베이스에서 접근성 데이터 반환: ${accessibilityReport.summary}`);
      res.json(formattedData);
    } catch (error) {
      console.error("데이터베이스 접근성 정보 조회 오류:", error);
      res.status(500).json({ message: "Failed to fetch accessibility information" });
    }
  });

  // 장소 접근성 정보 업로드 API (object storage의 user_images 폴더에 저장)
  app.post("/api/places/:id/accessibility", async (req: Request, res: Response) => {
    try {
      const kakaoPlaceId = req.params.id;

      console.log(`📊 접근성 정보 업로드 요청: ${kakaoPlaceId}`);

      // 1. 접근성 정보 검증
      const accessibilityInfo = req.body;

      if (!accessibilityInfo || typeof accessibilityInfo !== 'object') {
        return res.status(400).json({ message: "접근성 정보가 필요합니다." });
      }

      // 2. 필수 필드 검증
      const { summary, accessibility_score, recommendations } = accessibilityInfo;
      if (!summary || typeof accessibility_score !== 'number' || !Array.isArray(recommendations)) {
        return res.status(400).json({ 
          message: "필수 접근성 정보가 누락되었습니다. (요약, 점수, 권장사항)" 
        });
      }

      // 3. object storage의 user_images 폴더 경로 설정
      const fs = await import('fs');
      const path = await import('path');

      const accessibilityDataDir = './public/user_images/accessibility_data';
      const absoluteAccessibilityDir = path.resolve(accessibilityDataDir);

      console.log("📁 접근성 데이터 저장 경로:", absoluteAccessibilityDir);

      // 4. 디렉토리 생성 및 권한 확인
      try {
        // public/user_images 폴더 생성
        const userImagesDir = './public/user_images';
        const absoluteUserImagesDir = path.resolve(userImagesDir);

        if (!fs.existsSync(absoluteUserImagesDir)) {
          fs.mkdirSync(absoluteUserImagesDir, { recursive: true });
          console.log("✅ user_images 디렉토리 생성됨:", absoluteUserImagesDir);
        }

        // accessibility_data 서브폴더 생성
        if (!fs.existsSync(absoluteAccessibilityDir)) {
          fs.mkdirSync(absoluteAccessibilityDir, { recursive: true });
          console.log("✅ accessibility_data 디렉토리 생성됨:", absoluteAccessibilityDir);
        }

        // 권한 확인
        fs.accessSync(absoluteAccessibilityDir, fs.constants.W_OK | fs.constants.R_OK);
        console.log("✅ accessibility_data 디렉토리 읽기/쓰기 권한 확인됨");

      } catch (dirError) {
        console.error("❌ 접근성 데이터 디렉토리 생성/권한 확인 실패:", dirError);
        return res.status(500).json({ 
          message: "접근성 데이터 저장 디렉토리를 생성할 수 없습니다.",
          error: dirError instanceof Error ? dirError.message : "알 수 없는 디렉토리 오류"
        });
      }

      // 5. 고유한 파일명 생성 및 JSON 데이터 저장
      const timestamp = Date.now();
      const fileName = `accessibility_${kakaoPlaceId}_${timestamp}.json`;
      const fullPath = path.resolve(absoluteAccessibilityDir, fileName);

      // 6. 접근성 데이터 포맷팅
      const accessibilityDataToSave = {
        kakao_place_id: kakaoPlaceId,
        uploaded_at: new Date().toISOString(),
        accessibility_info: {
          summary,
          accessibility_score,
          recommendations,
          highlighted_obstacles: accessibilityInfo.highlighted_obstacles || [],
          ai_analysis: accessibilityInfo.ai_analysis || null,
          facility_details: accessibilityInfo.facility_details || null
        }
      };

      // 7. JSON 파일로 저장
      try {
        fs.writeFileSync(fullPath, JSON.stringify(accessibilityDataToSave, null, 2), 'utf8');
        console.log(`✅ 접근성 데이터 저장 완료: ${fileName}`);

        // 8. 데이터베이스에도 저장 (기존 시스템과 호환성 유지)
        try {
          const dbReport = await storage.createAccessibilityReport({
            kakaoPlaceId,
            summary,
            accessibilityScore: accessibility_score,
            recommendations,
            highlightedObstacles: accessibilityInfo.highlighted_obstacles || [],
            aiAnalysis: accessibilityInfo.ai_analysis || null,
            facilityDetails: accessibilityInfo.facility_details || null
          });

          console.log(`✅ 데이터베이스에도 접근성 정보 저장 완료: ${dbReport.id}`);
        } catch (dbError) {
          console.error("❌ 데이터베이스 저장 실패 (파일 저장은 성공):", dbError);
        }

        // 9. 성공 응답
        res.status(201).json({
          message: "접근성 정보가 성공적으로 업로드되었습니다.",
          file_path: `user_images/accessibility_data/${fileName}`,
          kakao_place_id: kakaoPlaceId,
          accessibility_score: accessibility_score
        });

      } catch (saveError) {
        console.error("❌ 접근성 데이터 파일 저장 실패:", saveError);
        return res.status(500).json({ 
          message: "접근성 데이터 저장에 실패했습니다.",
          error: saveError instanceof Error ? saveError.message : "알 수 없는 저장 오류"
        });
      }

    } catch (error) {
      console.error("접근성 정보 업로드 오류:", error);
      res.status(500).json({ message: "접근성 정보 업로드에 실패했습니다." });
    }
  });

  // 장소 추가 API (비활성화 - 검색된 POI 자동 저장 방지)
  // app.post("/api/places", async (req: Request, res: Response) => {
  //   try {
  //     const parsedData = insertPlaceSchema.safeParse(req.body);
  //     
  //     if (!parsedData.success) {
  //       return res.status(400).json({ 
  //         message: "Invalid place data", 
  //         errors: parsedData.error.errors 
  //       });
  //     }
  //     
  //     const place = await storage.createPlace(parsedData.data);
  //     res.status(201).json(place);
  //   } catch (error) {
  //     console.error("Place creation error:", error);
  //     res.status(500).json({ message: "Failed to create place" });
  //   }
  // });

  // 파일 업로드를 위한 multer 설정 - 메모리 스토리지 사용
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB로 크게 증가
      fieldSize: 50 * 1024 * 1024,
      fields: 10,
      files: 10
    },
    fileFilter: (req, file, cb) => {
      console.log("📁 파일 필터 검사:", {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size || 'unknown'
      });

      // 모든 파일 타입 허용 (디버깅 목적)
      console.log("✅ 파일 허용됨");
      cb(null, true);
    }
  });

  // 이미지 업로드 API


  // 장소 이미지 가져오기
  app.get("/api/places/:id/images", async (req: Request, res: Response) => {
    try {
      const requestId = req.params.id;
      let place = null;
      let allImages = [];

      // 1단계: 내부 ID로 직접 검색
      const internalId = parseInt(requestId);
      if (!isNaN(internalId)) {
        place = await storage.getPlaceById(internalId);
      }

      // 2단계: 카카오 place_id로 검색
      if (!place) {
        place = await storage.getPlaceByKakaoId(requestId);
      }

      // 3단계: 데이터베이스에 장소가 없어도 사용자 이미지는 조회 가능
      if (place) {
        // 데이터베이스에서 이미지 조회
        const dbImages = await storage.getPlaceImages(place.id);
        allImages.push(...dbImages);
      }

      // 4단계: 카카오 POI ID로 사용자 업로드 이미지 조회
      const userImages = await storage.getUserImages(requestId);

      // 사용자 이미지를 장소 이미지 형식으로 변환
      const convertedUserImages = userImages.map(userImg => ({
        id: `user_${userImg.id}`,
        place_id: place?.id || null,
        image_url: `/${userImg.imageUrl}`,
        image_type: 'user_upload',
        description: `${userImg.username}님이 업로드한 이미지`,
        created_at: userImg.uploadedAt,
        kakao_place_id: requestId
      }));

      allImages.push(...convertedUserImages);

      // 카카오 POI 이미지도 조회 시도
      const kakaoImages = await getImagesByKakaoId(requestId);
      allImages.push(...kakaoImages);

      console.log(`📸 장소 ${requestId}의 총 이미지 수: ${allImages.length}개`);
      res.json(allImages);

    } catch (error) {
      console.error('Error fetching place images:', error);
      res.status(500).json({ message: "Failed to fetch place images" });
    }
  });

  // 장소 이미지 타입별 가져오기
  app.get("/api/places/:id/images/:type", async (req: Request, res: Response) => {
    try {
      // 카카오맵 ID인지 체크하고 내부 ID로 변환
      const placeId = parseInt(mapKakaoPlaceIdToInternal(req.params.id, 'GET /images/type'));
      const imageType = req.params.type;

      if (isNaN(placeId)) {
        return res.status(400).json({ message: "Invalid place ID" });
      }

      const validTypes = ['entrance', 'interior', 'toilet', 'elevator', 'etc'];
      if (!validTypes.includes(imageType)) {
        return res.status(400).json({ message: "Invalid image type" });
      }

      const place = await storage.getPlaceById(placeId);
      if (!place) {
        return res.status(404).json({ message: "Place not found" });
      }

      const images = await storage.getPlaceImagesByType(placeId, imageType);
      res.json(images);
    } catch (error) {
      console.error('Error fetching place images by type:', error);
      res.status(500).json({ message: "Failed to fetch place images" });
    }
  });

  // 장소 이미지 추가
  app.post("/api/places/:id/images", async (req: Request, res: Response) => {
    try {
      // 카카오맵 ID인지 체크하고 내부 ID로 변환
      const placeId = parseInt(mapKakaoPlaceIdToInternal(req.params.id, 'POST /images'));

      if (isNaN(placeId)) {
        return res.status(400).json({ message: "Invalid place ID" });
      }

      const place = await storage.getPlaceById(placeId);
      if (!place) {
        return res.status(404).json({ message: "Place not found" });
      }

      const parsedData = insertPlaceImageSchema.extend({
        placeId: z.number(),
      }).safeParse({
        ...req.body,
        placeId
      });

      if (!parsedData.success) {
        return res.status(400).json({ 
          message: "Invalid image data", 
          errors: parsedData.error.errors 
        });
      }

      const image = await storage.addPlaceImage(parsedData.data);
      res.status(201).json(image);
    } catch (error) {
      console.error('Error adding place image:', error);
      res.status(500).json({ message: "Failed to add place image" });
    }
  });

  // 장소 이미지 삭제
  app.delete("/api/places/:placeId/images/:imageId", async (req: Request, res: Response) => {
    try {
      // 카카오맵 ID인지 체크하고 내부 ID로 변환
      const placeId = parseInt(mapKakaoPlaceIdToInternal(req.params.placeId, 'DELETE /images'));
      const imageId = parseInt(req.params.imageId);

      if (isNaN(placeId) || isNaN(imageId)) {
        return res.status(400).json({ message: "Invalid place ID or image ID" });
      }

      const place = await storage.getPlaceById(placeId);
      if (!place) {
        return res.status(404).json({ message: "Place not found" });
      }

      // Now fetch the image to check if it belongs to the place
      const placeImages = await storage.getPlaceImages(placeId);
      const image = placeImages.find(img => img.id === imageId);

      if (!image) {
        return res.status(404).json({ 
          message: "Image not found or does not belong to this place",
          details: `Image ID: ${imageId}, Place ID: ${placeId}`
        });
      }

      await storage.deletePlaceImage(imageId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting place image:', error);
      res.status(500).json({ message: "Failed to delete place image" });
    }
  });

  // 서비스 피드백 제출 API
  app.post("/api/feedback", async (req: Request, res: Response) => {
    try {
      const feedbackData = insertServiceFeedbackSchema.parse(req.body);
      const savedFeedback = await storage.createServiceFeedback(feedbackData);

      console.log('피드백 저장됨:', {
        id: savedFeedback.id,
        satisfaction: savedFeedback.satisfactionLevel,
        detailsCount: savedFeedback.feedbackDetails?.length || 0
      });

      res.status(201).json({
        message: "피드백이 성공적으로 저장되었습니다",
        feedbackId: savedFeedback.id
      });
    } catch (error) {
      console.error('피드백 저장 오류:', error);
      res.status(500).json({ message: "피드백 저장에 실패했습니다" });
    }
  });

  // 북마크 API 라우트 - 새로운 구조
  // 사용자 북마크 목록 조회
  app.get("/api/bookmarks/user", async (req: Request, res: Response) => {
    try {
      // 인증 확인
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const accessToken = authHeader.substring(7);

      // 카카오 사용자 정보 조회
      const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        }
      });

      if (!kakaoResponse.ok) {
        return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
      }

      const kakaoUser = await kakaoResponse.json();
      const authProviderId = kakaoUser.id.toString();

      // DB에서 사용자 찾기
      const dbUser = await storage.getUserByAuthId(authProviderId);
      if (!dbUser) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }

      const bookmarks = await storage.getUserBookmarks(dbUser.id);
      res.json(bookmarks);
    } catch (error) {
      console.error("북마크 목록 조회 오류:", error);
      res.status(500).json({ message: "북마크 목록을 가져올 수 없습니다." });
    }
  });

  // 북마크 추가
  app.post("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      console.log("🔖 북마크 추가 API 호출됨");
      console.log("📋 요청 본문:", req.body);
      
      const { poiId, placeName } = req.body;

      if (!poiId || !placeName) {
        console.log("❌ 필수 파라미터 누락:", { poiId, placeName });
        return res.status(400).json({ 
          message: "POI ID와 장소명은 필수입니다." 
        });
      }

      // 인증 확인
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("❌ 인증 헤더 없음");
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const accessToken = authHeader.substring(7);
      console.log("🔑 액세스 토큰 확인됨");

      // 카카오 사용자 정보 조회
      console.log("👤 카카오 사용자 정보 조회 중...");
      const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        }
      });

      if (!kakaoResponse.ok) {
        console.log("❌ 카카오 토큰 검증 실패:", kakaoResponse.status);
        return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
      }

      const kakaoUser = await kakaoResponse.json();
      const authProviderId = kakaoUser.id.toString();
      console.log("✅ 카카오 사용자 확인됨:", authProviderId);

      // DB에서 사용자 찾기
      console.log("🔍 데이터베이스에서 사용자 검색 중...");
      const dbUser = await storage.getUserByAuthId(authProviderId);
      if (!dbUser) {
        console.log("❌ 데이터베이스에서 사용자를 찾을 수 없음");
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }
      console.log("✅ 데이터베이스 사용자 확인됨:", dbUser.nickname);

      // 북마크 추가 시도
      console.log("📌 북마크 추가 시도:", { poiId, placeName, userId: dbUser.id });
      const bookmark = await storage.addBookmark(poiId, placeName, dbUser.id);

      console.log("✅ 북마크 추가 성공:", bookmark.id);
      res.status(201).json({
        message: "북마크가 추가되었습니다.",
        bookmark
      });
    } catch (error) {
      console.error("❌ 북마크 추가 API 오류:", error);
      
      if (error instanceof Error) {
        console.error("에러 타입:", error.constructor.name);
        console.error("에러 메시지:", error.message);
        console.error("에러 스택:", error.stack);
        
        if (error.message.includes("이미 북마크")) {
          return res.status(409).json({ message: error.message });
        }
        
        // 데이터베이스 관련 에러인지 확인
        if (error.message.includes("relation") || error.message.includes("table") || error.message.includes("column")) {
          console.error("🗃️ 데이터베이스 스키마 관련 오류 감지");
          return res.status(500).json({ 
            message: "데이터베이스 스키마 오류입니다. 마이그레이션을 확인해주세요.",
            error: error.message
          });
        }
      }
      
      res.status(500).json({ 
        message: "북마크 추가 중 오류가 발생했습니다.",
        error: error instanceof Error ? error.message : "알 수 없는 오류"
      });
    }
  });

  // 북마크 제거
  app.delete("/api/bookmarks/:poiId", async (req: Request, res: Response) => {
    try {
      const { poiId } = req.params;

      // 인증 확인
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const accessToken = authHeader.substring(7);

      // 카카오 사용자 정보 조회
      const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        }
      });

      if (!kakaoResponse.ok) {
        return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
      }

      const kakaoUser = await kakaoResponse.json();
      const authProviderId = kakaoUser.id.toString();

      // DB에서 사용자 찾기
      const dbUser = await storage.getUserByAuthId(authProviderId);
      if (!dbUser) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }

      await storage.removeBookmark(poiId, dbUser.id);
      res.json({ message: "북마크가 제거되었습니다." });
    } catch (error) {
      console.error("북마크 제거 오류:", error);
      res.status(500).json({ message: "북마크 제거 중 오류가 발생했습니다." });
    }
  });

  // 북마크 상태 확인
  app.get("/api/bookmarks/:poiId/status", async (req: Request, res: Response) => {
    try {
      const { poiId } = req.params;

      // 인증 확인
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.json({ isBookmarked: false });
      }

      const accessToken = authHeader.substring(7);

      // 카카오 사용자 정보 조회
      const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        }
      });

      if (!kakaoResponse.ok) {
        return res.json({ isBookmarked: false });
      }

      const kakaoUser = await kakaoResponse.json();
      const authProviderId = kakaoUser.id.toString();

      // DB에서 사용자 찾기
      const dbUser = await storage.getUserByAuthId(authProviderId);
      if (!dbUser) {
        return res.json({ isBookmarked: false });
      }

      const isBookmarked = await storage.isBookmarked(poiId, dbUser.id);
      res.json({ isBookmarked });
    } catch (error) {
      console.error("북마크 상태 확인 오류:", error);
      res.json({ isBookmarked: false });
    }
  });


  // 사용자 이미지 업로드 API (로그인 필수) - Object Storage 사용
  app.post("/api/user-images/upload", upload.single('image'), async (req: Request, res: Response) => {
    try {
      console.log("=== Object Storage 업로드 시작 ===");
      console.log("요청 Body:", req.body);
      console.log("Multer 파일 객체:", req.file);

      // 1. 인증 확인
      console.log("=== 인증 확인 단계 ===");
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("❌ 인증 헤더 없음");
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const accessToken = authHeader.substring(7);
      console.log("✅ 액세스 토큰 확인됨");

      // 2. 카카오 사용자 정보 조회
      const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        }
      });

      if (!kakaoResponse.ok) {
        console.log("❌ 카카오 토큰 검증 실패");
        return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
      }

      const kakaoUser: any = await kakaoResponse.json();
      const authProviderId = kakaoUser.id.toString();
      console.log("✅ 카카오 사용자 확인됨:", authProviderId);

      // 3. DB에서 사용자 찾기
      const dbUser = await storage.getUserByAuthId(authProviderId);
      if (!dbUser) {
        console.log("❌ 데이터베이스에서 사용자를 찾을 수 없음");
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }
      console.log("✅ 데이터베이스 사용자 확인됨:", dbUser.nickname);

      // 4. 요청 데이터 검증
      console.log("=== 요청 데이터 검증 단계 ===");
      const { poiId, placeName } = req.body;
      if (!req.file) {
        console.log("❌ 업로드된 파일 없음");
        return res.status(400).json({ message: "파일이 업로드되지 않았습니다." });
      }
      if (!poiId || !placeName) {
        console.log("❌ 필수 데이터 누락:", { poiId, placeName });
        return res.status(400).json({ message: "POI ID와 장소명이 필요합니다." });
      }
      console.log("✅ 요청 데이터 검증 완료:", { poiId, placeName });

      // 5. Object Storage에 파일 업로드
      console.log("=== Object Storage 업로드 단계 ===");
      try {
        const { Client } = await import('@replit/object-storage');
        const client = new Client();

        // 파일 이름 생성
        const timestamp = Date.now();
        const fileExtension = path.extname(req.file.originalname);
        const fileName = `user-images/${poiId}/${timestamp}-${dbUser.nickname}${fileExtension}`;

        console.log("Object Storage 파일명:", fileName);

        // Object Storage에 업로드
        const uploadResult = await client.uploadFromBytes(fileName, req.file.buffer, {
          contentType: req.file.mimetype
        });

        if (!uploadResult.ok) {
          console.error("❌ Object Storage 업로드 실패:", uploadResult.error);
          return res.status(500).json({ 
            message: "파일 업로드에 실패했습니다.",
            error: uploadResult.error
          });
        }

        console.log("✅ Object Storage 업로드 성공:", fileName);

        // 공개 URL 생성 - Object Storage는 자동으로 공개 URL을 제공
        const objectUrl = `https://storage.replit.com/${process.env.REPLIT_OBJECT_STORAGE_BUCKET_ID}/${fileName}`;
        console.log("생성된 Object Storage URL:", objectUrl);

        // 6. 데이터베이스에 사용자 이미지 정보 저장
        try {
          const userImage = await storage.createUserImage({
            poiId,
            placeName,
            username: dbUser.nickname,
            imageUrl: objectUrl
          });

          console.log("데이터베이스 저장 완료:", userImage);
          console.log(`업로드 완료: ${userImage.placeName} - ${userImage.username} - ${fileName}`);

          res.status(201).json({
            message: "이미지가 성공적으로 업로드되었습니다.",
            userImage: {
              id: userImage.id,
              imageUrl: objectUrl,
              placeName: userImage.placeName,
              username: userImage.username,
              uploadedAt: userImage.uploadedAt
            }
          });

        } catch (dbError) {
          console.error("데이터베이스 저장 실패:", dbError);

          // 데이터베이스 저장 실패 시 Object Storage에서 파일 삭제
          try {
            await client.delete(fileName);
            console.log("❌ DB 저장 실패로 Object Storage 파일 삭제됨");
          } catch (deleteError) {
            console.error("Object Storage 파일 삭제 실패:", deleteError);
          }

          return res.status(500).json({ 
            message: "데이터베이스 저장 중 오류가 발생했습니다.",
            error: dbError instanceof Error ? dbError.message : "알 수 없는 DB 오류"
          });
        }

      } catch (storageError) {
        console.error("Object Storage 업로드 실패:", storageError);
        return res.status(500).json({ 
          message: "Object Storage 업로드에 실패했습니다.",
          error: storageError instanceof Error ? storageError.message : "알 수 없는 Object Storage 오류"
        });
      }

    } catch (error) {
      console.error("전체 업로드 프로세스 오류:", error);
      res.status(500).json({ 
        message: "이미지 업로드 중 오류가 발생했습니다.",
        error: error instanceof Error ? error.message : "알 수 없는 오류"
      });
    }
  });

  // 사용자 이미지 목록 조회 API
  app.get("/api/user-images", async (req: Request, res: Response) => {
    try {
      const { poiId } = req.query;

      // poiId가 있으면 특정 장소의 이미지들만, 없으면 모든 이미지들 조회
      const userImages = await storage.getUserImages(poiId as string);

      res.json(userImages);
    } catch (error) {
      console.error("사용자 이미지 조회 오류:", error);
      res.status(500).json({ message: "사용자 이미지 목록을 가져올 수 없습니다." });
    }
  });

  // 특정 POI의 사용자 이미지 조회 API
  app.get("/api/user-images/:poiId", async (req: Request, res: Response) => {
    try {
      const { poiId } = req.params;

      const userImages = await storage.getUserImages(poiId);

      res.json(userImages);
    } catch (error) {
      console.error("POI 사용자 이미지 조회 오류:", error);
      res.status(500).json({ message: "해당 장소의 사용자 이미지를 가져올 수 없습니다." });
    }
  });

  // 특정 사용자의 업로드 기록 조회 API (사용자 ID 기반)
  app.get("/api/user-images/my-uploads", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "인증이 필요합니다." });
      }

      const accessToken = authHeader.substring(7);

      // 카카오 사용자 정보 조회
      const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        }
      });

      if (!kakaoResponse.ok) {
        return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
      }

      const kakaoUser = await kakaoResponse.json();
      const authProviderId = kakaoUser.id.toString();

      // DB에서 사용자 찾기
      const dbUser = await storage.getUserByAuthId(authProviderId);
      if (!dbUser) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }

      // 해당 사용자의 업로드 기록 조회 (닉네임으로)
      const userImages = await storage.getUserImagesByUsername(dbUser.nickname);

      res.json(userImages);
    } catch (error) {
      console.error("사용자 업로드 기록 조회 오류:", error);
      res.status(500).json({ message: "사용자 업로드 기록을 가져올 수 없습니다." });
    }
  });

  // 특정 사용자의 업로드 기록 조회 API (사용자명 기반 - 호환성)
  app.get("/api/user-images/user/:username", async (req: Request, res: Response) => {
    try {
      const { username } = req.params;

      if (!username) {
        return res.status(400).json({ message: "사용자명이 필요합니다." });
      }

      const userImages = await storage.getUserImagesByUsername(username);

      res.json(userImages);
    } catch (error) {
      console.error("사용자 업로드 기록 조회 오류:", error);
      res.status(500).json({ message: "사용자 업로드 기록을 가져올 수 없습니다." });
    }
  });

  // 사용자 이미지 삭제 API
  app.delete("/api/user-images/:id", async (req: Request, res: Response) => {
    try {
      const imageId = parseInt(req.params.id);

      if (isNaN(imageId)) {
        return res.status(400).json({ message: "유효하지 않은 이미지 ID입니다." });
      }

      // 1. 인증 확인
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const accessToken = authHeader.substring(7);

      // 2. 카카오 사용자 정보 조회
      const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        }
      });

      if (!kakaoResponse.ok) {
        return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
      }

      const kakaoUser = await kakaoResponse.json();
      const authProviderId = kakaoUser.id.toString();

      // 3. DB에서 사용자 찾기
      const dbUser = await storage.getUserByAuthId(authProviderId);
      if (!dbUser) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }

      // 4. 이미지 정보 조회 및 권한 확인
      const userImages = await storage.getUserImagesByUsername(dbUser.nickname);
      const imageToDelete = userImages.find(img => img.id === imageId);

      if (!imageToDelete) {
        return res.status(404).json({ message: "이미지를 찾을 수 없거나 삭제 권한이 없습니다." });
      }

      // 5. Object Storage에서 파일 삭제
      const { Client } = await import('@replit/object-storage');
      const client = new Client();

      try {
        console.log("🗑️ Object Storage에서 파일 삭제 시도:", imageToDelete.imageUrl);
        const deleteResult = await client.delete(imageToDelete.imageUrl);

        if (!deleteResult.ok) {
          console.warn("Object Storage 삭제 실패, 로컬 파일 삭제 시도:", deleteResult.error);
          // 폴백: 로컬 파일 시스템에서 삭제
          try {
            const fs = await import('fs');
            const path = await import('path');
            const filePath = path.resolve('./public', imageToDelete.imageUrl);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log("📁 로컬 파일 삭제 성공:", filePath);
            }
          } catch (localError) {
            console.warn("로컬 파일 삭제도 실패:", localError);
          }
        } else {
          console.log("☁️ Object Storage 파일 삭제 성공:", imageToDelete.imageUrl);
        }
      } catch (fileError) {
        console.warn("파일 삭제 오류:", fileError);
        // 파일 삭제가 실패해도 DB에서는 제거
      }

      // 6. 데이터베이스에서 이미지 정보 삭제
      await storage.deleteUserImage(imageId);

      console.log(`사용자 이미지 삭제 완료: ID ${imageId}, 파일 ${imageToDelete.imageUrl}`);
      res.json({ message: "이미지가 성공적으로 삭제되었습니다." });
    } catch (error) {
      console.error("사용자 이미지 삭제 오류:", error);
      res.status(500).json({ message: "이미지 삭제 중 오류가 발생했습니다." });
    }
  });

    const storageToken = process.env.REPLIT_STORAGE_KEY;
      console.log("🔑 Storage 토큰 상태:", storageToken ? "존재함" : "없음");
      console.log("🌐 Storage URL:", process.env.REPLIT_OBJECT_STORAGE_URL || "없음");
      console.log("📦 Bucket ID:", process.env.REPLIT_OBJECT_STORAGE_BUCKET_ID || "없음");


  const httpServer = createServer(app);

  return httpServer;
}