import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

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
  accessibility_info?: {
    accessibility_score: number;
  };
  llm_analysis?: {
    final_accessibility_score: number;
    recommendations: string[];
    observations: string[];
  };
  facility_info?: {
    accessibility_details: any;
  };
}

async function migrateAccessibilityData() {
  console.log('접근성 데이터 마이그레이션 시작...');
  
  // 고유 제약조건 추가
  try {
    await pool.query(`
      ALTER TABLE accessibility_reports 
      ADD CONSTRAINT unique_kakao_place_id UNIQUE (kakao_place_id)
    `);
  } catch (error) {
    // 이미 존재하는 경우 무시
  }
  
  const assetsDir = path.join(process.cwd(), 'attached_assets');
  const jsonFiles = fs.readdirSync(assetsDir).filter(file => file.endsWith('.json'));
  
  for (const file of jsonFiles) {
    try {
      const filePath = path.join(assetsDir, file);
      const data: AccessibilityData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      console.log(`처리 중: ${file}`);
      
      // 카카오 POI ID로 장소 조회
      const placeQuery = `
        SELECT id FROM places_accessibility 
        WHERE kakao_place_id = $1
      `;
      const placeResult = await pool.query(placeQuery, [data.kakao_mapping.place_id]);
      
      if (placeResult.rows.length === 0) {
        console.log(`장소를 찾을 수 없음: ${data.kakao_mapping.place_name} (${data.kakao_mapping.place_id})`);
        continue;
      }
      
      const placeId = placeResult.rows[0].id;
      
      // 접근성 점수 결정
      const accessibilityScore = data.llm_analysis?.final_accessibility_score || 
                                data.accessibility_info?.accessibility_score || 5;
      
      // 추천사항
      const recommendations = data.llm_analysis?.recommendations || [];
      
      // 장애물 정보 (observations를 highlighted_obstacles로 사용)
      const highlightedObstacles = data.llm_analysis?.observations || [];
      
      // AI 분석 데이터
      const aiAnalysis = data.accessibility_info ? {
        has_stairs: data.accessibility_info.has_stairs || false,
        has_ramp: data.accessibility_info.has_ramp || false,
        entrance_accessible: data.accessibility_info.entrance_accessible || false,
        obstacles: data.accessibility_info.obstacles || []
      } : null;
      
      // 시설 상세 정보
      const facilityDetails = data.facility_info?.accessibility_details || null;
      
      // 요약 생성
      const summary = `${data.kakao_mapping.place_name}의 접근성 분석 결과입니다. 접근성 점수: ${accessibilityScore}/10`;
      
      // 접근성 리포트 삽입
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
        aiAnalysis ? JSON.stringify(aiAnalysis) : null,
        facilityDetails ? JSON.stringify(facilityDetails) : null
      ]);
      
      console.log(`성공: ${data.kakao_mapping.place_name}`);
      
    } catch (error) {
      console.error(`파일 처리 오류 ${file}:`, error);
    }
  }
  
  console.log('접근성 데이터 마이그레이션 완료!');
}

// 실행
migrateAccessibilityData().catch(console.error).finally(() => {
  pool.end();
});