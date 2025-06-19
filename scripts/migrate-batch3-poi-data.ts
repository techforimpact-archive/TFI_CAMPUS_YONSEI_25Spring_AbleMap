import fs from 'fs';
import path from 'path';
import { db } from '../server/db.js';
import { places, accessibilityReports } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// List of new POI files to migrate (batch 3)
const poiFiles = [
  '아우어베이커리_신촌숲길점_report_20250607_083616.json',
  '에버그린약국_report_20250607_083650.json',
  '연대포분점_report_20250607_083720.json',
  '오늘통닭_신촌직영점_report_20250607_083754.json',
  '위드팜신촌약국_report_20250607_083829.json',
  '유자유_김치떡볶이_신촌점_report_20250607_083906.json',
  '이디야커피_연세대점_report_20250607_083941.json',
  '이로운약국_report_20250607_084000.json',
  '이씨_서울신촌점_report_20250607_084023.json',
  '일심약국_report_20250607_084048.json',
  '자연담은화로_신촌점_report_20250607_084117.json',
  '정문약국_report_20250607_084155.json',
  '주차편한우리약국_report_20250607_084341.json',
  '중경마라탕_report_20250607_084415.json',
  '치히로_신촌점_report_20250607_084450.json',
  '크리스터_치킨_report_20250607_084528.json',
  '클로리스_신촌점_report_20250607_084606.json',
  '투썸플레이스_마포노고산점_report_20250607_084645.json'
];

async function migrateBatch3POIData() {
  console.log('🚀 Starting batch 3 POI data migration...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const fileName of poiFiles) {
    try {
      console.log(`\n📁 Processing: ${fileName}`);
      
      const filePath = path.join(process.cwd(), 'attached_assets', fileName);
      
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${fileName}`);
        errorCount++;
        continue;
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const reportData = JSON.parse(fileContent);
      
      // Extract data from the report
      const kakaoPlaceId = reportData.kakao_mapping.place_id;
      const placeName = reportData.kakao_mapping.place_name;
      const latitude = reportData.kakao_mapping.coordinates.lat.toString();
      const longitude = reportData.kakao_mapping.coordinates.lng.toString();
      
      // Check if place already exists
      const existingPlace = await db.select()
        .from(places)
        .where(eq(places.kakaoPlaceId, kakaoPlaceId))
        .limit(1);
      
      let placeId: number;
      
      if (existingPlace.length > 0) {
        console.log(`📍 Place already exists: ${placeName} (${kakaoPlaceId})`);
        placeId = existingPlace[0].id;
      } else {
        // Create new place
        const [newPlace] = await db.insert(places).values({
          kakaoPlaceId,
          placeName,
          latitude,
          longitude,
          accessibilityScore: reportData.accessibility_info.accessibility_score
        }).returning();
        
        placeId = newPlace.id;
        console.log(`✅ Created new place: ${placeName} (${kakaoPlaceId})`);
      }
      
      // Check if accessibility data already exists
      const existingAccessibility = await db.select()
        .from(accessibilityReports)
        .where(eq(accessibilityReports.kakaoPlaceId, kakaoPlaceId))
        .limit(1);
      
      if (existingAccessibility.length > 0) {
        console.log(`📊 Accessibility data already exists for: ${placeName}`);
        continue;
      }
      
      // Prepare accessibility data
      let summary = '';
      let recommendations: string[] = [];
      let highlightedObstacles: any = {};
      let aiAnalysis: any = {};
      let facilityDetails: any = {};
      
      // Handle different llm_analysis structures
      if (reportData.llm_analysis) {
        if (reportData.llm_analysis.error) {
          // Handle error cases (like 이디야커피_연세대점, 이로운약국, 이씨_서울신촌점)
          summary = `접근성 점수: ${reportData.accessibility_info.accessibility_score}점. 상세 분석 데이터 처리 중입니다.`;
          recommendations = ['상세 접근성 정보는 추후 업데이트됩니다.'];
          highlightedObstacles = reportData.accessibility_info.obstacles || [];
        } else {
          // Normal case with full llm_analysis
          if (reportData.llm_analysis.observations) {
            summary = reportData.llm_analysis.observations.join(' ');
          } else if (reportData.llm_analysis.stair_severity_assessment) {
            summary = reportData.llm_analysis.stair_severity_assessment;
          } else {
            summary = `접근성 점수: ${reportData.accessibility_info.accessibility_score}점`;
          }
          
          // Extract recommendations
          if (reportData.llm_analysis.recommendations) {
            if (Array.isArray(reportData.llm_analysis.recommendations)) {
              recommendations = reportData.llm_analysis.recommendations;
            } else if (typeof reportData.llm_analysis.recommendations === 'object') {
              recommendations = [
                ...(reportData.llm_analysis.recommendations.for_independent || []),
                ...(reportData.llm_analysis.recommendations.for_assisted || []),
                ...(reportData.llm_analysis.recommendations.facility_improvements || [])
              ];
            }
          }
          
          highlightedObstacles = reportData.accessibility_info.obstacles || [];
          aiAnalysis = reportData.llm_analysis;
        }
      } else {
        summary = `접근성 점수: ${reportData.accessibility_info.accessibility_score}점`;
        recommendations = ['기본 접근성 정보가 제공됩니다.'];
        highlightedObstacles = reportData.accessibility_info.obstacles || [];
      }
      
      // Handle facility_info
      if (reportData.facility_info) {
        facilityDetails = {
          entrance: reportData.facility_info.accessibility_details?.entrance || null,
          elevator: reportData.facility_info.accessibility_details?.elevator || null,
          restroom: reportData.facility_info.accessibility_details?.restroom || null,
          parking: reportData.facility_info.accessibility_details?.parking || null
        };
      }
      
      // Insert accessibility data
      await db.insert(accessibilityReports).values({
        kakaoPlaceId,
        placeId,
        accessibilityScore: reportData.accessibility_info.accessibility_score,
        summary: summary.substring(0, 500), // Limit summary length
        recommendations: recommendations,
        highlightedObstacles: highlightedObstacles,
        aiAnalysis: aiAnalysis,
        facilityDetails: facilityDetails
      });
      
      console.log(`✅ Added accessibility data for: ${placeName} (score: ${reportData.accessibility_info.accessibility_score})`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error);
      errorCount++;
    }
  }
  
  console.log(`\n🎉 Batch 3 migration completed!`);
  console.log(`✅ Successfully processed: ${successCount} files`);
  console.log(`❌ Errors: ${errorCount} files`);
  console.log(`📊 Total files: ${poiFiles.length}`);
}

// Run the migration
migrateBatch3POIData()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });