"""
공공데이터 포털 API 없는 경우를 위한 강화된 외부 접근성 분석 모듈
"""
import cv2
import numpy as np
import json
from typing import Dict, List, Tuple, Optional
from datetime import datetime


class EnhancedExternalAnalyzer:
    """강화된 외부 접근성 분석기"""
    
    def __init__(self):
        self.obstacle_weights = {
            'stairs': -3.0,      # 계단 (가장 큰 장애물)
            'curb': -2.0,        # 연석/턱
            'narrow_door': -2.5, # 좁은 출입구
            'no_ramp': -2.0,     # 경사로 부재
            'uneven_surface': -1.5, # 고르지 않은 표면
            'poles_posts': -1.0, # 기둥/표지판
            'cars_blocking': -2.0, # 차량 방해
            'steep_slope': -2.5, # 급경사
            'no_handrail': -1.0, # 난간 부재
            'poor_lighting': -0.5, # 조명 부족
            'narrow_path': -1.5  # 좁은 통로
        }
        
        self.positive_features = {
            'ramp_present': 2.0,     # 경사로 존재
            'wide_entrance': 1.5,    # 넓은 출입구
            'level_entrance': 2.0,   # 평평한 입구
            'handrail': 1.0,        # 난간 존재
            'tactile_paving': 1.0,   # 점자블록
            'accessible_parking': 1.5, # 접근 가능한 주차
            'smooth_surface': 1.0,   # 매끄러운 표면
            'adequate_width': 1.0,   # 적절한 폭
            'good_lighting': 0.5     # 좋은 조명
        }

    def analyze_enhanced_external_accessibility(self, image_path: str, seg_map: np.ndarray, 
                                              stair_segments: List[Dict] = None) -> Dict:
        """
        강화된 외부 접근성 분석
        
        Args:
            image_path: 이미지 파일 경로
            seg_map: 세그멘테이션 결과 맵
            stair_segments: 계단 세그먼트 정보
            
        Returns:
            Dict: 상세한 외부 접근성 분석 결과
        """
        try:
            # 이미지 로드
            image = cv2.imread(image_path)
            if image is None:
                return {"error": "이미지를 로드할 수 없습니다."}
            
            height, width = image.shape[:2]
            
            # 분석 결과 초기화
            analysis_result = {
                "accessibility_obstacles": {},
                "positive_features": {},
                "detailed_scores": {},
                "external_accessibility_score": 5.0,
                "confidence_level": "medium",
                "analysis_details": []
            }
            
            # 1. 계단 분석 (강화)
            stair_analysis = self._analyze_stairs_detailed(image, seg_map, stair_segments)
            analysis_result["stairs_analysis"] = stair_analysis
            
            # 2. 출입구 분석
            entrance_analysis = self._analyze_entrance_accessibility(image, seg_map)
            analysis_result["entrance_analysis"] = entrance_analysis
            
            # 3. 표면 및 경로 분석
            surface_analysis = self._analyze_surface_conditions(image, seg_map)
            analysis_result["surface_analysis"] = surface_analysis
            
            # 4. 장애물 검출
            obstacle_analysis = self._detect_mobility_obstacles(image, seg_map)
            analysis_result["obstacle_analysis"] = obstacle_analysis
            
            # 5. 접근 경로 분석
            path_analysis = self._analyze_access_paths(image, seg_map)
            analysis_result["path_analysis"] = path_analysis
            
            # 6. 종합 점수 계산
            final_score = self._calculate_enhanced_external_score(
                stair_analysis, entrance_analysis, surface_analysis, 
                obstacle_analysis, path_analysis
            )
            
            analysis_result.update(final_score)
            analysis_result["analysis_timestamp"] = datetime.now().isoformat()
            
            return analysis_result
            
        except Exception as e:
            return {"error": f"외부 접근성 분석 중 오류: {str(e)}"}

    def _analyze_stairs_detailed(self, image: np.ndarray, seg_map: np.ndarray, 
                               stair_segments: List[Dict] = None) -> Dict:
        """상세한 계단 분석"""
        result = {
            "has_stairs": False,
            "stair_count": 0,
            "stair_height_estimate": "낮음",
            "handrail_detected": False,
            "stair_width": "적절함",
            "accessibility_impact": "없음"
        }
        
        try:
            # 계단 검출 (기존 세그멘테이션 + 개선된 분석)
            if stair_segments and len(stair_segments) > 0:
                result["has_stairs"] = True
                result["stair_count"] = len(stair_segments)
                
                # 계단 높이 추정 (세그먼트 크기 기반)
                total_area = sum(seg.get('area', 0) for seg in stair_segments)
                image_area = image.shape[0] * image.shape[1]
                stair_ratio = total_area / image_area
                
                if stair_ratio > 0.1:
                    result["stair_height_estimate"] = "높음"
                    result["accessibility_impact"] = "매우 높음"
                elif stair_ratio > 0.05:
                    result["stair_height_estimate"] = "보통"
                    result["accessibility_impact"] = "높음"
                else:
                    result["stair_height_estimate"] = "낮음"
                    result["accessibility_impact"] = "보통"
            
            # 난간 검출 (수직선 분석)
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=50, 
                                  minLineLength=30, maxLineGap=10)
            
            if lines is not None:
                vertical_lines = []
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    angle = np.abs(np.arctan2(y2-y1, x2-x1) * 180 / np.pi)
                    if 70 <= angle <= 110:  # 수직에 가까운 선
                        vertical_lines.append(line)
                
                if len(vertical_lines) >= 2:
                    result["handrail_detected"] = True
            
            return result
            
        except Exception as e:
            result["error"] = f"계단 분석 오류: {str(e)}"
            return result

    def _analyze_entrance_accessibility(self, image: np.ndarray, seg_map: np.ndarray) -> Dict:
        """출입구 접근성 분석"""
        result = {
            "entrance_width": "보통",
            "door_type": "일반문",
            "threshold_height": "낮음",
            "entrance_level": True,
            "approach_space": "충분함"
        }
        
        try:
            height, width = image.shape[:2]
            
            # 출입구 영역 추정 (이미지 중앙 하단)
            entrance_region = seg_map[int(height*0.4):height, int(width*0.2):int(width*0.8)]
            
            # 문 영역 검출 (색상 및 형태 기반)
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            entrance_gray = gray[int(height*0.4):height, int(width*0.2):int(width*0.8)]
            
            # 수직 엣지 검출로 문틀 찾기
            sobel_x = cv2.Sobel(entrance_gray, cv2.CV_64F, 1, 0, ksize=3)
            vertical_edges = np.abs(sobel_x)
            
            # 문 폭 추정
            edge_columns = np.sum(vertical_edges, axis=0)
            prominent_edges = edge_columns > np.percentile(edge_columns, 90)
            
            if np.sum(prominent_edges) > 0:
                edge_positions = np.where(prominent_edges)[0]
                if len(edge_positions) >= 2:
                    door_width = edge_positions[-1] - edge_positions[0]
                    door_width_ratio = door_width / entrance_gray.shape[1]
                    
                    if door_width_ratio > 0.6:
                        result["entrance_width"] = "넓음"
                    elif door_width_ratio < 0.3:
                        result["entrance_width"] = "좁음"
                        result["door_type"] = "좁은문"
            
            # 턱/계단 검출 (수평 엣지 기반)
            sobel_y = cv2.Sobel(entrance_gray, cv2.CV_64F, 0, 1, ksize=3)
            horizontal_edges = np.abs(sobel_y)
            
            strong_horizontal = horizontal_edges > np.percentile(horizontal_edges, 95)
            if np.sum(strong_horizontal) > entrance_gray.shape[0] * 0.1:
                result["entrance_level"] = False
                result["threshold_height"] = "높음"
            
            return result
            
        except Exception as e:
            result["error"] = f"출입구 분석 오류: {str(e)}"
            return result

    def _analyze_surface_conditions(self, image: np.ndarray, seg_map: np.ndarray) -> Dict:
        """표면 상태 분석"""
        result = {
            "surface_type": "포장도로",
            "surface_quality": "양호",
            "has_tactile_paving": False,
            "surface_smoothness": "매끄러움",
            "drainage_visible": False
        }
        
        try:
            # 바닥 영역 추출 (이미지 하단 70%)
            height, width = image.shape[:2]
            ground_region = image[int(height*0.3):height, :]
            ground_gray = cv2.cvtColor(ground_region, cv2.COLOR_BGR2GRAY)
            
            # 표면 질감 분석 (텍스처)
            # 라플라시안 분산으로 텍스처 복잡도 측정
            laplacian = cv2.Laplacian(ground_gray, cv2.CV_64F)
            texture_variance = np.var(laplacian)
            
            if texture_variance > 500:
                result["surface_quality"] = "거칠음"
                result["surface_smoothness"] = "울퉁불퉁"
            elif texture_variance < 100:
                result["surface_quality"] = "매우양호"
                result["surface_smoothness"] = "매우매끄러움"
            
            # 점자블록 검출 (규칙적인 패턴)
            # 형태학적 연산으로 반복 패턴 검출
            kernel = np.ones((5,5), np.uint8)
            tophat = cv2.morphologyEx(ground_gray, cv2.MORPH_TOPHAT, kernel)
            
            if np.mean(tophat) > 10:  # 임계값 조정 가능
                result["has_tactile_paving"] = True
            
            # 색상 분석으로 표면 타입 추정
            hsv = cv2.cvtColor(ground_region, cv2.COLOR_BGR2HSV)
            
            # 회색/검은색 계열 (아스팔트)
            gray_mask = cv2.inRange(hsv, (0,0,0), (180,50,100))
            gray_ratio = np.sum(gray_mask > 0) / (ground_region.shape[0] * ground_region.shape[1])
            
            if gray_ratio > 0.3:
                result["surface_type"] = "아스팔트"
            
            return result
            
        except Exception as e:
            result["error"] = f"표면 분석 오류: {str(e)}"
            return result

    def _detect_mobility_obstacles(self, image: np.ndarray, seg_map: np.ndarray) -> Dict:
        """이동성 장애물 검출"""
        result = {
            "detected_obstacles": [],
            "obstacle_severity": "낮음",
            "clear_path_available": True,
            "obstacle_details": {}
        }
        
        try:
            height, width = image.shape[:2]
            
            # 객체 검출을 위한 컨투어 찾기
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # 접근 경로 영역 (이미지 중앙 하단)
            path_region = gray[int(height*0.4):height, int(width*0.1):int(width*0.9)]
            
            # 엣지 검출 및 컨투어
            edges = cv2.Canny(path_region, 50, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            significant_obstacles = []
            
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > 100:  # 최소 크기 필터
                    x, y, w, h = cv2.boundingRect(contour)
                    aspect_ratio = w / h if h > 0 else 0
                    
                    # 장애물 유형 분류
                    obstacle_type = "unknown"
                    if aspect_ratio > 3 and h < path_region.shape[0] * 0.2:
                        obstacle_type = "curb"  # 연석
                    elif 0.5 < aspect_ratio < 2 and area > 500:
                        obstacle_type = "pole_post"  # 기둥/표지판
                    elif aspect_ratio > 2 and area > 1000:
                        obstacle_type = "vehicle"  # 차량
                    
                    if obstacle_type != "unknown":
                        significant_obstacles.append({
                            "type": obstacle_type,
                            "area": area,
                            "position": (x, y, w, h),
                            "severity": self._assess_obstacle_severity(obstacle_type, area, path_region.shape)
                        })
            
            result["detected_obstacles"] = [obs["type"] for obs in significant_obstacles]
            result["obstacle_details"] = {obs["type"]: obs for obs in significant_obstacles}
            
            # 전체 심각도 평가
            if len(significant_obstacles) > 3:
                result["obstacle_severity"] = "높음"
                result["clear_path_available"] = False
            elif len(significant_obstacles) > 1:
                result["obstacle_severity"] = "보통"
            
            return result
            
        except Exception as e:
            result["error"] = f"장애물 검출 오류: {str(e)}"
            return result

    def _analyze_access_paths(self, image: np.ndarray, seg_map: np.ndarray) -> Dict:
        """접근 경로 분석"""
        result = {
            "path_width": "적절함",
            "path_continuity": True,
            "slope_assessment": "평평함",
            "alternative_routes": False,
            "path_quality": "양호"
        }
        
        try:
            height, width = image.shape[:2]
            
            # 접근 경로 분석을 위한 영역 설정
            path_region = image[int(height*0.3):height, :]
            path_gray = cv2.cvtColor(path_region, cv2.COLOR_BGR2GRAY)
            
            # 경로 폭 분석 (수직 방향 변화 분석)
            vertical_profile = np.mean(path_gray, axis=0)
            path_edges = np.where(np.abs(np.diff(vertical_profile)) > 20)[0]
            
            if len(path_edges) >= 2:
                path_width_pixels = path_edges[-1] - path_edges[0]
                width_ratio = path_width_pixels / width
                
                if width_ratio < 0.3:
                    result["path_width"] = "좁음"
                elif width_ratio > 0.7:
                    result["path_width"] = "넓음"
            
            # 경사 분석 (수평선 검출)
            lines = cv2.HoughLinesP(cv2.Canny(path_gray, 50, 150), 
                                  1, np.pi/180, threshold=30, 
                                  minLineLength=50, maxLineGap=20)
            
            if lines is not None:
                slopes = []
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    if abs(x2 - x1) > 10:  # 수평선이 아닌 경우
                        slope = abs((y2 - y1) / (x2 - x1))
                        slopes.append(slope)
                
                if slopes and np.mean(slopes) > 0.3:
                    result["slope_assessment"] = "경사있음"
                elif slopes and np.mean(slopes) > 0.1:
                    result["slope_assessment"] = "약간경사"
            
            return result
            
        except Exception as e:
            result["error"] = f"접근 경로 분석 오류: {str(e)}"
            return result

    def _assess_obstacle_severity(self, obstacle_type: str, area: float, region_shape: Tuple) -> str:
        """장애물 심각도 평가"""
        area_ratio = area / (region_shape[0] * region_shape[1])
        
        severity_thresholds = {
            "curb": 0.05,
            "pole_post": 0.02,
            "vehicle": 0.1
        }
        
        threshold = severity_thresholds.get(obstacle_type, 0.05)
        
        if area_ratio > threshold * 2:
            return "높음"
        elif area_ratio > threshold:
            return "보통"
        else:
            return "낮음"

    def _calculate_enhanced_external_score(self, stair_analysis: Dict, entrance_analysis: Dict,
                                         surface_analysis: Dict, obstacle_analysis: Dict,
                                         path_analysis: Dict) -> Dict:
        """강화된 외부 접근성 점수 계산"""
        base_score = 10.0  # 만점에서 시작
        score_details = {}
        
        # 1. 계단 관련 감점
        if stair_analysis.get("has_stairs", False):
            stair_impact = stair_analysis.get("accessibility_impact", "없음")
            if stair_impact == "매우 높음":
                deduction = 4.0
            elif stair_impact == "높음":
                deduction = 3.0
            elif stair_impact == "보통":
                deduction = 2.0
            else:
                deduction = 1.0
            
            base_score -= deduction
            score_details["stairs"] = f"-{deduction}점 (계단 {stair_analysis.get('stair_count', 0)}개)"
            
            # 난간이 있으면 일부 회복
            if stair_analysis.get("handrail_detected", False):
                base_score += 0.5
                score_details["handrail"] = "+0.5점 (난간 존재)"
        
        # 2. 출입구 관련 점수
        entrance_width = entrance_analysis.get("entrance_width", "보통")
        if entrance_width == "넓음":
            base_score += 1.0
            score_details["entrance_width"] = "+1.0점 (넓은 출입구)"
        elif entrance_width == "좁음":
            base_score -= 2.0
            score_details["entrance_width"] = "-2.0점 (좁은 출입구)"
        
        if not entrance_analysis.get("entrance_level", True):
            base_score -= 1.5
            score_details["entrance_level"] = "-1.5점 (출입구 턱/계단)"
        
        # 3. 표면 상태 점수
        surface_quality = surface_analysis.get("surface_quality", "양호")
        if surface_quality == "매우양호":
            base_score += 0.5
            score_details["surface"] = "+0.5점 (매우 양호한 표면)"
        elif surface_quality == "거칠음":
            base_score -= 1.0
            score_details["surface"] = "-1.0점 (거친 표면)"
        
        if surface_analysis.get("has_tactile_paving", False):
            base_score += 1.0
            score_details["tactile"] = "+1.0점 (점자블록 존재)"
        
        # 4. 장애물 관련 감점
        obstacle_severity = obstacle_analysis.get("obstacle_severity", "낮음")
        if obstacle_severity == "높음":
            base_score -= 2.5
            score_details["obstacles"] = "-2.5점 (심각한 장애물)"
        elif obstacle_severity == "보통":
            base_score -= 1.0
            score_details["obstacles"] = "-1.0점 (일반 장애물)"
        
        # 5. 접근 경로 점수
        path_width = path_analysis.get("path_width", "적절함")
        if path_width == "넓음":
            base_score += 0.5
            score_details["path_width"] = "+0.5점 (넓은 경로)"
        elif path_width == "좁음":
            base_score -= 1.5
            score_details["path_width"] = "-1.5점 (좁은 경로)"
        
        slope = path_analysis.get("slope_assessment", "평평함")
        if slope == "경사있음":
            base_score -= 2.0
            score_details["slope"] = "-2.0점 (급경사)"
        elif slope == "약간경사":
            base_score -= 0.5
            score_details["slope"] = "-0.5점 (약간 경사)"
        
        # 최종 점수 범위 제한 (1-10)
        final_score = max(1.0, min(10.0, base_score))
        
        # 신뢰도 계산
        confidence = "높음"
        if len(score_details) < 3:
            confidence = "보통"
        
        return {
            "external_accessibility_score": round(final_score, 1),
            "score_breakdown": score_details,
            "confidence_level": confidence,
            "analysis_summary": self._generate_analysis_summary(score_details, final_score)
        }

    def _generate_analysis_summary(self, score_details: Dict, final_score: float) -> str:
        """분석 요약 생성"""
        summary_parts = []
        
        if final_score >= 8:
            summary_parts.append("전반적으로 접근성이 양호합니다.")
        elif final_score >= 6:
            summary_parts.append("접근성에 일부 개선이 필요합니다.")
        elif final_score >= 4:
            summary_parts.append("접근성에 상당한 문제가 있습니다.")
        else:
            summary_parts.append("접근성이 매우 제한적입니다.")
        
        # 주요 문제점 요약
        major_issues = []
        for key, detail in score_details.items():
            if detail.startswith("-") and float(detail.split("점")[0][1:]) >= 1.5:
                major_issues.append(detail.split("(")[1].rstrip(")"))
        
        if major_issues:
            summary_parts.append(f"주요 문제: {', '.join(major_issues)}")
        
        return " ".join(summary_parts)


def integrate_enhanced_external_analysis(original_accessibility_info: Dict, 
                                       image_path: str, seg_map: np.ndarray,
                                       stair_segments: List[Dict] = None) -> Dict:
    """
    기존 접근성 정보에 강화된 외부 분석 결과 통합
    
    Args:
        original_accessibility_info: 기존 접근성 분석 결과
        image_path: 이미지 파일 경로
        seg_map: 세그멘테이션 맵
        stair_segments: 계단 세그먼트 정보
        
    Returns:
        Dict: 통합된 접근성 분석 결과
    """
    # 강화된 외부 분석 실행
    analyzer = EnhancedExternalAnalyzer()
    enhanced_result = analyzer.analyze_enhanced_external_accessibility(
        image_path, seg_map, stair_segments
    )
    
    # 기존 정보와 통합
    integrated_result = original_accessibility_info.copy()
    integrated_result.update({
        "enhanced_external_analysis": enhanced_result,
        "external_accessibility_score": enhanced_result.get("external_accessibility_score", 5.0),
        "detailed_analysis_available": True,
        "analysis_type": "external_only"  # 내부 분석 없음을 표시
    })
    
    return integrated_result
