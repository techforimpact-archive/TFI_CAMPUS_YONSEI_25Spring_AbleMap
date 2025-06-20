"""
접근성 분석 시스템 메인 실행 파일 (FastAPI 통합 업데이트)
"""
import os
import argparse
import time
import requests
from pathlib import Path
from datetime import datetime
import pandas as pd
import json

from modules.segmentation import SegmentationModel
from modules.accessibility_analysis import AccessibilityAnalyzer
from modules.facility_data import FacilityData
from modules.llm_interface import LLMAnalyzer
from modules.api_client import APIClient
from modules.utils import (
    generate_output_paths, save_report, extract_location_from_image,
    measure_execution_time, validate_image, get_image_files_in_directory,
    logger
)
from config import (
    IMAGES_DIR, OVERLAY_DIR, REPORTS_DIR, 
    USE_FASTAPI, FASTAPI_HOST, FASTAPI_PORT
)

import pandas as pd
import json

def load_kakao_mapping_data(csv_path="processed_output.csv"):
    """
    CSV 파일에서 카카오 매핑 데이터를 로드하여 딕셔너리로 반환
    
    Args:
        csv_path: CSV 파일 경로
    
    Returns:
        dict: 파일명을 키로 하는 매핑 딕셔너리
    """
    try:
        df = pd.read_csv(csv_path)
        mapping_data = {}
        
        for _, row in df.iterrows():
            filename = row['파일명']
            place_id = str(row['숫자'])
            address = row['주소']
            
            # 파일명에서 확장자 제거하고 _ -> 공백 변환 (place_name용)
            place_name = filename.replace('.png', '').replace('_', ' ')
            
            # 주소 파싱
            address_parts = address.split('_')
            si_do_nm = address_parts[0]
            cgg_nm = address_parts[1]
            road_nm = '_'.join(address_parts[2:])  # 두번째 _ 이후 모두
            facl_nm = filename.replace('.png', '')  # 확장자만 제거, _ 유지
            
            mapping_data[filename] = {
                "kakao_mapping": {
                    "place_id": place_id,
                    "place_name": place_name,
                    "coordinates": {
                        "lat": None,
                        "lng": None
                    }
                },
                "location_info": {
                    "siDoNm": si_do_nm,
                    "cggNm": cgg_nm,
                    "faclNm": facl_nm,
                    "roadNm": road_nm
                }
            }
        
        return mapping_data
    except Exception as e:
        logger.error(f"카카오 매핑 데이터 로드 실패: {str(e)}")
        return {}

def get_location_info_from_mapping(image_path, mapping_data):
    """
    이미지 경로에서 파일명을 추출하여 매핑 데이터에서 위치 정보 반환
    
    Args:
        image_path: 이미지 파일 경로
        mapping_data: 매핑 딕셔너리
    
    Returns:
        dict: 카카오 매핑 및 위치 정보
    """
    filename = os.path.basename(image_path)
    
    if filename in mapping_data:
        return mapping_data[filename]
    else:
        logger.warning(f"매핑 데이터에서 {filename}을 찾을 수 없습니다.")
        return None

@measure_execution_time
def process_image(image_path, output_dir=None, send_to_api=False):
    """
    단일 이미지 처리
    
    Args:
        image_path: 이미지 파일 경로
        output_dir: 결과물 저장 디렉토리 (None이면 기본값 사용)
        send_to_api: API 전송 여부
    
    Returns:
        dict: 처리 결과
    """
    # 이미지 존재 및 유효성 확인
    if not os.path.exists(image_path):
        return {"error": f"Image not found: {image_path}"}
    
    if not validate_image(image_path):
        return {"error": f"Invalid image file: {image_path}"}
    
    # 출력 경로 설정
    output_paths = generate_output_paths(image_path, output_dir)

    mapping_data = load_kakao_mapping_data()
    
    # 위치 정보 추출
    location_mapping = get_location_info_from_mapping(image_path, mapping_data)
    if location_mapping:
        # 새로운 형식의 위치 정보 사용
        kakao_mapping = location_mapping["kakao_mapping"]
        location_info = location_mapping["location_info"]
        logger.info(f"매핑 데이터에서 위치 정보 로드: {location_info['faclNm']}")
    else:
        # 매핑 데이터가 없는 경우 기존 방식 사용
        location_info = extract_location_from_image(image_path)
        kakao_mapping = None
        logger.info(f"기존 방식으로 위치 정보 추출: {location_info}")
    
    try:
        # 세그멘테이션 모델 초기화 및 실행
        logger.info(f"Processing image: {image_path}")
        segmentation_model = SegmentationModel()
        image, image_np, seg_map = segmentation_model.process_image(image_path)
        
        # 오버레이 이미지 생성
        logger.info("Creating overlay image...")
        blended, color_map = segmentation_model.create_overlay(image_np, seg_map)
        segmentation_model.save_overlay(blended, output_paths["overlay"])
        
        # 접근성 분석
        logger.info("Analyzing accessibility...")
        analyzer = AccessibilityAnalyzer()
        accessibility_info = analyzer.analyze(seg_map)
        
        # 장애인편의시설 데이터 가져오기
        logger.info("Checking facility data availability...")
        facility_data = FacilityData()
        facility_info = facility_data.get_facility_info(location_info)
        
        # 공공데이터 사용 여부에 따른 처리 분기
        if facility_info and facility_info.get("available", False):
            logger.info("Public facility data available - using hybrid scoring")
            analysis_mode = "hybrid"  # 외부 40% + 내부 60%
        else:
            logger.info("No public facility data - using image-based analysis only")
            analysis_mode = "image_only"  # 외부 점수만 사용
            facility_info = None  # LLM에 None 전달하여 이미지 기반 분석 모드 활성화
        
        # LLM 분석
        logger.info(f"Requesting LLM analysis (mode: {analysis_mode})...")
        llm = LLMAnalyzer()
        llm_analysis = llm.analyze_image(image_path, output_paths["overlay"], accessibility_info, facility_info)
        
        # 분석 모드 정보 추가
        if isinstance(llm_analysis, dict):
            llm_analysis["analysis_mode"] = analysis_mode 

        # 결과 종합
        result = {
            "image_path": image_path,
            "overlay_path": output_paths["overlay"],
        }
        
        # 카카오 매핑 정보가 있으면 추가
        if kakao_mapping:
            result["kakao_mapping"] = kakao_mapping
        
        result.update({
            "location_info": location_info,
            "accessibility_info": accessibility_info,
            "facility_info": facility_info,
            "llm_analysis": llm_analysis,
            "timestamp": datetime.now().isoformat()
        })
        
        # 보고서 저장
        logger.info("Saving report...")
        save_report(result, output_paths["report"])
        
        # API 전송 (선택적)
        if send_to_api:
            logger.info("Sending data to API...")
            api_client = APIClient()
            api_response = api_client.send_accessibility_data(
                location_info, 
                accessibility_info, 
                facility_info, 
                llm_analysis,
                image_path,
                output_paths["overlay"]
            )
            result["api_response"] = api_response
        
        logger.info(f"Processing complete. Results saved to {output_paths['report']}")
        return result
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        error_result = {
            "error": f"Processing error: {str(e)}",
            "details": error_details,
            "image_path": image_path,
            "timestamp": datetime.now().isoformat()
        }
        
        # 오류 보고서 저장
        error_report_path = os.path.join(
            REPORTS_DIR, 
            f"{Path(image_path).stem}_error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        save_report(error_result, error_report_path)
        
        logger.error(f"Error during processing: {str(e)}")
        logger.debug(f"Error details saved to {error_report_path}")
        return error_result

def process_directory(directory_path, output_dir=None, send_to_api=False):
    """
    디렉토리 내 모든 이미지 처리
    
    Args:
        directory_path: 이미지 디렉토리 경로
        output_dir: 결과물 저장 디렉토리 (None이면 기본값 사용)
        send_to_api: API 전송 여부
    
    Returns:
        list: 처리 결과 목록
    """
    results = []
    
    if not os.path.isdir(directory_path):
        logger.error(f"Error: {directory_path} is not a valid directory")
        return []
    
    logger.info(f"Processing directory: {directory_path}")
    
    # 디렉토리에서 이미지 파일 목록 가져오기
    image_files = get_image_files_in_directory(directory_path)
    
    if not image_files:
        logger.warning(f"No image files found in {directory_path}")
        return []
    
    logger.info(f"Found {len(image_files)} images to process")
    
    image_count = 0
    error_count = 0
    
    for file_path in image_files:
        image_count += 1
        logger.info(f"\nProcessing image {image_count}/{len(image_files)}: {Path(file_path).name}")
        
        result = process_image(file_path, output_dir, send_to_api)
        results.append(result)
        
        if "error" in result:
            error_count += 1
    
    logger.info(f"\nProcessing complete. Total: {image_count} images, Success: {image_count - error_count}, Errors: {error_count}")
    return results

def check_fastapi_server():
    """
    FastAPI 서버 연결 확인
    
    Returns:
        bool: 서버 연결 성공 여부
    """
    if not USE_FASTAPI:
        return False
    
    try:
        url = f"http://{FASTAPI_HOST}:{FASTAPI_PORT}/ping"
        response = requests.post(
            url, 
            json={"test": True, "timestamp": datetime.now().isoformat()},
            headers={"Authorization": f"Bearer {FASTAPI_API_KEY}"},
            timeout=5
        )
        return response.status_code == 200
    except Exception as e:
        logger.warning(f"FastAPI 서버 연결 확인 실패: {str(e)}")
        return False

def main():
    """
    메인 실행 함수
    """
    parser = argparse.ArgumentParser(description="Accessibility Analyzer")
    parser.add_argument("--image", type=str, help="Path to single image")
    parser.add_argument("--dir", type=str, help="Directory containing images")
    parser.add_argument("--output", type=str, help="Output directory")
    parser.add_argument("--api", action="store_true", help="Send results to API")
    parser.add_argument("--test", action="store_true", help="Test API connection")
    parser.add_argument("--check-server", action="store_true", help="Check FastAPI server connection")
    
    args = parser.parse_args()
    
    # FastAPI 서버 연결 확인
    if args.check_server:
        if check_fastapi_server():
            logger.info("FastAPI 서버 연결 성공!")
        else:
            logger.error("FastAPI 서버 연결 실패! 서버가 실행 중인지 확인하세요.")
        return
    
    # API 연결 테스트
    if args.test:
        logger.info("Testing API connection...")
        api_client = APIClient()
        if api_client.test_connection():
            logger.info("API connection successful!")
        else:
            logger.error("API connection failed!")
        return
    
    # 단일 이미지 처리
    if args.image:
        process_image(args.image, args.output, args.api)
    
    # 디렉토리 처리
    elif args.dir:
        process_directory(args.dir, args.output, args.api)
    
    # 인자 없을 경우 도움말 출력
    else:
        parser.print_help()
        logger.info("\nPlease specify --image or --dir")

if __name__ == "__main__":
    main()