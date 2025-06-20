"""
FastAPI 서버 - 접근성 데이터를 수신하고 저장하는 API 서버
"""
import os
import json
import time
from datetime import datetime
from typing import Optional, Dict, List, Any, Union
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, Header, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# 데이터 저장 경로
DATA_DIR = Path("api_data")
DATA_DIR.mkdir(exist_ok=True)

# API 보안 설정
API_KEY = os.environ.get("API_SERVER_KEY", "test_api_key")

# FastAPI 앱 생성
app = FastAPI(
    title="접근성 데이터 API",
    description="건물 접근성 정보를 수신하고 저장하는 API",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 배포 환경에서는 특정 도메인으로 제한해야 합니다
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터 모델 정의
class LocationInfo(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    building_name: Optional[str] = None

class AccessibilityInfo(BaseModel):
    has_stairs: bool = False
    has_ramp: bool = False
    entrance_accessible: bool = True
    obstacles: List[str] = []
    accessibility_score: Optional[int] = None
    obstacle_details: Optional[Dict[str, Any]] = None

class FacilityInfo(BaseModel):
    available: bool = False
    facility_name: Optional[str] = None
    address: Optional[str] = None
    disabled_toilet: bool = False
    elevator: bool = False
    wheelchair_lift: bool = False
    contact_info: bool = False
    video_guide: bool = False
    braille_info: bool = False
    braille_floor_guide: bool = False
    voice_guide: bool = False
    exact_match: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance: Optional[float] = None
    message: Optional[str] = None

class AIAnalysis(BaseModel):
    wheelchair_accessibility_score: Optional[int] = None
    stairs_count: Optional[int] = None
    stairs_height: Optional[str] = None
    alternative_route: Optional[bool] = None
    alternative_route_description: Optional[str] = None
    recommendations: Optional[List[str]] = None
    visual_impairment_accessibility: Optional[int] = None
    hearing_impairment_accessibility: Optional[int] = None
    observations: Optional[List[str]] = None
    text_response: Optional[str] = None

class AccessibilityData(BaseModel):
    location: LocationInfo
    accessibility: AccessibilityInfo
    facility: Optional[FacilityInfo] = None
    ai_analysis: Optional[AIAnalysis] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    image_path: Optional[str] = None
    overlay_path: Optional[str] = None

# API 키 검증 함수
async def verify_api_key(authorization: str = Header(None)):
    if authorization is None or authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="유효하지 않은 API 키")
    return True

# API 엔드포인트 정의
@app.post("/accessibility", response_model=Dict[str, Any])
async def create_accessibility_data(
    data: AccessibilityData,
    authenticated: bool = Depends(verify_api_key)
):
    """
    접근성 데이터를 수신하고 저장
    """
    try:
        # 위치 정보 확인
        if not data.location or (data.location.latitude is None and data.location.longitude is None):
            return {
                "status": "error",
                "message": "위치 정보가 제공되지 않았습니다."
            }
            
        # 데이터 ID 생성 (타임스탬프 + 위치 기반)
        timestamp = int(time.time())
        lat = data.location.latitude or 0
        lon = data.location.longitude or 0
        data_id = f"{timestamp}_{lat}_{lon}"
        
        # 데이터 저장
        file_path = DATA_DIR / f"{data_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(data.json(ensure_ascii=False, indent=2))
        
        return {
            "status": "success",
            "message": "데이터가 성공적으로 저장되었습니다",
            "data_id": data_id,
            "file_path": str(file_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 저장 중 오류 발생: {str(e)}")

@app.get("/accessibility/{data_id}", response_model=AccessibilityData)
async def get_accessibility_data(
    data_id: str,
    authenticated: bool = Depends(verify_api_key)
):
    """
    저장된 접근성 데이터 조회
    """
    file_path = DATA_DIR / f"{data_id}.json"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"ID가 {data_id}인 데이터를 찾을 수 없습니다")
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 조회 중 오류 발생: {str(e)}")

@app.get("/accessibility", response_model=List[str])
async def list_accessibility_data(
    authenticated: bool = Depends(verify_api_key)
):
    """
    저장된 모든 접근성 데이터 ID 목록 조회
    """
    try:
        data_ids = [file.stem for file in DATA_DIR.glob("*.json")]
        return data_ids
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 목록 조회 중 오류 발생: {str(e)}")

@app.post("/ping", response_model=Dict[str, Any])
async def ping(
    request: Request,
    authenticated: bool = Depends(verify_api_key)
):
    """
    API 연결 테스트
    """
    body = await request.json()
    return {
        "status": "success",
        "message": "API 서버가 정상적으로 동작 중입니다",
        "received": body,
        "timestamp": datetime.now().isoformat()
    }

# 메인 실행 함수
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True)