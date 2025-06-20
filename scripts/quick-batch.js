const fs = require('fs');
const path = require('path');

// 파일명 → Place ID 매핑
const MAPPINGS = {
  // 기존 처리된 파일들
  '더벤티_이대점.png': '1281875985',
  '금별맥주_신촌점.png': '1873432888',
  '광장약국.png': '1804716056', 
  '단코.png': '1743481382',
  '나무약국.png': '425027300',
  '가까운신촌약국.png': '27404690',
  '대학약국신촌점.png': '23024074',
  
  // 새로 추가된 파일들
  '240H.png': '341724032',
  '더파이홀.png': '1011256721',
  '독수리약국.png': '10307858',
  '라화쿵푸_신촌점.png': '357243716',
  '마이시크릿메이트.png': '17358576',
  '바나프레소_신촌로터리점.png': '612349494',
  '맑은약국.png': '1137636806',
  '메가MGC커피_신촌점.png': '1843190721',
  '메가MGC커피_창천점.png': '2117567826',
  '몰리스.png': '26533401',
  '미도매운향솥.png': '580642361',
  '밥은먹었어.png': '636198841',
  '백순대본가새막_신촌연대점.png': '959867372',
  '비타민약국.png': '12958675',
  '빠빠빠치킨_신촌본점.png': '87565653',
  '새현대약국.png': '2097744166',
  '생마차_신촌점.png': '1422397621',
  '세란약국.png': '13565090',
  '세븐일레븐_연대점.png': '7880518',
  '송학.png': '16645779',
  '신보건약국.png': '13503993',
  '신촌1번약국.png': '1219585831',
  '신촌대로약국.png': '713864547',
  '썬더치킨_신촌연대점.png': '17066324',
  '써밋컬쳐_신촌점.png': '1052299075',
  '아마스빈_이대점.png': '25413895',
  '아소비바.png': '1602552761',
};

function processImages() {
  console.log('🚀 이미지 배치 처리 시작');
  
  const sourceDir = './attached_assets';
  const targetDir = './public/images';
  
  let processed = 0;
  let skipped = 0;
  
  for (const [filename, placeId] of Object.entries(MAPPINGS)) {
    const sourcePath = path.join(sourceDir, filename);
    const targetFolder = path.join(targetDir, `place_${placeId}`);
    
    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  ${filename} 파일을 찾을 수 없습니다`);
      skipped++;
      continue;
    }
    
    // 폴더 생성
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    
    // 이미지 번호 결정
    const existingFiles = fs.readdirSync(targetFolder).filter(f => f.startsWith('entrance_'));
    const imageNum = existingFiles.length + 1;
    const targetPath = path.join(targetFolder, `entrance_${imageNum}.png`);
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`✅ ${filename} → place_${placeId}/entrance_${imageNum}.png`);
      processed++;
    } catch (error) {
      console.error(`❌ ${filename} 처리 실패:`, error.message);
      skipped++;
    }
  }
  
  console.log(`\n📊 결과: ${processed}개 처리, ${skipped}개 건너뜀`);
}

processImages();