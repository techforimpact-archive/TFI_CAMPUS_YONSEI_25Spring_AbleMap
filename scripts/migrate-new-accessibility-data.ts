import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";
import fs from 'fs';
import path from 'path';

neonConfig.webSocketConstructor = ws;

// 데이터베이스 연결
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface AccessibilityData {
  kakao_mapping: {
    place_id: string;
    place_name: string;
    coordinates: {
      lat: string;
      lng: string;
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
    obstacle_details: any;
    has_sidewalk: boolean;
    has_building: boolean;
    has_railing?: boolean;
    has_stairs_railing?: boolean;
    accessibility_score: number;
  };
  facility_info: {
    available: boolean;
    basic_info: any;
    facility_features: {
      evalInfo: string[];
    };
    accessibility_details: {
      entrance: {
        accessible: boolean;
        features: string[];
      };
      parking: {
        available: boolean;
        features: string[];
      };
      restroom: {
        available: boolean;
        features: string[];
      };
      elevator: {
        available: boolean;
      };
    };
  };
  llm_analysis: {
    external_accessibility_score: number;
    internal_accessibility_score: number;
    final_accessibility_score: number;
    stairs_count: string;
    stairs_height: string;
    stair_detection_confidence: string;
    alternative_route: boolean;
    alternative_route_description: string;
    recommendations: string[];
    observations: string[];
    noise_filtering_summary: string;
  };
  timestamp: string;
}

async function migrateNewAccessibilityData() {
  console.log('새로운 접근성 데이터 마이그레이션 시작...');
  
  // 고유 제약조건 추가 (이미 존재하면 무시)
  try {
    await pool.query(`
      ALTER TABLE accessibility_reports 
      ADD CONSTRAINT unique_kakao_place_id UNIQUE (kakao_place_id)
    `);
  } catch (error) {
    // 이미 존재하는 경우 무시
  }
  
  const filePaths = [
    'attached_assets/서울특별시_서대문구_북아현로_24_report_20250606_233930_1749303089059.json',
    'attached_assets/서울특별시_서대문구_북아현로1길_31_report_20250606_234002_1749303089070.json',
    'attached_assets/서울특별시_서대문구_북아현로6길_9-6_report_20250606_234030_1749303089070.json',
    'attached_assets/서울특별시_서대문구_북아현로18길_47_report_20250606_234102_1749304210517.json',
    'attached_assets/서울특별시_서대문구_성산로_500_report_20250606_234217_1749304210522.json',
    'attached_assets/서울특별시_서대문구_성산로_543_report_20250606_234352_1749304210525.json',
    'attached_assets/서울특별시_서대문구_성산로_565_report_20250606_234249_1749304448126.json',
    'attached_assets/서울특별시_서대문구_성산로_573_report_20250606_234318_1749304448131.json',
    'attached_assets/서울특별시_서대문구_신촌로_121_report_20250606_234458_1749304448133.json',
    'attached_assets/서울특별시_서대문구_신촌로_129_report_20250606_234541_1749304448135.json',
    'attached_assets/서울특별시_서대문구_신촌로_149_report_20250606_234612_1749304448136.json',
    'attached_assets/서울특별시_서대문구_신촌로_157_report_20250606_234643_1749304448136.json',
    'attached_assets/서울특별시_서대문구_신촌로_163_report_20250606_234722_1749305847841.json',
    'attached_assets/서울특별시_서대문구_신촌로_169-6_report_20250606_234752_1749305847848.json',
    'attached_assets/서울특별시_서대문구_신촌로_203_report_20250606_234821_1749305847851.json',
    'attached_assets/서울특별시_서대문구_신촌로_215_report_20250606_234901_1749305847853.json',
    'attached_assets/서울특별시_서대문구_신촌로29길_11_report_20250606_234933_1749305847854.json',
    'attached_assets/서울특별시_서대문구_신촌로37길_10_report_20250606_235003_1749305847854.json',
    'attached_assets/서울특별시_서대문구_연세로_38_report_20250606_235028_1749306150274.json',
    'attached_assets/서울특별시_서대문구_연세로2가길_3_report_20250607_003841_1749306150275.json',
    'attached_assets/서울특별시_서대문구_연세로2길_48_report_20250606_235058_1749306150275.json',
    'attached_assets/서울특별시_서대문구_연세로2나길_5_report_20250606_235130_1749306150275.json',
    'attached_assets/서울특별시_서대문구_연세로2나길_16_report_20250606_235205_1749306150275.json',
    'attached_assets/서울특별시_서대문구_연세로2마길_29_report_20250606_235305_1749306150275.json',
    'attached_assets/서울특별시_은평구_대서문길_15-11_report_20250606_234135_1749306150276.json'
  ];
  
  for (const filePath of filePaths) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`파일을 찾을 수 없음: ${filePath}`);
        continue;
      }
      
      const data: AccessibilityData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      
      console.log(`처리 중: ${data.kakao_mapping.place_name} (${data.kakao_mapping.place_id})`);
      
      // 먼저 장소가 존재하는지 확인
      const placeQuery = `
        SELECT id FROM places_accessibility 
        WHERE kakao_place_id = $1
      `;
      let placeResult = await pool.query(placeQuery, [data.kakao_mapping.place_id]);
      
      let placeId: number;
      
      if (placeResult.rows.length === 0) {
        // 장소가 없으면 생성
        console.log(`새로운 장소 생성: ${data.kakao_mapping.place_name}`);
        
        const createPlaceQuery = `
          INSERT INTO places_accessibility (
            kakao_place_id, place_name, latitude, longitude, accessibility_score
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `;
        
        const createResult = await pool.query(createPlaceQuery, [
          data.kakao_mapping.place_id,
          data.kakao_mapping.place_name,
          data.kakao_mapping.coordinates.lat,
          data.kakao_mapping.coordinates.lng,
          data.llm_analysis.final_accessibility_score
        ]);
        
        placeId = createResult.rows[0].id;
      } else {
        placeId = placeResult.rows[0].id;
        
        // 기존 장소의 접근성 점수 업데이트
        const updatePlaceQuery = `
          UPDATE places_accessibility 
          SET accessibility_score = $1, updated_at = NOW()
          WHERE id = $2
        `;
        await pool.query(updatePlaceQuery, [
          data.llm_analysis.final_accessibility_score,
          placeId
        ]);
      }
      
      // 접근성 리포트 데이터 준비
      const accessibilityScore = data.llm_analysis.final_accessibility_score;
      const recommendations = data.llm_analysis.recommendations;
      const highlightedObstacles = data.llm_analysis.observations;
      
      // AI 분석 데이터
      const aiAnalysis = {
        has_stairs: data.accessibility_info.has_stairs,
        has_ramp: data.accessibility_info.has_ramp,
        entrance_accessible: data.accessibility_info.entrance_accessible,
        obstacles: data.accessibility_info.obstacles,
        obstacle_details: data.accessibility_info.obstacle_details,
        stairs_count: data.llm_analysis.stairs_count,
        stairs_height: data.llm_analysis.stairs_height,
        stair_detection_confidence: data.llm_analysis.stair_detection_confidence,
        alternative_route: data.llm_analysis.alternative_route,
        alternative_route_description: data.llm_analysis.alternative_route_description
      };
      
      // 시설 상세 정보
      const facilityDetails = data.facility_info.accessibility_details;
      
      // 요약 생성
      const summary = `${data.kakao_mapping.place_name}의 접근성 분석 결과입니다. 최종 접근성 점수: ${accessibilityScore}/10점 (외부 접근성: ${data.llm_analysis.external_accessibility_score}점, 내부 접근성: ${data.llm_analysis.internal_accessibility_score}점)`;
      
      // 접근성 리포트 삽입/업데이트
      const insertQuery = `
        INSERT INTO accessibility_reports (
          place_id, kakao_place_id, summary, accessibility_score, 
          recommendations, highlighted_obstacles, ai_analysis, facility_details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (kakao_place_id) DO UPDATE SET
          summary = EXCLUDED.summary,
          accessibility_score = EXCLUDED.accessibility_score,
          recommendations = EXCLUDED.recommendations,
          highlighted_obstacles = EXCLUDED.highlighted_obstacles,
          ai_analysis = EXCLUDED.ai_analysis,
          facility_details = EXCLUDED.facility_details,
          updated_at = NOW()
      `;
      
      await pool.query(insertQuery, [
        placeId,
        data.kakao_mapping.place_id,
        summary,
        accessibilityScore,
        JSON.stringify(recommendations),
        JSON.stringify(highlightedObstacles),
        JSON.stringify(aiAnalysis),
        JSON.stringify(facilityDetails)
      ]);
      
      console.log(`✅ 성공: ${data.kakao_mapping.place_name} (접근성 점수: ${accessibilityScore}점)`);
      
    } catch (error) {
      console.error(`❌ 파일 처리 오류 ${filePath}:`, error);
    }
  }
  
  console.log('새로운 접근성 데이터 마이그레이션 완료!');
}

// 실행
migrateNewAccessibilityData().catch(console.error).finally(() => {
  pool.end();
});