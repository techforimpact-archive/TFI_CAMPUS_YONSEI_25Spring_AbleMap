#!/usr/bin/env tsx

import { db } from '../server/db.js';
import { places, accessibilityReports } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface POIBatchConfig {
  jsonFilesPath: string;
  imagesPath: string;
  outputPath: string;
  batchName: string;
}

interface ProcessedPOI {
  kakaoPlaceId: string;
  placeName: string;
  coordinates: { lat: number; lng: number };
  accessibilityScore: number;
  summary: string;
  recommendations: string[];
  aiAnalysis: any;
  imagePaths?: string[];
}

class POIBatchProcessor {
  private config: POIBatchConfig;
  private processedCount = 0;
  private skippedCount = 0;
  private errorCount = 0;

  constructor(config: POIBatchConfig) {
    this.config = config;
  }

  async processBatch(): Promise<void> {
    console.log(`🚀 Starting ${this.config.batchName} batch processing...`);
    console.log(`📁 Source: ${this.config.jsonFilesPath}`);
    console.log(`🖼️ Images: ${this.config.imagesPath}`);

    try {
      // 1. Scan for JSON files
      const jsonFiles = this.findJSONFiles();
      console.log(`📄 Found ${jsonFiles.length} JSON files to process`);

      // 2. Process each file
      for (const filePath of jsonFiles) {
        await this.processJSONFile(filePath);
      }

      // 3. Generate summary
      this.generateSummary();

    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      throw error;
    }
  }

  private findJSONFiles(): string[] {
    if (!fs.existsSync(this.config.jsonFilesPath)) {
      throw new Error(`JSON files path does not exist: ${this.config.jsonFilesPath}`);
    }

    return fs.readdirSync(this.config.jsonFilesPath)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(this.config.jsonFilesPath, file));
  }

  private async processJSONFile(filePath: string): Promise<void> {
    try {
      const fileName = path.basename(filePath);
      console.log(`\n📁 Processing: ${fileName}`);

      // Read and parse JSON
      const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const poi = this.parseJSONData(jsonData);

      if (!poi) {
        console.log(`⚠️ Skipping ${fileName}: Invalid data structure`);
        this.skippedCount++;
        return;
      }

      // Check if already exists
      const existingPlace = await this.checkExistingPlace(poi.kakaoPlaceId);
      if (existingPlace) {
        console.log(`📍 Place already exists: ${poi.placeName}`);
        this.skippedCount++;
        return;
      }

      // Create place
      const placeId = await this.createPlace(poi);
      
      // Create accessibility report
      await this.createAccessibilityReport(placeId, poi);

      // Process images if available
      await this.processImages(poi.kakaoPlaceId, poi.imagePaths);

      console.log(`✅ Successfully processed: ${poi.placeName}`);
      this.processedCount++;

    } catch (error) {
      console.error(`❌ Error processing ${path.basename(filePath)}:`, error);
      this.errorCount++;
    }
  }

  private parseJSONData(jsonData: any): ProcessedPOI | null {
    try {
      const kakaoMapping = jsonData.kakao_mapping;
      const accessibilityInfo = jsonData.accessibility_info;
      const llmAnalysis = jsonData.llm_analysis;

      if (!kakaoMapping || !accessibilityInfo || !llmAnalysis) {
        return null;
      }

      return {
        kakaoPlaceId: kakaoMapping.place_id,
        placeName: kakaoMapping.place_name,
        coordinates: kakaoMapping.coordinates,
        accessibilityScore: llmAnalysis.final_accessibility_score || accessibilityInfo.accessibility_score,
        summary: this.generateSummary(llmAnalysis),
        recommendations: this.extractRecommendations(llmAnalysis),
        aiAnalysis: llmAnalysis
      };
    } catch (error) {
      console.error('Error parsing JSON data:', error);
      return null;
    }
  }

  private generateAccessibilitySummary(llmAnalysis: any): string {
    const observations = llmAnalysis.observations || [];
    const assessment = llmAnalysis.stair_severity_assessment || '';
    
    return observations.slice(0, 3).join(' ') || assessment || '접근성 정보가 분석되었습니다.';
  }

  private extractRecommendations(llmAnalysis: any): string[] {
    const recommendations: string[] = [];
    
    if (llmAnalysis.recommendations?.for_independent) {
      recommendations.push(...llmAnalysis.recommendations.for_independent);
    }
    if (llmAnalysis.recommendations?.for_assisted) {
      recommendations.push(...llmAnalysis.recommendations.for_assisted);
    }
    if (llmAnalysis.recommendations?.facility_improvements) {
      recommendations.push(...llmAnalysis.recommendations.facility_improvements.slice(0, 2));
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  private async checkExistingPlace(kakaoPlaceId: string): Promise<boolean> {
    try {
      const existing = await db
        .select()
        .from(places)
        .where(eq(places.kakaoPlaceId, kakaoPlaceId))
        .limit(1);
      
      return existing.length > 0;
    } catch (error) {
      console.error('Error checking existing place:', error);
      return false;
    }
  }

  private async createPlace(poi: ProcessedPOI): Promise<number> {
    const result = await db.insert(places).values({
      kakaoPlaceId: poi.kakaoPlaceId,
      placeName: poi.placeName,
      latitude: poi.coordinates.lat.toString(),
      longitude: poi.coordinates.lng.toString(),
      accessibilityScore: poi.accessibilityScore
    }).returning({ id: places.id });

    return result[0].id;
  }

  private async createAccessibilityReport(placeId: number, poi: ProcessedPOI): Promise<void> {
    await db.insert(accessibilityReports).values({
      placeId: placeId,
      kakaoPlaceId: poi.kakaoPlaceId,
      summary: poi.summary,
      accessibilityScore: poi.accessibilityScore,
      recommendations: poi.recommendations,
      highlightedObstacles: poi.aiAnalysis.highlighted_obstacles || [],
      aiAnalysis: poi.aiAnalysis,
      facilityDetails: poi.aiAnalysis.facility_details || {}
    });
  }

  private async processImages(kakaoPlaceId: string, imagePaths?: string[]): Promise<void> {
    if (!imagePaths || imagePaths.length === 0) {
      return;
    }

    const targetDir = path.join(this.config.outputPath, `place_${kakaoPlaceId}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Copy images
    for (let i = 0; i < imagePaths.length; i++) {
      const sourcePath = imagePaths[i];
      const imageType = this.detectImageType(sourcePath);
      const targetPath = path.join(targetDir, `${imageType}_${i + 1}.png`);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`📸 Copied image: ${imageType}_${i + 1}.png`);
      }
    }
  }

  private detectImageType(imagePath: string): string {
    const fileName = path.basename(imagePath).toLowerCase();
    
    if (fileName.includes('entrance') || fileName.includes('입구')) return 'entrance';
    if (fileName.includes('elevator') || fileName.includes('엘리베이터')) return 'elevator';
    if (fileName.includes('toilet') || fileName.includes('화장실')) return 'toilet';
    if (fileName.includes('interior') || fileName.includes('내부')) return 'interior';
    
    return 'entrance'; // Default to entrance
  }

  private generateSummary(): void {
    console.log('\n🎉 Batch processing completed!');
    console.log(`✅ Successfully processed: ${this.processedCount} files`);
    console.log(`⚠️ Skipped (duplicates): ${this.skippedCount} files`);
    console.log(`❌ Errors: ${this.errorCount} files`);
    console.log(`📊 Total files: ${this.processedCount + this.skippedCount + this.errorCount}`);
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/batch-poi-processor.ts <json_files_path> <batch_name> [images_path]');
    console.log('Example: npx tsx scripts/batch-poi-processor.ts ./attached_assets "Batch 7" ./images');
    process.exit(1);
  }

  const config: POIBatchConfig = {
    jsonFilesPath: args[0],
    batchName: args[1],
    imagesPath: args[2] || './attached_assets',
    outputPath: './public/images'
  };

  const processor = new POIBatchProcessor(config);
  
  try {
    await processor.processBatch();
    console.log('✅ Script completed successfully');
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { POIBatchProcessor };