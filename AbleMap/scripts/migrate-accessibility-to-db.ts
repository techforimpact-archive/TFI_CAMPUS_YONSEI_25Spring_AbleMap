import fs from 'fs';
import path from 'path';
import { db } from '../server/db';
import { places, accessibilityReports } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface AccessibilityJSONData {
  kakao_mapping: {
    place_id: string;
    place_name: string;
    coordinates: {
      lat: string;
      lng: string;
    };
  };
  accessibility_info?: {
    accessibility_score: number;
    has_stairs: boolean;
    has_ramp: boolean;
    entrance_accessible: boolean;
    obstacles: string[];
  };
  llm_analysis?: {
    final_accessibility_score: number;
    recommendations: string[];
    observations: string[];
    external_accessibility_score?: number;
    internal_accessibility_score?: number;
    stairs_count?: string;
    stairs_height?: string;
    alternative_route?: boolean;
    alternative_route_description?: string;
  };
  facility_info?: {
    accessibility_details: {
      entrance: {
        accessible: boolean;
        features?: string[];
      };
      parking: {
        available: boolean;
        features?: string[];
      };
      restroom: {
        available: boolean;
        features?: string[];
      };
      elevator: {
        available: boolean;
      };
    };
  };
}

async function migrateAccessibilityData() {
  console.log('🚀 접근성 데이터 마이그레이션 시작...');
  
  const searchDirs = [
    path.join(process.cwd(), 'attached_assets'),
    path.join(process.cwd(), 'public', 'accessibility_data')
  ];

  let totalFiles = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) {
      console.log(`📁 디렉토리가 존재하지 않습니다: ${dir}`);
      continue;
    }

    const files = fs.readdirSync(dir)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(dir, file));

    console.log(`📁 ${dir}에서 ${files.length}개의 JSON 파일 발견`);
    totalFiles += files.length;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data: AccessibilityJSONData = JSON.parse(content);
        const fileName = path.basename(filePath);

        if (!data.kakao_mapping?.place_id) {
          console.log(`⚠️ ${fileName}: 카카오 POI ID가 없어 건너뜀`);
          continue;
        }

        const kakaoPlaceId = data.kakao_mapping.place_id;
        const placeName = data.kakao_mapping.place_name;
        const latitude = data.kakao_mapping.coordinates.lat;
        const longitude = data.kakao_mapping.coordinates.lng;

        // 1. 장소가 데이터베이스에 있는지 확인하고 없으면 생성
        let place = await db.select().from(places).where(eq(places.kakaoPlaceId, kakaoPlaceId)).then(rows => rows[0]);
        
        if (!place) {
          console.log(`📍 새 장소 생성: ${placeName} (${kakaoPlaceId})`);
          const [newPlace] = await db.insert(places).values({
            kakaoPlaceId,
            placeName,
            latitude,
            longitude,
            accessibilityScore: data.llm_analysis?.final_accessibility_score || data.accessibility_info?.accessibility_score || null
          }).returning();
          place = newPlace;
        } else {
          // 기존 장소의 접근성 점수 업데이트
          const accessibilityScore = data.llm_analysis?.final_accessibility_score || data.accessibility_info?.accessibility_score || null;
          if (accessibilityScore && place.accessibilityScore !== accessibilityScore) {
            await db.update(places)
              .set({ accessibilityScore })
              .where(eq(places.id, place.id));
            console.log(`🔄 장소 접근성 점수 업데이트: ${placeName} -> ${accessibilityScore}`);
          }
        }

        // 2. 접근성 리포트가 이미 있는지 확인
        const existingReport = await db.select().from(accessibilityReports)
          .where(eq(accessibilityReports.kakaoPlaceId, kakaoPlaceId))
          .then(rows => rows[0]);

        if (existingReport) {
          console.log(`✅ ${placeName}: 접근성 리포트가 이미 존재함, 건너뜀`);
          successCount++;
          continue;
        }

        // 3. 접근성 리포트 생성
        const summary = data.llm_analysis?.observations?.join(' ') || 
                       `${placeName}의 접근성 정보가 있습니다.`;
        
        const accessibilityScore = data.llm_analysis?.final_accessibility_score || 
                                 data.accessibility_info?.accessibility_score || 5;

        const recommendations = data.llm_analysis?.recommendations || [];
        const highlightedObstacles = data.accessibility_info?.obstacles || [];

        // AI 분석 데이터 구조화
        const aiAnalysis = {
          has_stairs: data.accessibility_info?.has_stairs || false,
          has_ramp: data.accessibility_info?.has_ramp || false,
          entrance_accessible: data.accessibility_info?.entrance_accessible || true,
          obstacles: highlightedObstacles,
          accessibility_score: data.accessibility_info?.accessibility_score || accessibilityScore,
          external_accessibility_score: data.llm_analysis?.external_accessibility_score,
          internal_accessibility_score: data.llm_analysis?.internal_accessibility_score,
          stairs_count: data.llm_analysis?.stairs_count,
          stairs_height: data.llm_analysis?.stairs_height,
          alternative_route: data.llm_analysis?.alternative_route,
          alternative_route_description: data.llm_analysis?.alternative_route_description
        };

        // 시설 상세 정보
        const facilityDetails = data.facility_info?.accessibility_details || null;

        await db.insert(accessibilityReports).values({
          placeId: place.id,
          kakaoPlaceId,
          summary,
          accessibilityScore,
          recommendations: recommendations as any,
          highlightedObstacles: highlightedObstacles as any,
          aiAnalysis: aiAnalysis as any,
          facilityDetails: facilityDetails as any
        });

        console.log(`✅ ${placeName}: 접근성 리포트 저장 완료 (점수: ${accessibilityScore})`);
        successCount++;

      } catch (error) {
        console.error(`❌ ${path.basename(filePath)} 처리 중 오류:`, error);
        errorCount++;
      }
    }
  }

  console.log('\n📊 마이그레이션 완료 요약:');
  console.log(`- 총 파일 수: ${totalFiles}`);
  console.log(`- 성공: ${successCount}`);
  console.log(`- 실패: ${errorCount}`);
  
  if (successCount > 0) {
    console.log('\n🎉 접근성 데이터가 성공적으로 데이터베이스로 마이그레이션되었습니다!');
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateAccessibilityData()
    .then(() => {
      console.log('마이그레이션 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('마이그레이션 실패:', error);
      process.exit(1);
    });
}

export { migrateAccessibilityData };