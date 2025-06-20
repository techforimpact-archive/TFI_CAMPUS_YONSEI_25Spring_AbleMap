# 접근성 분석 시스템 (Accessibility Analyzer)

이 프로젝트는 카카오 로드뷰 이미지를 캡처하여 SegFormer 모델을 활용해 이미지 세그멘테이션을 수행하고, 오버레이 시킨 이미지를 LLM에 전달하여 건물 입구 근처의 계단, 턱 등 장애물 정보를 분석합니다. 또한 공공데이터 API를 통해 해당 건물의 장애인편의시설 정보를 함께 제공합니다.

## 주요 기능

1. **이미지 세그멘테이션**: SegFormer 모델을 사용하여, 이미지에서 도로, 인도, 계단, 문 등을 식별합니다.
2. **접근성 분석**: 세그멘테이션 결과를 기반으로 휠체어 접근성 관련 장애물을 식별하고 분석합니다.
3. **장애인편의시설 데이터 연동**: 공공데이터포털의 장애인편의시설 현황 데이터를 연동하여 엘리베이터, 장애인 화장실 등의 정보를 제공합니다.
4. **LLM 기반 분석**: 세그멘테이션 결과와 공공데이터를 LLM에 전달하여 종합적인 접근성 정보를 생성합니다.
5. **API 연동**: 분석된 결과를 API를 통해 외부 시스템으로 전송합니다.

## 시스템 구성

```
accessibility_analyzer/
│
├── main.py                      # 메인 실행 파일
├── config.py                    # 설정 파일 (API 키, 모델 경로 등)
├── requirements.txt             # 필요한 라이브러리 목록
│
├── modules/
│   ├── segmentation.py          # 이미지 세그멘테이션 관련 코드
│   ├── accessibility_analysis.py # 접근성 분석 관련 코드
│   ├── facility_data.py         # 장애인편의시설 데이터 관련 코드
│   ├── llm_interface.py         # LLM API 호출 관련 코드
│   ├── api_client.py            # 외부 API 연동 관련 코드
│   └── utils.py                 # 유틸리티 함수
│
├── data/
│   ├── models/                  # 모델 파일 저장 위치
│   ├── images/                  # 입력 이미지 저장 위치
│   └── results/                 # 결과물 저장 위치
│       ├── overlays/            # 오버레이 이미지
│       └── reports/             # 분석 보고서
│
└── cache/                       # API 응답 캐싱 디렉토리
```

## 설치 방법

1. **환경 설정**:
```bash
# 가상 환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 필요 패키지 설치
pip install -r requirements.txt
```

2. **API 키 설정**:
```bash
# 환경 변수 설정
export LLM_API_KEY="your_llm_api_key"
export FACILITY_API_KEY="your_facility_api_key"
export ACCESSIBILITY_API_KEY="your_accessibility_api_key"
```

## 사용 방법

### 단일 이미지 분석
```bash
python main.py --image data/images/example.jpg
```

### 디렉토리 내 모든 이미지 분석
```bash
python main.py --dir data/images/
```

### API로 결과 전송
```bash
python main.py --image data/images/example.jpg --api
```

### 사용자 지정 출력 디렉토리
```bash
python main.py --image data/images/example.jpg --output custom_output/
```

### API 연결 테스트
```bash
python main.py --test
```

## API 응답 데이터 구조

```json
{
  "location": {
    "latitude": 37.123456,
    "longitude": 127.123456,
    "address": "서울시 강남구 테헤란로",
    "building_name": "샘플 빌딩"
  },
  "accessibility": {
    "has_stairs": true,
    "has_ramp": false,
    "entrance_accessible": false,
    "obstacles": ["stairs", "stairs_at_entrance"],
    "accessibility_score": 5,
    "obstacle_details": {
      "stairs": {
        "pixel_count": 1520,
        "ratio": 0.08,
        "estimated_size": "medium"
      },
      "stairs_to_door_distance": 25.5
    }
  },
  "facility": {
    "available": true,
    "facility_name": "샘플 빌딩",
    "address": "서울시 강남구 테헤란로 123",
    "disabled_toilet": true,
    "elevator": true,
    "wheelchair_lift": false,
    "braille_info": true,
    "voice_guide": false
  },
  "ai_analysis": {
    "wheelchair_accessibility_score": 6,
    "stairs_count": 3,
    "alternative_route": false,
    "recommendations": [
      "휠체어 사용자는 도움이 필요합니다",
      "건물 내부에 엘리베이터가 있어 일단 입구를 통과하면 이동이 수월합니다"
    ],
    "observations": [
      "계단은 보통 높이의 3개 단으로 구성되어 있습니다",
      "문 너비는 휠체어 통과에 충분합니다"
    ]
  },
  "timestamp": "2025-04-30T15:30:45.123456"
}
```

## 개발자 참고사항

- **세그멘테이션 모델**: 현재 `nvidia/segformer-b5-finetuned-ade-640-640` 모델을 사용하고 있습니다. 필요에 따라 다른 모델로 교체하거나 접근성 관련 데이터로 파인튜닝할 수 있습니다.

- **공공데이터 API**: 한국사회보장정보원의 장애인편의시설 현황 데이터를 활용합니다. API 키는 [공공데이터포털](https://www.data.go.kr/data/15092317/openapi.do)에서 발급받을 수 있습니다.

- **캐싱**: API 요청의 효율성을 위해 파일 기반 캐싱을 구현하였습니다. 캐시 만료 시간은 기본적으로 24시간으로 설정되어 있으며, `config.py`에서 조정할 수 있습니다.

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.
