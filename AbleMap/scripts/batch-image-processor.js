#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * 배치 이미지 처리 스크립트
 * attached_assets 폴더의 이미지들을 자동으로 place 폴더로 이동
 */
class BatchImageProcessor {
  constructor() {
    this.sourceDir = './attached_assets';
    this.targetDir = './public/images';
    this.processedImages = [];
  }

  /**
   * 이미지 파일 목록 가져오기
   */
  getImageFiles() {
    if (!fs.existsSync(this.sourceDir)) {
      console.log('❌ attached_assets 폴더가 없습니다.');
      return [];
    }

    const files = fs.readdirSync(this.sourceDir);
    return files.filter(file => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );
  }

  /**
   * 파일명에서 place ID 추출 (사용자 정의 매핑)
   */
  extractPlaceId(filename) {
    // 파일명 매핑 규칙 (사용자가 직접 설정)
    const mappings = {
      // 예시: '파일명': 'place_id'
      '더벤티_이대점.png': '1281875985',
      '금별맥주_신촌점.png': '1873432888',
      '광장약국.png': '1804716056',
      '단코.png': '1743481382',
      '나무약국.png': '425027300',
      '가까운신촌약국.png': '27404690',
      '대학약국신촌점.png': '23024074',
      // 추가 매핑을 여기에 등록
    };

    return mappings[filename] || null;
  }

  /**
   * 이미지 타입 결정 (기본값: entrance)
   */
  getImageType(filename) {
    const lowerName = filename.toLowerCase();
    
    if (lowerName.includes('entrance') || lowerName.includes('입구')) {
      return 'entrance';
    } else if (lowerName.includes('toilet') || lowerName.includes('화장실')) {
      return 'toilet';
    } else if (lowerName.includes('elevator') || lowerName.includes('엘리베이터')) {
      return 'elevator';
    } else {
      return 'entrance'; // 기본값
    }
  }

  /**
   * 단일 이미지 처리
   */
  processImage(filename) {
    const placeId = this.extractPlaceId(filename);
    
    if (!placeId) {
      console.log(`⚠️  ${filename}: Place ID 매핑을 찾을 수 없습니다.`);
      return false;
    }

    const imageType = this.getImageType(filename);
    const sourcePath = path.join(this.sourceDir, filename);
    const targetFolder = path.join(this.targetDir, `place_${placeId}`);
    
    // 폴더 생성
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    // 기존 이미지 개수 확인하여 번호 결정
    const existingImages = fs.readdirSync(targetFolder)
      .filter(file => file.startsWith(imageType))
      .length;
    
    const imageNumber = existingImages + 1;
    const targetPath = path.join(targetFolder, `${imageType}_${imageNumber}.png`);

    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`✅ ${filename} → place_${placeId}/${imageType}_${imageNumber}.png`);
      
      this.processedImages.push({
        source: filename,
        placeId: placeId,
        target: `${imageType}_${imageNumber}.png`,
        type: imageType
      });
      
      return true;
    } catch (error) {
      console.error(`❌ ${filename} 처리 실패:`, error.message);
      return false;
    }
  }

  /**
   * 모든 이미지 일괄 처리
   */
  processAllImages() {
    console.log('🚀 배치 이미지 처리 시작\n');
    
    const imageFiles = this.getImageFiles();
    
    if (imageFiles.length === 0) {
      console.log('📁 처리할 이미지가 없습니다.');
      return;
    }

    console.log(`📊 발견된 이미지: ${imageFiles.length}개\n`);

    let successCount = 0;
    let failCount = 0;

    imageFiles.forEach(filename => {
      if (this.processImage(filename)) {
        successCount++;
      } else {
        failCount++;
      }
    });

    console.log('\n📈 처리 결과:');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    
    if (this.processedImages.length > 0) {
      console.log('\n📋 처리된 이미지 목록:');
      this.processedImages.forEach(img => {
        console.log(`   ${img.source} → place_${img.placeId}/${img.target}`);
      });
    }
  }

  /**
   * 매핑 파일 생성 도구
   */
  generateMappingTemplate() {
    const imageFiles = this.getImageFiles();
    const template = imageFiles.map(file => `      '${file}': 'PLACE_ID_HERE',`).join('\n');
    
    console.log('📝 매핑 템플릿 (extractPlaceId 함수에 추가):');
    console.log('```javascript');
    console.log('const mappings = {');
    console.log(template);
    console.log('};');
    console.log('```');
  }
}

// CLI 실행
if (require.main === module) {
  const processor = new BatchImageProcessor();
  const args = process.argv.slice(2);
  
  if (args.includes('--template')) {
    processor.generateMappingTemplate();
  } else {
    processor.processAllImages();
  }
}

module.exports = BatchImageProcessor;