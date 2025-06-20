"""
LLM API와 통신하는 모듈 - 한국어 응답 버전
"""
import requests
import json
import base64
import time
import mimetypes
import io
import cv2
import numpy as np
from datetime import datetime
from PIL import Image
from typing import Dict, List, Tuple, Optional
from config import LLM_API_KEY, API_MAX_RETRIES

# 타임아웃 값을 직접 정의
API_REQUEST_TIMEOUT = 120  # 120초로 설정

class StairDetectionValidator:
    """계단 검출 검증 및 개선 클래스"""
    
    @staticmethod
    def validate_stair_segments(image_path: str, stair_segments: List[Dict], 
                              min_area_threshold: int = 500, 
                              aspect_ratio_range: Tuple[float, float] = (0.2, 5.0),
                              edge_density_threshold: float = 0.1) -> Dict:
        """
        segmentation 결과에서 실제 계단인지 검증
        
        Args:
            image_path: 원본 이미지 경로
            stair_segments: segmentation된 계단 영역들
            min_area_threshold: 최소 영역 크기 (픽셀)
            aspect_ratio_range: 가로세로 비율 범위
            edge_density_threshold: 엣지 밀도 임계값
            
        Returns:
            Dict: 검증된 계단 정보
        """
        try:
            # 이미지 로드
            image = cv2.imread(image_path)
            if image is None:
                return {"valid_stairs": [], "total_segments": len(stair_segments)}
            
            height, width = image.shape[:2]
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            valid_stairs = []
            validation_details = []
            
            for i, segment in enumerate(stair_segments):
                validation_result = StairDetectionValidator._validate_single_segment(
                    gray, segment, width, height, min_area_threshold, 
                    aspect_ratio_range, edge_density_threshold
                )
                
                validation_details.append(validation_result)
                if validation_result['is_valid']:
                    valid_stairs.append(segment)
            
            # 인접한 계단 세그먼트 그룹화
            grouped_stairs = StairDetectionValidator._group_adjacent_stairs(valid_stairs)
            
            return {
                "valid_stairs": grouped_stairs,
                "total_segments": len(stair_segments),
                "filtered_count": len(valid_stairs),
                "final_stair_groups": len(grouped_stairs),
                "validation_details": validation_details,
                "confidence_score": StairDetectionValidator._calculate_confidence(
                    grouped_stairs, validation_details
                )
            }
            
        except Exception as e:
            return {"error": f"계단 검증 중 오류: {str(e)}"}
    
    @staticmethod
    def _validate_single_segment(gray_image, segment, img_width, img_height,
                               min_area, aspect_ratio_range, edge_threshold):
        """단일 세그먼트 검증"""
        try:
            # 세그먼트 정보 추출
            x, y, w, h = segment.get('bbox', [0, 0, 1, 1])
            area = w * h
            
            validation = {
                'segment_id': segment.get('id', 0),
                'area': area,
                'is_valid': False,
                'rejection_reasons': []
            }
            
            # 1. 최소 크기 검사
            if area < min_area:
                validation['rejection_reasons'].append('area_too_small')
                return validation
            
            # 2. 가로세로 비율 검사
            aspect_ratio = w / h if h > 0 else float('inf')
            if not (aspect_ratio_range[0] <= aspect_ratio <= aspect_ratio_range[1]):
                validation['rejection_reasons'].append('invalid_aspect_ratio')
                return validation
            
            # 3. 이미지 경계 근처 노이즈 필터링
            margin = min(img_width, img_height) * 0.05  # 이미지 크기의 5%
            if (x < margin or y < margin or 
                x + w > img_width - margin or y + h > img_height - margin):
                # 경계 근처이면서 작은 세그먼트는 노이즈일 가능성 높음
                if area < min_area * 2:
                    validation['rejection_reasons'].append('edge_noise')
                    return validation
            
            # 4. 엣지 밀도 검사 (계단의 특징적인 수평선 확인)
            roi = gray_image[int(y):int(y+h), int(x):int(x+w)]
            if roi.size > 0:
                # Sobel 필터로 수평 엣지 검출
                sobel_x = cv2.Sobel(roi, cv2.CV_64F, 1, 0, ksize=3)
                sobel_y = cv2.Sobel(roi, cv2.CV_64F, 0, 1, ksize=3)
                
                # 수평 엣지가 더 강한지 확인 (계단의 특징)
                horizontal_edges = np.mean(np.abs(sobel_y))
                vertical_edges = np.mean(np.abs(sobel_x))
                
                edge_ratio = horizontal_edges / (vertical_edges + 1e-6)
                validation['edge_ratio'] = edge_ratio
                
                if edge_ratio < 1.2:  # 수평 엣지가 충분히 강하지 않음
                    validation['rejection_reasons'].append('insufficient_horizontal_edges')
                    return validation
            
            # 5. 위치 기반 검증 (건물 입구 근처에 있는지)
            center_y = y + h/2
            # 이미지 하단 70% 영역에 있는 계단만 유효한 것으로 간주
            if center_y < img_height * 0.3:
                validation['rejection_reasons'].append('wrong_position')
                return validation
            
            validation['is_valid'] = True
            return validation
            
        except Exception as e:
            return {
                'segment_id': segment.get('id', 0),
                'is_valid': False,
                'rejection_reasons': ['validation_error'],
                'error': str(e)
            }
    
    @staticmethod
    def _group_adjacent_stairs(stair_segments, distance_threshold=50):
        """인접한 계단 세그먼트들을 그룹화"""
        if not stair_segments:
            return []
        
        groups = []
        used = [False] * len(stair_segments)
        
        for i, segment in enumerate(stair_segments):
            if used[i]:
                continue
                
            group = [segment]
            used[i] = True
            
            # 인접한 세그먼트 찾기
            for j, other_segment in enumerate(stair_segments):
                if used[j] or i == j:
                    continue
                
                # 거리 계산
                dist = StairDetectionValidator._calculate_distance(segment, other_segment)
                if dist < distance_threshold:
                    group.append(other_segment)
                    used[j] = True
            
            groups.append(group)
        
        return groups
    
    @staticmethod
    def _calculate_distance(seg1, seg2):
        """두 세그먼트 간의 거리 계산"""
        x1, y1, w1, h1 = seg1.get('bbox', [0, 0, 1, 1])
        x2, y2, w2, h2 = seg2.get('bbox', [0, 0, 1, 1])
        
        center1 = (x1 + w1/2, y1 + h1/2)
        center2 = (x2 + w2/2, y2 + h2/2)
        
        return np.sqrt((center1[0] - center2[0])**2 + (center1[1] - center2[1])**2)
    
    @staticmethod
    def _calculate_confidence(stair_groups, validation_details):
        """검출 신뢰도 계산"""
        if not validation_details:
            return 0.0
        
        valid_count = sum(1 for detail in validation_details if detail['is_valid'])
        total_count = len(validation_details)
        
        base_confidence = valid_count / total_count if total_count > 0 else 0
        
        # 그룹화된 계단의 수에 따른 신뢰도 조정
        if len(stair_groups) == 1:
            return min(base_confidence + 0.2, 1.0)  # 단일 계단군은 신뢰도 증가
        elif len(stair_groups) > 3:
            return max(base_confidence - 0.1, 0.0)  # 너무 많은 계단군은 노이즈 가능성
        
        return base_confidence


class LLMAnalyzer:
    def __init__(self, api_key=LLM_API_KEY):
        """
        LLM 분석기 초기화
        """
        self.api_key = api_key
        self.api_url = ""
        self.model = ""  # 원래 모델 유지
        self.stair_validator = StairDetectionValidator()

    
    def create_prompt(self, accessibility_info, facility_info=None, stair_validation=None):
        """
        LLM에 전달할 프롬프트 생성

        Args:
            accessibility_info: 접근성 분석 정보
            facility_info: 장애인편의시설 정보 (선택적)
            stair_validation: 개선된 계단 검증 결과

        Returns:
            str: 프롬프트 문자열
        """
        prompt = f"""
    다음은 건물 외부 접근성 분석 결과입니다:

    기본 접근성 정보:
    - 계단 존재 여부: {accessibility_info.get('has_stairs', False)}
    - 계단 심각도: {accessibility_info.get('stair_severity', 'none')}
    - 경사로 존재 여부: {accessibility_info.get('has_ramp', False)}
    - 입구 접근 가능 여부: {accessibility_info.get('entrance_accessible', True)}
    - 감지된 장애물: {', '.join(accessibility_info.get('obstacles', [])) if accessibility_info.get('obstacles') else '없음'}
    - 추가 장애물: {', '.join(accessibility_info.get('additional_obstacles', [])) if accessibility_info.get('additional_obstacles') else '없음'}
    - 보도 존재 여부: {accessibility_info.get('has_sidewalk', False)}
    """

        # 개선된 계단 검증 결과 포함
        if stair_validation:
            prompt += f"""
    개선된 계단 분석 결과:
    - 총 검출된 세그먼트 수: {stair_validation.get('total_segments', 0)}
    - 검증 통과한 계단 수: {stair_validation.get('filtered_count', 0)}
    - 최종 계단 그룹 수: {stair_validation.get('final_stair_groups', 0)}
    - 검출 신뢰도: {stair_validation.get('confidence_score', 0):.2f}

    ※ 이 결과는 다음 기준으로 노이즈를 필터링한 개선된 분석입니다:
    - 픽셀 크기 (500픽셀 이상)
    - 가로세로 비율 (0.2~5.0 범위)
    - 엣지 밀도 (수평 엣지 우세성)
    - 위치 검증 (이미지 하단 70% 영역)
    - 경계부 노이즈 제거 (이미지 경계 5% 마진)
    """
            
            # 검증 세부사항 추가
            if stair_validation.get('validation_details'):
                rejected_reasons = {}
                for detail in stair_validation['validation_details']:
                    if not detail['is_valid']:
                        for reason in detail.get('rejection_reasons', []):
                            rejected_reasons[reason] = rejected_reasons.get(reason, 0) + 1
                
                if rejected_reasons:
                    prompt += "\n필터링된 노이즈 유형:\n"
                    reason_names = {
                        'area_too_small': '픽셀 크기 부족',
                        'invalid_aspect_ratio': '부적절한 가로세로 비율',
                        'edge_noise': '경계부 노이즈',
                        'insufficient_horizontal_edges': '수평 엣지 부족',
                        'wrong_position': '부적절한 위치'
                    }
                    for reason, count in rejected_reasons.items():
                        prompt += f"- {reason_names.get(reason, reason)}: {count}개\n"

        # 세부 장애물 정보 포함
        if 'obstacle_details' in accessibility_info:
            prompt += "\n세부 장애물 정보:\n"
            for obj, details in accessibility_info['obstacle_details'].items():
                prompt += f"- {obj}: {json.dumps(details, ensure_ascii=False)}\n"

        # 신뢰도 정보 추가
        if accessibility_info.get('confidence_scores'):
            prompt += f"\n검출 신뢰도 정보:\n"
            for detection_type, confidence in accessibility_info['confidence_scores'].items():
                if detection_type != 'overall_reliability':
                    prompt += f"- {detection_type}: {confidence:.2f}\n"
            prompt += f"- 전체 신뢰도: {accessibility_info['confidence_scores'].get('overall_reliability', 'medium')}\n"

        # 외부 접근성 점수 추가
        if 'accessibility_score' in accessibility_info:
            prompt += f"\n기본 외부 접근성 점수: {accessibility_info['accessibility_score']}/10\n"

        # 공공데이터 기반 장애인편의시설 정보가 있는 경우
        if facility_info and facility_info.get("available", False):
            prompt += "\n장애인편의시설 공공데이터 정보:\n"

            # 기본 정보
            if facility_info.get("basic_info"):
                basic = facility_info["basic_info"]
                prompt += f"- 시설명: {basic.get('faclNm', '정보 없음')}\n"
                prompt += f"- 주소: {basic.get('lcMnad', '정보 없음')}\n"
                prompt += f"- 설립일: {basic.get('estbDate', '정보 없음')}\n"

            # 기능 정보
            if facility_info.get("facility_features") and facility_info["facility_features"].get("evalInfo"):
                prompt += "\n시설 기능:\n"
                for feat in facility_info["facility_features"]["evalInfo"]:
                    prompt += f"- {feat}\n"

            # 접근성 세부 정보
            if facility_info.get("accessibility_details"):
                details = facility_info["accessibility_details"]
                if details.get("entrance"):
                    prompt += f"\n입구 접근성: {'접근 가능' if details['entrance'].get('accessible', False) else '제한됨'}\n"
                    prompt += "입구 특징: " + ", ".join(details["entrance"].get("features", [])) + "\n"
                if details.get("parking"):
                    prompt += f"장애인 주차: {'있음' if details['parking'].get('available', False) else '없음'}\n"
                    prompt += "주차 특징: " + ", ".join(details["parking"].get("features", [])) + "\n"
                if details.get("restroom"):
                    prompt += f"장애인 화장실: {'있음' if details['restroom'].get('available', False) else '없음'}\n"
                    prompt += "화장실 특징: " + ", ".join(details["restroom"].get("features", [])) + "\n"
                if details.get("elevator"):
                    prompt += f"엘리베이터: {'있음' if details['elevator'].get('available', False) else '없음 또는 정보 없음'}\n"

            # 공공데이터가 있는 경우 기존 점수 체계 유지
            prompt += """

    내부 접근성 점수 (internal_accessibility_score)는 아래 항목 기반으로 총 10점 만점으로 산정해주세요:

    [주출입구 관련 총 3점]
    - 주출입구 접근로: 1점
    - 주출입구 높이차이 제거: 1점
    - 주출입구(문): 1점

    [장애인 화장실 관련 총 2점]
    - 장애인사용가능화장실: 2점

    [엘리베이터 관련 총 2점]
    - 승강기: 2점

    [기타 항목 총 3점]
    - 장애인전용주차구역: 1점
    - 장애인사용가능객실: 1점
    - 유도 및 안내 설비: 1점

    최종 접근성 점수 (final_accessibility_score) 계산:
    - 외부 접근성 점수 (external_accessibility_score): 40%
    - 내부 접근성 점수 (internal_accessibility_score): 60%
    """
        else:
            # 공공데이터가 없는 경우 - 동행인 고려 점수 체계
            prompt += """

    공공데이터 정보가 없으므로, 이미지를 기반으로 휠체어 사용자의 건물 접근성을 **동행인 유무에 따라 구분**하여 평가해주세요.

    ## 점수 체계 (각각 10점 만점)

    ### 1. 독립 접근 점수 (independent_access_score)
    휠체어 사용자가 **혼자서** 접근할 수 있는 정도를 평가:

    [계단 영향도 - 감점 기준]
    - 심각(severe): -6점 (5단 이상, 혼자 불가능)
    - 중간(moderate): -4점 (3-4단, 매우 어려움)  
    - 경미(mild): -2점 (1-2단, 어렵지만 가능할 수 있음)

    [추가 장애물 영향도]
    - 고정 장애물(pole, barrier 등): 각 -1점
    - 이동 가능 장애물(car, chair 등): 각 -0.5점
    - 임시 장애물(person 등): 각 -0.2점

    [기본 접근성 요소]
    - 출입구까지의 경로 평탄성: 2점
    - 출입구 문의 너비 및 접근성: 2점
    - 보도 연결성: 1점
    - 회전 공간 충분성: 1점

    ### 2. 동행 지원 접근 점수 (assisted_access_score)  
    휠체어 사용자가 **동행인과 함께** 접근할 수 있는 정도를 평가:

    [계단 영향도 - 감점 기준 (완화)]
    - 심각(severe): -3점 (여전히 어려우나 2-3명 도움시 가능)
    - 중간(moderate): -1점 (1-2명 도움으로 접근 가능)
    - 경미(mild): -0.5점 (1명 도움으로 쉽게 접근)

    [추가 장애물 영향도 (완화)]
    - 고정 장애물: 각 -0.5점
    - 이동 가능 장애물: 각 -0.2점
    - 임시 장애물: 각 -0.1점

    [기본 접근성 요소는 동일]

    ### 3. 권장 점수 (recommended_access_score)
    일반적으로 권장하는 접근 방법의 점수 (독립 또는 동행 중 더 현실적인 방법)

    최종 접근성 점수는 권장 점수를 사용:
    - final_accessibility_score = recommended_access_score
    """

        # 계단 분석 가이드
        prompt += """

    === 계단 분석 가이드 ===

    계단 개수 및 접근성 평가 시 다음 우선순위를 따라주세요:

    1. **검출 신뢰도가 0.7 이상인 경우**: 
    - 개선된 계단 분석 결과를 우선 적용
    - 최종 계단 그룹 수를 기준으로 계단 개수 산정

    2. **검출 신뢰도가 0.4~0.7인 경우**: 
    - 개선된 분석 결과와 이미지 전체 맥락을 종합 판단
    - 건물 구조와 일치하는지 검토

    3. **검출 신뢰도가 0.4 미만인 경우**: 
    - 이미지 전체적인 맥락을 우선 고려
    - 개선된 분석 결과는 참고용으로만 활용

    === 신뢰도 기반 점수 조정 ===

    검출 신뢰도를 고려하여 점수를 조정해주세요:
    - 높은 신뢰도 (0.8 이상): 검출 결과를 그대로 적용
    - 중간 신뢰도 (0.5-0.8): 보수적으로 평가하되 일반적 건물 기준 고려
    - 낮은 신뢰도 (0.5 미만): 이미지에서 명확히 보이는 요소만 평가하고 나머지는 중립적 점수 적용
    """

        prompt += """

    다음 JSON 형식으로 결과를 한국어로 제공해주세요:

    {"""
        
        # facility_info 유무에 따라 다른 JSON 구조
        if facility_info and facility_info.get("available", False):
            prompt += '''
    "external_accessibility_score": 1-10,
    "internal_accessibility_score": 1-10,
    "final_accessibility_score": 1-10,'''
        else:
            prompt += '''
    "independent_access_score": 1-10,
    "assisted_access_score": 1-10,
    "recommended_access_score": 1-10,
    "final_accessibility_score": 1-10,
    "access_recommendation": "independent" 또는 "assisted" 또는 "alternative_required",'''
        
        prompt += '''
    "stairs_count": 추정 계단 수,
    "stairs_height": "추정 높이 설명",
    "stair_severity_assessment": "계단 심각도 상세 분석",
    "stair_detection_confidence": "높음/보통/낮음",
    "additional_obstacles_impact": ["장애물별 영향도 분석"],
    "confidence_level": "high/medium/low",
    "alternative_route": true/false,
    "alternative_route_description": "설명",'''

        if not (facility_info and facility_info.get("available", False)):
            prompt += '''
    "recommendations": {
        "for_independent": ["혼자 접근시 권장사항"],
        "for_assisted": ["동행시 권장사항"], 
        "facility_improvements": ["시설 개선 권장사항"]
    },'''
        else:
            prompt += '''
    "recommendations": ["조언1", ...],'''
        
        prompt += '''
    "observations": ["관찰1", ...],
    "noise_filtering_summary": "노이즈 필터링 결과 요약"'''
        
        if not (facility_info and facility_info.get("available", False)):
            prompt += ''',
    "analysis_mode": "image_only_with_assistance_levels"'''
        
        prompt += '''
    }
    '''

        return prompt

    
    def analyze_image(self, image_path, overlay_path, accessibility_info, facility_info=None, stair_segments=None):
        """
        이미지와 접근성 정보를 LLM으로 분석 (계단 검증 기능 추가)
        
        Args:
            image_path: 원본 이미지 경로
            overlay_path: 오버레이 이미지 경로
            accessibility_info: 접근성 분석 정보
            facility_info: 장애인편의시설 정보 (기존 파일에서 전달받음)
            stair_segments: segmentation된 계단 정보 (선택적)
            
        Returns:
            dict: LLM 분석 결과
        """
        # 계단 검증 수행
        stair_validation = None
        if stair_segments:
            print("계단 세그먼트 검증 중...")
            stair_validation = self.stair_validator.validate_stair_segments(
                image_path, stair_segments
            )
            
            # 검증 결과를 accessibility_info에 반영
            if stair_validation.get('final_stair_groups', 0) == 0:
                accessibility_info['has_stairs'] = False
                print("검증 결과: 유효한 계단 없음")
            else:
                accessibility_info['has_stairs'] = True
                print(f"검증 결과: {stair_validation.get('final_stair_groups', 0)}개 계단 그룹 검출")
                print(f"신뢰도: {stair_validation.get('confidence_score', 0):.2f}")
        
        prompt = self.create_prompt(accessibility_info, facility_info, stair_validation)
        
        # 이미지 인코딩 (최적화 함수 사용)
        original_image_b64, original_mime = self.optimize_image_for_api(image_path)
        overlay_image_b64, overlay_mime = self.optimize_image_for_api(overlay_path)
        
        if not original_image_b64 or not overlay_image_b64:
            return {"error": "이미지 인코딩 실패"}
            
        # API 요청 준비
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01"
        }
        
        data = {
            "model": self.model,
            "max_tokens": 2048,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": original_mime,
                                "data": original_image_b64
                            }
                        },
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": overlay_mime,
                                "data": overlay_image_b64
                            }
                        }
                    ]
                }
            ],
            "system": "당신은 한국의 장애인 접근성 평가 전문가입니다. 제시된 평가 기준에 따라 이미지와 데이터를 바탕으로 정확하고 객관적인 접근성 점수를 산정합니다. 특히 개선된 계단 검출 결과를 활용하여 노이즈를 필터링하고 실제 접근성에 영향을 미치는 요소들을 정확히 평가해주세요. 모든 응답은 반드시 한국어로 제공해야 합니다."
        }
        
        try:
            # 재시도 메커니즘 적용
            retries = 0
            while retries < API_MAX_RETRIES:
                try:
                    print(f"개선된 API 요청 시도 중... (타임아웃: {API_REQUEST_TIMEOUT}초)")
                    start_time = time.time()
                    response = requests.post(self.api_url, headers=headers, json=data, timeout=API_REQUEST_TIMEOUT)
                    response.raise_for_status()
                    result = response.json()
                    end_time = time.time()
                    print(f"API 요청 완료: {end_time - start_time:.2f}초 소요")
                    
                    # 분석 결과에 검증 정보 추가
                    parsed_result = self._parse_llm_response(result["content"][0]["text"])
                    if stair_validation:
                        parsed_result['stair_validation_details'] = stair_validation
                    
                    return parsed_result
                    
                except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                    retries += 1
                    print(f"API 요청 실패 ({e}), 재시도 {retries}/{API_MAX_RETRIES}")
                    if retries == API_MAX_RETRIES:
                        return {"error": f"최대 재시도 횟수 초과: {str(e)}"}
                    # 재시도 간격 증가 (지수 백오프)
                    wait_time = 2 ** retries
                    print(f"{wait_time}초 후 재시도합니다...")
                    time.sleep(wait_time)
                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 429:  # 요청 한도 초과
                        retries += 1
                        wait_time = int(e.response.headers.get('Retry-After', 60))
                        print(f"API 요청 제한 초과, {wait_time}초 후 재시도 {retries}/{API_MAX_RETRIES}")
                        if retries == API_MAX_RETRIES:
                            return {"error": "API 요청 제한 초과"}
                        time.sleep(wait_time)
                    else:
                        print(f"API 응답 내용: {e.response.text}")  # 디버깅을 위해 응답 내용 출력
                        return {"error": f"HTTP 오류: {e.response.status_code} - {str(e)}"}
                except Exception as e:
                    print(f"예상치 못한 오류: {str(e)}")
                    return {"error": f"API 요청 중 오류 발생: {str(e)}"}
        except Exception as e:
            return {"error": f"분석 처리 중 오류: {str(e)}"}

    
    # 이미지 최적화 및 인코딩 함수는 원래 코드와 동일하게 유지
    def optimize_image_for_api(self, image_path, max_size=(1024, 1024)):
        """
        API 전송용으로 이미지 크기 최적화
        
        Args:
            image_path: 이미지 파일 경로
            max_size: 최대 이미지 크기 (가로, 세로)
            
        Returns:
            tuple: (base64로 인코딩된 이미지, MIME 타입)
        """
        try:
            # MIME 타입 감지
            mime_type, _ = mimetypes.guess_type(image_path)
            if not mime_type or not mime_type.startswith('image/'):
                mime_type = 'image/jpeg'  # 기본값으로 jpeg 사용
            
            # 이미지 로드 및 크기 최적화
            img = Image.open(image_path)
            img.thumbnail(max_size, Image.LANCZOS)
            
            # 메모리에 이미지 저장
            buffer = io.BytesIO()
            img_format = 'JPEG' if mime_type == 'image/jpeg' else 'PNG'
            img.save(buffer, format=img_format)
            buffer.seek(0)
            
            return base64.b64encode(buffer.read()).decode('utf-8'), mime_type
        except Exception as e:
            print(f"이미지 최적화 오류: {str(e)}")
            # 오류 시 기존 방식으로 인코딩
            return self.encode_image_to_base64(image_path)
    
    def encode_image_to_base64(self, image_path):
        """
        이미지를 base64로 인코딩하고 MIME 타입 반환
        
        Args:
            image_path: 이미지 파일 경로
            
        Returns:
            tuple: (base64로 인코딩된 이미지, MIME 타입)
        """
        try:
            # MIME 타입 감지
            mime_type, _ = mimetypes.guess_type(image_path)
            if not mime_type or not mime_type.startswith('image/'):
                mime_type = 'image/jpeg'  # 기본값으로 jpeg 사용
            
            with open(image_path, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode('utf-8'), mime_type
        except Exception as e:
            print(f"이미지 인코딩 오류: {str(e)}")
            return None, None
    
    def _parse_llm_response(self, response_text):
        """
        LLM 응답에서 JSON 파싱
        
        Args:
            response_text: LLM 응답 텍스트
            
        Returns:
            dict: 파싱된 JSON 데이터
        """
        try:
            # JSON 형식 텍스트 추출
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                return json.loads(json_str)
            else:
                # JSON을 찾을 수 없는 경우 텍스트 그대로 반환
                return {"text_response": response_text.strip()}
        except json.JSONDecodeError:
            # JSON 파싱 실패 시 텍스트 그대로 반환
            return {"text_response": response_text.strip()}
        

    def _validate_and_normalize_data(self, data):
        """
        파싱된 데이터 검증 및 정규화
        
        Args:
            data: 파싱된 원시 데이터
            
        Returns:
            dict: 검증 및 정규화된 데이터
        """
        try:
            # 점수 범위 검증 (1-10)
            score_fields = ['external_accessibility_score', 'internal_accessibility_score', 'final_accessibility_score']
            for field in score_fields:
                if field in data:
                    score = data[field]
                    if isinstance(score, (int, float)):
                        data[field] = max(1, min(10, int(round(score))))
                    else:
                        data[field] = 5  # 기본값
            
            # 계단 관련 정보 정규화
            if 'stairs_count' in data:
                stairs_count = data['stairs_count']
                if isinstance(stairs_count, str):
                    if '없음' in stairs_count or '0' in stairs_count:
                        data['stairs_count'] = 0
                    else:
                        # 문자열에서 숫자 추출 시도
                        import re
                        numbers = re.findall(r'\d+', stairs_count)
                        data['stairs_count'] = int(numbers[0]) if numbers else 0
                elif isinstance(stairs_count, (int, float)):
                    data['stairs_count'] = max(0, int(stairs_count))
                else:
                    data['stairs_count'] = 0
            
            # 신뢰도 정규화
            if 'stair_detection_confidence' in data:
                confidence = data['stair_detection_confidence'].lower()
                if confidence not in ['높음', '보통', '낮음']:
                    if 'high' in confidence or '높' in confidence:
                        data['stair_detection_confidence'] = '높음'
                    elif 'low' in confidence or '낮' in confidence:
                        data['stair_detection_confidence'] = '낮음'
                    else:
                        data['stair_detection_confidence'] = '보통'
            
            # 불린 값 정규화
            if 'alternative_route' in data:
                alt_route = data['alternative_route']
                if isinstance(alt_route, str):
                    data['alternative_route'] = alt_route.lower() in ['true', '있음', '가능', 'yes']
                elif not isinstance(alt_route, bool):
                    data['alternative_route'] = False
            
            # 리스트 타입 검증
            list_fields = ['recommendations', 'observations']
            for field in list_fields:
                if field in data:
                    if not isinstance(data[field], list):
                        data[field] = []
                else:
                    data[field] = []
            
            # 필수 필드 기본값 설정
            defaults = {
                'external_accessibility_score': 5,
                'internal_accessibility_score': 5,
                'final_accessibility_score': 5,
                'stairs_count': 0,
                'stairs_height': '정보 없음',
                'stair_detection_confidence': '보통',
                'alternative_route': False,
                'alternative_route_description': '정보 없음',
                'recommendations': [],
                'observations': [],
                'noise_filtering_summary': '필터링 정보 없음'
            }
            
            for key, default_value in defaults.items():
                if key not in data:
                    data[key] = default_value
            
            return data
            
        except Exception as e:
            print(f"데이터 검증 중 오류: {str(e)}")
            # 오류 발생 시 기본 구조 반환
            return {
                'external_accessibility_score': 5,
                'internal_accessibility_score': 5,
                'final_accessibility_score': 5,
                'stairs_count': 0,
                'stairs_height': '분석 오류',
                'stair_detection_confidence': '낮음',
                'alternative_route': False,
                'alternative_route_description': '분석 오류',
                'recommendations': ['분석 중 오류가 발생했습니다.'],
                'observations': ['데이터 검증 실패'],
                'noise_filtering_summary': '검증 오류',
                'error': f'데이터 검증 오류: {str(e)}'
            }

    # 사용 편의를 위한 유틸리티 함수들
    def analyze_with_stair_validation(image_path, overlay_path, segmentation_results, 
                                    facility_info=None, api_key=LLM_API_KEY):
        """
        계단 검증 기능이 포함된 접근성 분석 실행
        
        Args:
            image_path: 원본 이미지 경로
            overlay_path: 세그멘테이션 오버레이 이미지 경로
            segmentation_results: 기존 세그멘테이션 결과
            facility_info: 기존 파일에서 가져온 장애인편의시설 정보
            api_key: Claude API 키
            
        Returns:
            dict: 분석 결과
        """
        analyzer = LLMAnalyzer(api_key)
        
        # 기본 접근성 정보 구성
        accessibility_info = {
            'has_stairs': segmentation_results.get('has_stairs', False),
            'has_ramp': segmentation_results.get('has_ramp', False),
            'entrance_accessible': segmentation_results.get('entrance_accessible', True),
            'obstacles': segmentation_results.get('obstacles', []),
            'has_sidewalk': segmentation_results.get('has_sidewalk', False),
            'accessibility_score': segmentation_results.get('accessibility_score', 5)
        }
        
        # 세부 정보가 있으면 포함
        if 'obstacle_details' in segmentation_results:
            accessibility_info['obstacle_details'] = segmentation_results['obstacle_details']
        
        # 계단 세그먼트 추출 (기존 SegFormer 결과)
        stair_segments = segmentation_results.get('stair_segments', [])
        
        # 개선된 분석 실행
        result = analyzer.analyze_image(
            image_path=image_path,
            overlay_path=overlay_path,
            accessibility_info=accessibility_info,
            facility_info=facility_info,
            stair_segments=stair_segments
        )
        
        # 메타데이터 추가
        result['analysis_timestamp'] = datetime.now().isoformat()
        result['analysis_version'] = 'v2.0_stair_validation'
        
        return result

    def create_detailed_report(analysis_result):
        """
        분석 결과를 바탕으로 상세 보고서 생성
        
        Args:
            analysis_result: analyze_with_stair_validation의 결과
            
        Returns:
            str: 상세 보고서 텍스트
        """
        if 'error' in analysis_result:
            return f"분석 오류: {analysis_result['error']}"
        
        report = f"""
    장애인 접근성 분석 보고서
    {'='*50}

    종합 접근성 점수
    - 외부 접근성: {analysis_result.get('external_accessibility_score', 0)}/10점
    - 내부 접근성: {analysis_result.get('internal_accessibility_score', 0)}/10점  
    - 최종 접근성: {analysis_result.get('final_accessibility_score', 0)}/10점

    개선된 계단 분석
    - 계단 개수: {analysis_result.get('stairs_count', 0)}개
    - 계단 높이: {analysis_result.get('stairs_height', '정보 없음')}
    - 검출 신뢰도: {analysis_result.get('stair_detection_confidence', '보통')}

    노이즈 필터링 결과
    {analysis_result.get('noise_filtering_summary', '필터링 정보 없음')}
    """

        # 계단 검증 세부사항 (있는 경우)
        if 'stair_validation_details' in analysis_result:
            validation = analysis_result['stair_validation_details']
            report += f"""
    계단 검증 세부사항
    - 원본 세그먼트: {validation.get('total_segments', 0)}개
    - 검증 통과: {validation.get('filtered_count', 0)}개
    - 최종 그룹: {validation.get('final_stair_groups', 0)}개
    - 신뢰도 점수: {validation.get('confidence_score', 0):.2f}
    """

        # 주요 관찰사항
        observations = analysis_result.get('observations', [])
        if observations:
            report += "\n🔍 주요 관찰사항\n"
            for i, obs in enumerate(observations, 1):
                report += f"{i}. {obs}\n"

        # 개선 권장사항
        recommendations = analysis_result.get('recommendations', [])
        if recommendations:
            report += "\n💡 개선 권장사항\n"
            for i, rec in enumerate(recommendations, 1):
                report += f"{i}. {rec}\n"

        # 대안 경로 정보
        if analysis_result.get('alternative_route', False):
            report += f"\n🚶 대안 경로\n{analysis_result.get('alternative_route_description', '')}\n"

        # 분석 메타데이터
        if 'analysis_timestamp' in analysis_result:
            report += f"\n📅 분석 시간: {analysis_result['analysis_timestamp']}"
        if 'analysis_version' in analysis_result:
            report += f"\n🔧 분석 버전: {analysis_result['analysis_version']}"

        return report