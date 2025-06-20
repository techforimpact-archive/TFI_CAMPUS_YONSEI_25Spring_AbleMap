import fs from 'fs';
import path from 'path';
import { db } from '../server/db';
import { places, accessibilityReports } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface NewAccessibilityData {
  kakao_mapping: {
    place_id: string;
    place_name: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  location_info: {
    siDoNm: string;
    cggNm: string;
    faclNm: string;
    roadNm: string;
  };
  accessibility_info: {
    has_stairs: boolean;
    has_ramp: boolean;
    entrance_accessible: boolean;
    obstacles: string[];
    accessibility_score: number;
    stair_severity?: string;
    has_sidewalk?: boolean;
    has_building?: boolean;
  };
  llm_analysis: {
    independent_access_score: number;
    assisted_access_score: number;
    recommended_access_score: number;
    final_accessibility_score: number;
    access_recommendation: string;
    stairs_count: number | string;
    stairs_height: string;
    stair_severity_assessment: string;
    stair_detection_confidence: string;
    additional_obstacles_impact: string[];
    confidence_level: string;
    alternative_route: boolean;
    alternative_route_description: string;
    recommendations: {
      for_independent: string[];
      for_assisted: string[];
      facility_improvements: string[];
    };
    observations: string[];
    noise_filtering_summary: string;
  };
  timestamp: string;
}

async function migrateNewPOIData() {
  console.log('🚀 새로운 POI 데이터 마이그레이션 시작...');
  
  const attachedAssetsDir = path.join(process.cwd(), 'attached_assets');
  
  // 새로 추가할 13개 POI 파일들 (정확한 파일명)
  const newPOIFiles = [
    '세란약국_report_20250607_082810.json',
    '세븐일레븐_연대점_report_20250607_082834.json',
    '세븐일레븐_이대1호점_report_20250607_082909.json',
    '송학_report_20250607_082948.json',
    '신보건약국_report_20250607_083023.json',
    '신촌1번약국_report_20250607_083158.json',
    '신촌대로약국_report_20250607_083234.json',
    '신촌황소곱창_report_20250607_083313.json',
    '써밋컬쳐_신촌점_report_20250607_083347.json',
    '썬더치킨_신촌연대점_report_20250607_083425.json',
    '아마스빈_이대점_report_20250607_083502.json',
    '아소비바_report_20250607_083538.json'
  ];

  if (!fs.existsSync(attachedAssetsDir)) {
    console.log(`❌ attached_assets 디렉토리를 찾을 수 없습니다: ${attachedAssetsDir}`);
    return;
  }

  console.log(`📁 발견된 새로운 POI 파일: ${newPOIFiles.length}개`);
  console.log(`📝 파일 목록: ${newPOIFiles.join(', ')}`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const fileName of newPOIFiles) {
    try {
      const filePath = path.join(attachedAssetsDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ 파일을 찾을 수 없습니다: ${fileName}`);
        errorCount++;
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const data: NewAccessibilityData = JSON.parse(content);

      if (!data.kakao_mapping?.place_id) {
        console.log(`⚠️ ${fileName}: 카카오 POI ID가 없어 건너뜀`);
        skippedCount++;
        continue;
      }

      const kakaoPlaceId = data.kakao_mapping.place_id;
      const placeName = data.kakao_mapping.place_name;
      const latitude = data.kakao_mapping.coordinates.lat.toString();
      const longitude = data.kakao_mapping.coordinates.lng.toString();

      // 1. 장소가 데이터베이스에 있는지 확인
      let place = await db.select().from(places).where(eq(places.kakaoPlaceId, kakaoPlaceId)).then(rows => rows[0]);
      
      if (!place) {
        console.log(`📍 새 장소 생성: ${placeName} (${kakaoPlaceId})`);
        const [newPlace] = await db.insert(places).values({
          kakaoPlaceId,
          placeName,
          latitude,
          longitude,
          accessibilityScore: data.llm_analysis.final_accessibility_score
        }).returning();
        place = newPlace;
      } else {
        // 기존 장소의 접근성 점수 업데이트
        const accessibilityScore = data.llm_analysis.final_accessibility_score;
        if (place.accessibilityScore !== accessibilityScore) {
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
        skippedCount++;
        continue;
      }

      // 3. 접근성 리포트 생성
      const summary = data.llm_analysis.observations.join(' ') || 
                     `${placeName}의 접근성 정보입니다.`;
      
      const accessibilityScore = data.llm_analysis.final_accessibility_score;
      const recommendations = [
        ...data.llm_analysis.recommendations.for_independent,
        ...data.llm_analysis.recommendations.for_assisted,
        ...data.llm_analysis.recommendations.facility_improvements
      ].slice(0, 5); // 최대 5개까지만

      const highlightedObstacles = data.accessibility_info.obstacles || [];

      // AI 분석 데이터 구조화
      const aiAnalysis = {
        has_stairs: data.accessibility_info.has_stairs,
        has_ramp: data.accessibility_info.has_ramp,
        entrance_accessible: data.accessibility_info.entrance_accessible,
        obstacles: highlightedObstacles,
        accessibility_score: data.accessibility_info.accessibility_score,
        independent_access_score: data.llm_analysis.independent_access_score,
        assisted_access_score: data.llm_analysis.assisted_access_score,
        recommended_access_score: data.llm_analysis.recommended_access_score,
        access_recommendation: data.llm_analysis.access_recommendation,
        stairs_count: data.llm_analysis.stairs_count,
        stairs_height: data.llm_analysis.stairs_height,
        stair_severity_assessment: data.llm_analysis.stair_severity_assessment,
        stair_detection_confidence: data.llm_analysis.stair_detection_confidence,
        alternative_route: data.llm_analysis.alternative_route,
        alternative_route_description: data.llm_analysis.alternative_route_description,
        confidence_level: data.llm_analysis.confidence_level,
        additional_obstacles_impact: data.llm_analysis.additional_obstacles_impact
      };

      // 시설 상세 정보 (간소화)
      const facilityDetails = {
        location: {
          siDoNm: data.location_info.siDoNm,
          cggNm: data.location_info.cggNm,
          roadNm: data.location_info.roadNm
        },
        entrance: {
          accessible: data.accessibility_info.entrance_accessible,
          has_stairs: data.accessibility_info.has_stairs,
          has_ramp: data.accessibility_info.has_ramp
        },
        accessibility_features: {
          has_sidewalk: data.accessibility_info.has_sidewalk,
          has_building: data.accessibility_info.has_building,
          stair_severity: data.accessibility_info.stair_severity
        }
      };

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
      console.error(`❌ ${fileName} 처리 중 오류:`, error);
      errorCount++;
    }
  }

  console.log('\n📊 새로운 POI 마이그레이션 완료 요약:');
  console.log(`- 처리 대상 파일: ${newPOIFiles.length}개`);
  console.log(`- 성공: ${successCount}개`);
  console.log(`- 건너뜀: ${skippedCount}개`);
  console.log(`- 실패: ${errorCount}개`);
  
  if (successCount > 0) {
    console.log('\n🎉 새로운 12개 POI의 접근성 데이터가 성공적으로 데이터베이스에 추가되었습니다!');
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateNewPOIData()
    .then(() => {
      console.log('새로운 POI 마이그레이션 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('새로운 POI 마이그레이션 실패:', error);
      process.exit(1);
    });
}

export { migrateNewPOIData };