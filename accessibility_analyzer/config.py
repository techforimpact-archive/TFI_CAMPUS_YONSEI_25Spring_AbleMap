"""
설정 파일 - 환경 변수, API 키, 모델 경로 등 설정 (FastAPI 통합 업데이트)
"""
import os
from pathlib import Path

# 기본 경로 설정
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = DATA_DIR / "models"
IMAGES_DIR = DATA_DIR / "images"
RESULTS_DIR = DATA_DIR / "results"
OVERLAY_DIR = RESULTS_DIR / "overlays"
REPORTS_DIR = RESULTS_DIR / "reports"
CACHE_DIR = BASE_DIR / "cache"

# 디렉토리 생성
for dir_path in [MODEL_DIR, IMAGES_DIR, OVERLAY_DIR, REPORTS_DIR, CACHE_DIR]:
    os.makedirs(dir_path, exist_ok=True)

# 모델 설정
SEGFORMER_MODEL = "nvidia/segformer-b5-finetuned-ade-640-640"
DEVICE = "cpu"  # CUDA 대신 CPU 사용

# API 키 설정
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")  # OpenAI API 키를 여기에 입력하세요
# LLM_API_KEY = os.environ.get("LLM_API_KEY","")
FACILITY_API_KEY = os.environ.get("FACILITY_API_KEY", "")  # 공공데이터포털에서 발급받은 키
FACILITY_API_ENDPOINT = ""  # 공공데이터포털 API 엔드포인트

# FastAPI 설정
USE_FASTAPI = os.environ.get("USE_FASTAPI", "true").lower() == "true"
FASTAPI_HOST = os.environ.get("FASTAPI_HOST", "localhost")
FASTAPI_PORT = int(os.environ.get("FASTAPI_PORT", "8000"))
FASTAPI_ENDPOINT = os.environ.get(
    "FASTAPI_ENDPOINT", 
    f"http://{FASTAPI_HOST}:{FASTAPI_PORT}/accessibility"
)
FASTAPI_API_KEY = os.environ.get("FASTAPI_API_KEY", "test_api_key")

# 세그멘테이션 설정
CLASS_MAP = {
    'road': 6,
    'sidewalk': 11,
    'building': 1,
    'stairs': 53,
    'door': 14,
    'runway': 54,
    'stairway': 59,
    'bench': 69,
    'dirt_road': 91,
    'railing': 95
}

# 색상 맵 설정 (RGB)
COLOR_MAP = {
    'road': [255, 0, 0],        # 빨강
    'sidewalk': [0, 255, 0],    # 초록
    'building': [0, 0, 255],    # 파랑
    'stairs': [255, 255, 0],    # 노랑
    'door': [255, 165, 0],      # 주황
    'runway': [128, 0, 128],    # 보라
    'stairway': [0, 255, 255],  # 청록
    'bench': [255, 105, 180],   # 분홍
    'dirt_road': [139, 69, 19], # 갈색
    'railing': [128, 128, 128]  # 회색
}

# 분석 설정
ACCESSIBILITY_THRESHOLD_DISTANCE = 50  # 픽셀 단위
# API_REQUEST_TIMEOUT = 10  # API 요청 타임아웃(초)
API_REQUEST_TIMEOUT = 120
API_MAX_RETRIES = 3  # API 요청 최대 재시도 횟수
CACHE_EXPIRY_SECONDS = 86400  # 캐시 만료 시간(초) - 24시간