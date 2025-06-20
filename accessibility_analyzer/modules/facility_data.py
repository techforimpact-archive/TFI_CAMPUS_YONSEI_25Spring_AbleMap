"""
장애인편의시설 데이터를 가져오는 모듈
"""
import requests
import xml.etree.ElementTree as ET
from urllib.parse import urlencode, quote_plus, unquote
import json
from typing import Dict, List, Optional, Tuple
import logging
import math

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FacilityData:
    """장애인편의시설 데이터를 가져오는 클래스"""
    
    def __init__(self):
        """초기화"""
        self.api_key = unquote("")
        self.base_url = ""
        self.session = requests.Session()
    
    def fetch_with_retry(self, url: str, params: Dict, max_retries: int = 3) -> Optional[requests.Response]:
        """API 요청을 재시도하며 수행"""
        for attempt in range(max_retries):
            try:
                logger.info(f"API 요청 시도 {attempt + 1}/{max_retries}")
                logger.info(f"요청 URL: {url}")
                logger.info(f"요청 파라미터: {params}")
                
                response = self.session.get(url, params=params)
                
                logger.info(f"응답 상태 코드: {response.status_code}")
                logger.info(f"응답 헤더: {dict(response.headers)}")
                logger.info(f"응답 내용: {response.text[:500]}")  # 처음 500자만 로깅
                
                if response.status_code == 200:
                    return response
                    
            except Exception as e:
                logger.error(f"API 요청 실패 (시도 {attempt + 1}/{max_retries}): {str(e)}")
                if attempt == max_retries - 1:
                    raise
                
        return None
    
    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """두 지점 간의 거리를 계산 (Haversine 공식)"""
        R = 6371  # 지구의 반경 (km)
        
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
    
    def find_nearest_facility(self, latitude: float, longitude: float, facilities: List[Dict]) -> Optional[Dict]:
        """가장 가까운 시설 찾기"""
        if not facilities:
            return None
            
        min_distance = float('inf')
        nearest_facility = None
        
        for facility in facilities:
            try:
                # wfcltId 필드 확인
                if 'wfcltId' not in facility or not facility['wfcltId']:
                    logger.warning(f"wfcltId 누락된 시설 발견: {facility.get('faclNm', '이름 없음')}")
                    continue
                
                fac_lat = float(facility.get('faclLat', 0))
                fac_lng = float(facility.get('faclLng', 0))
                
                if fac_lat == 0 or fac_lng == 0:
                    continue
                    
                distance = self.calculate_distance(latitude, longitude, fac_lat, fac_lng)
                
                if distance < min_distance:
                    min_distance = distance
                    nearest_facility = facility
                    
            except (ValueError, TypeError):
                continue
                
        return nearest_facility
    
    def get_facility_list(self, page_no: int = 1, num_of_rows: int = 100, address: str = None) -> List[Dict]:
        """장애인편의시설 목록을 가져옴"""
        url = f"{self.base_url}/getDisConvFaclList"
        params = {
            'serviceKey': self.api_key,
            'pageNo': str(page_no),
            'numOfRows': str(num_of_rows),
            'type': 'xml',
            'salStaDivCd': 'Y'  # 영업 중인 시설만 조회
        }
        
        # 주소가 있는 경우 지역 필터링
        if address:
            parts = address.split('_')
            if len(parts) >= 3:
                siDoNm = parts[0]
                cggNm = parts[1]
                loadNm = '_'.join(parts[2:])
                params['siDoNm'] = siDoNm
                params['cggNm'] = cggNm
                params['roadNm'] = loadNm.replace('_', ' ')
            elif len(parts) == 2:
                siDoNm, cggNm = parts
                params['siDoNm'] = siDoNm
                params['cggNm'] = cggNm
        else:
            logger.warning("주소 정보가 없으므로 모든 시설 데이터를 가져올 수 있습니다.")
        
        try:
            response = self.fetch_with_retry(url, params)
            if response is None:
                return []
            
            # XML 파싱
            root = ET.fromstring(response.content)
            
            # 오류 메시지 확인
            err_msg = root.find('.//errMsg')
            if err_msg is not None and err_msg.text == 'SERVICE ERROR':
                logger.error(f"API 오류 발생: {err_msg.text}")
                return []
            
            # 전체 데이터 수 확인
            total_count = int(root.find('.//totalCount').text)
            logger.info(f"전체 데이터 수: {total_count}")
            
            # 시설 정보 추출
            facilities = []
            for item in root.findall('.//servList'):
                facility = {}
                for child in item:
                    facility[child.tag] = child.text
                
                # wfcltId 필드 확인 및 로깅
                if 'wfcltId' not in facility or not facility['wfcltId']:
                    logger.warning(f"wfcltId 누락된 시설 발견: {facility.get('faclNm', '이름 없음')}")
                    continue
                
                # 시설 정보 로깅
                logger.info(f"시설 정보: {facility.get('faclNm', 'N/A')} - {facility.get('lcMnad', 'N/A')}")
                    
                facilities.append(facility)
            
            logger.info(f"검색된 시설 수: {len(facilities)}")
            return facilities
            
        except Exception as e:
            logger.error(f"시설 목록 조회 실패: {str(e)}")
            return []
    
    def get_facility_detail(self, wfclt_id: str) -> Optional[Dict]:
        """장애인편의시설 상세 정보를 가져옴"""
        if not wfclt_id:
            logger.error("wfcltId가 제공되지 않았습니다.")
            return None
            
        url = f"{self.base_url}/getFacInfoOpenApiJpEvalInfoList"
        params = {
            'serviceKey': self.api_key,
            'wfcltId': wfclt_id,
            'type': 'xml'
        }
        
        try:
            response = self.fetch_with_retry(url, params)
            if response is None:
                return None
            
            # XML 파싱
            root = ET.fromstring(response.content)
            
            # 오류 메시지 확인
            err_msg = root.find('.//errMsg')
            if err_msg is not None and err_msg.text == 'SERVICE ERROR':
                logger.error(f"API 오류 발생: {err_msg.text}")
                return None
            
            # 시설 정보 추출
            item = root.find('.//servList')
            if item is None:
                return None
                
            facility = {}
            for child in item:
                facility[child.tag] = child.text
            
            return facility
            
        except Exception as e:
            logger.error(f"시설 상세 정보 조회 실패: {str(e)}")
            return None
    
    def get_facility_info(self, location_info: Dict) -> Dict:
        """장애인편의시설의 기본 정보와 상세 정보를 가져옴"""
        if not location_info:
            return {
                "available": False,
                "message": "위치 정보가 제공되지 않았습니다."
            }
            
        # location_info가 문자열인 경우 (이미지 파일명)
        if isinstance(location_info, str):
            parts = location_info.split('_')
            if len(parts) >= 3:
                siDoNm = parts[0]
                cggNm = parts[1]
                roadNm = '_'.join(parts[2:])
                
                # 시설 목록 조회
                all_facilities = []
                for page in range(1, 4):  # 처음 3페이지 조회
                    facilities = self.get_facility_list(page_no=page, num_of_rows=100, address=location_info)
                    if not facilities:
                        break
                    all_facilities.extend(facilities)
                
                if all_facilities:
                    facility_info = all_facilities[0]  # 첫 번째 일치하는 시설 선택
                    facility_detail = self.get_facility_detail(facility_info.get('wfcltId'))
                else:
                    facility_info = None
                    facility_detail = None
            else:
                return {
                    "available": False,
                    "message": "잘못된 주소 형식입니다."
                }
            
        # location_info가 딕셔너리인 경우
        elif isinstance(location_info, dict):
            # wfcltId가 있는 경우
            if 'wfcltId' in location_info:
                wfclt_id = location_info['wfcltId']
                facilities = self.get_facility_list()
                facility_info = next((f for f in facilities if f.get('wfcltId') == wfclt_id), None)
                facility_detail = self.get_facility_detail(wfclt_id)
                
            # 위도/경도가 있는 경우
            elif 'latitude' in location_info and 'longitude' in location_info and location_info['latitude'] is not None and location_info['longitude'] is not None:
                try:
                    latitude = float(location_info['latitude'])
                    longitude = float(location_info['longitude'])
                    address = location_info.get('address', '')
                    
                    # 시설 목록 조회 (더 많은 결과를 가져오기 위해 여러 페이지 조회)
                    all_facilities = []
                    for page in range(1, 4):  # 처음 3페이지 조회
                        facilities = self.get_facility_list(page_no=page, num_of_rows=100, address=address)
                        if not facilities:
                            break
                        all_facilities.extend(facilities)
                    
                    # 가장 가까운 시설 찾기
                    facility_info = self.find_nearest_facility(latitude, longitude, all_facilities)
                    
                    if facility_info:
                        facility_detail = self.get_facility_detail(facility_info.get('wfcltId'))
                    else:
                        facility_detail = None
                        
                except (ValueError, TypeError) as e:
                    logger.error(f"위도/경도 변환 실패: {str(e)}")
                    return {
                        "available": False,
                        "message": "잘못된 위도/경도 정보입니다."
                    }
            # 시도명과 시군구명이 있는 경우
            elif 'siDoNm' in location_info and 'cggNm' in location_info:
                siDoNm = location_info['siDoNm']
                cggNm = location_info['cggNm']
                roadNm = location_info.get('roadNm', '')  # faclNm 대신 roadNm 사용
                
                # 시설 목록 조회
                all_facilities = []
                for page in range(1, 4):  # 처음 3페이지 조회
                    facilities = self.get_facility_list(page_no=page, num_of_rows=100, address=f"{siDoNm}_{cggNm}_{roadNm}")
                    if not facilities:
                        break
                    all_facilities.extend(facilities)
                
                if all_facilities:
                    facility_info = all_facilities[0]  # 첫 번째 일치하는 시설 선택
                    facility_detail = self.get_facility_detail(facility_info.get('wfcltId'))
                else:
                    facility_info = None
                    facility_detail = None
            else:
                return {
                    "available": False,
                    "message": "유효한 위치 정보가 없습니다."
                }
        else:
            return {
                "available": False,
                "message": "지원하지 않는 위치 정보 형식입니다."
            }
        
        # 결과 구성
        result = {
            "available": True,
            "basic_info": facility_info,
            "facility_features": {
                "evalInfo": facility_detail.get('evalInfo', '').split(', ') if facility_detail and 'evalInfo' in facility_detail else []
            },
            "accessibility_details": {
                "entrance": {
                    "accessible": any('주출입구' in feature for feature in (facility_detail.get('evalInfo', '').split(', ') if facility_detail and 'evalInfo' in facility_detail else [])),
                    "features": [feature for feature in (facility_detail.get('evalInfo', '').split(', ') if facility_detail and 'evalInfo' in facility_detail else []) if '주출입구' in feature]
                },
                "parking": {
                    "available": any('주차' in feature for feature in (facility_detail.get('evalInfo', '').split(', ') if facility_detail and 'evalInfo' in facility_detail else [])),
                    "features": [feature for feature in (facility_detail.get('evalInfo', '').split(', ') if facility_detail and 'evalInfo' in facility_detail else []) if '주차' in feature]
                },
                "restroom": {
                    "available": any('화장실' in feature for feature in (facility_detail.get('evalInfo', '').split(', ') if facility_detail and 'evalInfo' in facility_detail else [])),
                    "features": [feature for feature in (facility_detail.get('evalInfo', '').split(', ') if facility_detail and 'evalInfo' in facility_detail else []) if '화장실' in feature]
                },
                "elevator": {
                    "available": any('엘리베이터' in feature for feature in (facility_detail.get('evalInfo', '').split(', ') if facility_detail and 'evalInfo' in facility_detail else []))
                }
            }
        }
        
        if not facility_info and not facility_detail:
            result["available"] = False
            result["message"] = "시설 정보를 찾을 수 없습니다."
            
        return result