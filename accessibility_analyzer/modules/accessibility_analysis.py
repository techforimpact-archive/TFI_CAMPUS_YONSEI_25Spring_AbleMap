"""
접근성 분석을 수행하는 모듈
"""
import numpy as np
from scipy.ndimage import binary_dilation
from config import CLASS_MAP, ACCESSIBILITY_THRESHOLD_DISTANCE

class AccessibilityAnalyzer:
    def __init__(self, class_map=CLASS_MAP):
        """
        접근성 분석기 초기화
        """
        self.class_map = class_map
        self.threshold_distance = ACCESSIBILITY_THRESHOLD_DISTANCE
    
    def analyze(self, seg_map):
        """
        세그멘테이션 맵에서 접근성 정보 분석
        
        Args:
            seg_map: 세그멘테이션 맵
            
        Returns:
            dict: 접근성 정보
        """
        # 기본 접근성 정보 초기화
        accessibility_info = {
            'has_stairs': False,
            'has_ramp': False,
            'entrance_accessible': True,
            'obstacles': [],
            'obstacle_details': {},
            'additional_obstacles': [],  # 새로 추가
            'confidence_scores': {}  # 새로 추가
        }
        
        # 계단 감지
        stairs_mask = seg_map == self.class_map['stairs']
        if np.any(stairs_mask):
            accessibility_info['has_stairs'] = True
            accessibility_info['obstacles'].append('stairs')
            
            # 계단 크기 분석 (픽셀 수로 상대적인 크기 추정)
            stairs_pixels = np.count_nonzero(stairs_mask)
            total_pixels = seg_map.size
            stairs_ratio = stairs_pixels / total_pixels

            stair_count = self._estimate_stair_count(stairs_mask)

            accessibility_info['obstacle_details']['stairs'] = {
                'pixel_count': int(stairs_pixels),
                'ratio': float(stairs_ratio),
                'estimated_size': self._estimate_size(stairs_ratio),
                'estimated_count': stair_count
            }

            # 계단 심각도 분석
            accessibility_info['stair_severity'] = self._analyze_stair_severity(stair_count, stairs_ratio)
        else:
            accessibility_info['stair_severity'] = 'none'

        # 추가 장애물 감지 (계단 외)
        additional_obstacles, additional_obstacle_details = self._detect_additional_obstacles(seg_map)
        accessibility_info['additional_obstacles'] = additional_obstacles
        accessibility_info['obstacles'].extend(additional_obstacles)
        
        # 추가 장애물 세부 정보를 기존 obstacle_details에 병합
        accessibility_info['obstacle_details'].update(additional_obstacle_details)
        
        # 문 감지 및 분석
        door_mask = seg_map == self.class_map['door']
        if np.any(door_mask):
            # 문 크기 분석
            door_pixels = np.count_nonzero(door_mask)
            total_pixels = seg_map.size
            door_ratio = door_pixels / total_pixels
            accessibility_info['has_door'] = True
            accessibility_info['obstacle_details']['door'] = {
                'pixel_count': int(door_pixels),
                'ratio': float(door_ratio),
                'estimated_width': self._estimate_door_width(door_ratio)
            }
            
            # 문과 계단의 관계 분석
            if accessibility_info['has_stairs']:
                min_distance = self._calculate_object_distance(stairs_mask, door_mask)
                accessibility_info['obstacle_details']['stairs_to_door_distance'] = float(min_distance)
                
                # 문 앞에 계단이 있는지 분석
                if min_distance < self.threshold_distance:
                    accessibility_info['entrance_accessible'] = False
                    accessibility_info['obstacles'].append('stairs_at_entrance')
        
        # 인도 감지
        sidewalk_mask = seg_map == self.class_map['sidewalk']
        if np.any(sidewalk_mask):
            accessibility_info['has_sidewalk'] = True
            
            # 인도와 입구의 관계 분석
            if accessibility_info.get('has_door', False):
                sidewalk_to_door = self._calculate_object_distance(sidewalk_mask, door_mask)
                accessibility_info['obstacle_details']['sidewalk_to_door_distance'] = float(sidewalk_to_door)
                
                # 인도에서 문까지 연결성 분석
                if sidewalk_to_door > self.threshold_distance:
                    accessibility_info['obstacles'].append('disconnected_sidewalk')
        
        # 건물 감지
        building_mask = seg_map == self.class_map['building']
        if np.any(building_mask):
            accessibility_info['has_building'] = True
            
            # 건물 크기 분석
            building_pixels = np.count_nonzero(building_mask)
            total_pixels = seg_map.size
            building_ratio = building_pixels / total_pixels
            accessibility_info['obstacle_details']['building'] = {
                'pixel_count': int(building_pixels),
                'ratio': float(building_ratio)
            }
        
        # 난간 감지 (계단용)
        railing_mask = seg_map == self.class_map['railing']
        if np.any(railing_mask):
            accessibility_info['has_railing'] = True
            
            # 난간이 계단 근처에 있는지 확인
            if accessibility_info['has_stairs']:
                railing_to_stairs = self._calculate_object_distance(railing_mask, stairs_mask)
                accessibility_info['obstacle_details']['railing_to_stairs_distance'] = float(railing_to_stairs)
                
                # 계단에 난간이 있으면 접근성 향상
                if railing_to_stairs < self.threshold_distance:
                    accessibility_info['has_stairs_railing'] = True
        
        # 신뢰도 점수 계산
        accessibility_info['confidence_scores'] = self._calculate_confidence_scores(seg_map)
        
        # 기본 접근성 점수 (참고용)
        accessibility_score = self._calculate_accessibility_score(accessibility_info)
        accessibility_info['accessibility_score'] = accessibility_score
        
        return accessibility_info
    
    def _detect_additional_obstacles(self, seg_map):
        """계단 외 추가 장애물 감지"""
        additional_obstacles = []
        obstacle_details = {}  # 로컬 변수로 변경
        
        # 감지할 장애물 목록과 최소 픽셀 임계값
        obstacle_classes = {
            'car': 100,
            'truck': 100, 
            'motorcycle': 50,
            'bicycle': 30,
            'pole': 20,
            'fire_hydrant': 15,
            'potted_plant': 25,
            'chair': 20,
            'bench': 30,
            'barrier': 40,
            'person': 50,  # 사람도 일시적 장애물로 고려
            'traffic_sign': 15
        }
        
        for obstacle_name, min_pixels in obstacle_classes.items():
            if obstacle_name in self.class_map:
                obstacle_mask = seg_map == self.class_map[obstacle_name]
                if np.any(obstacle_mask):
                    obstacle_pixels = np.count_nonzero(obstacle_mask)
                    if obstacle_pixels >= min_pixels:
                        additional_obstacles.append(obstacle_name)
                        # 장애물 세부 정보를 로컬 딕셔너리에 저장
                        obstacle_details[obstacle_name] = {
                            'pixel_count': int(obstacle_pixels),
                            'ratio': float(obstacle_pixels / seg_map.size),
                            'obstacle_type': self._categorize_obstacle_type(obstacle_name)
                        }
        
        return additional_obstacles, obstacle_details  # 두 개 값 반환

    
    def _categorize_obstacle_type(self, obstacle_name):
        """장애물 유형 분류"""
        fixed_obstacles = ['pole', 'fire_hydrant', 'barrier', 'traffic_sign']
        movable_obstacles = ['car', 'truck', 'motorcycle', 'bicycle', 'chair', 'potted_plant']
        temporary_obstacles = ['person', 'bench']
        
        if obstacle_name in fixed_obstacles:
            return 'fixed'
        elif obstacle_name in movable_obstacles:
            return 'movable'
        elif obstacle_name in temporary_obstacles:
            return 'temporary'
        else:
            return 'unknown'

    def _estimate_stair_count(self, stairs_mask):
        """계단 개수 추정"""
        from scipy import ndimage
        
        # 형태학적 연산으로 개별 계단 영역 분리
        kernel = np.ones((3, 3), np.uint8)
        cleaned = ndimage.binary_opening(stairs_mask, kernel)
        
        # 연결된 컴포넌트로 개별 계단 구분
        labeled, num_features = ndimage.label(cleaned)
        
        # 너무 작은 영역 제거 후 계단 수 추정
        valid_stairs = 0
        for i in range(1, num_features + 1):
            component_size = np.sum(labeled == i)
            if component_size > 10:  # 최소 크기 임계값
                valid_stairs += 1
        
        # 픽셀 비율 기반 추가 추정
        stairs_ratio = np.sum(stairs_mask) / stairs_mask.size
        if stairs_ratio > 0.05:  # 큰 계단 영역
            estimated_from_ratio = max(3, int(stairs_ratio * 50))
            return max(valid_stairs, estimated_from_ratio)
        
        return max(1, valid_stairs)  # 최소 1개

    def _analyze_stair_severity(self, stair_count, stairs_ratio):
        """계단 심각도 분석"""
        if stair_count == 0:
            return 'none'
        elif stair_count >= 5 or stairs_ratio > 0.1:
            return 'severe'  # 심각 (5단 이상 또는 큰 면적)
        elif stair_count >= 3 or stairs_ratio > 0.05:
            return 'moderate'  # 중간 (3-4단)
        else:
            return 'mild'  # 경미 (1-2단)

    def _calculate_confidence_scores(self, seg_map):
        """검출 신뢰도 계산"""
        confidence_scores = {}
        
        # 각 클래스별 검출 영역의 크기와 형태를 바탕으로 신뢰도 추정
        for class_name in ['stairs', 'door', 'building', 'sidewalk']:
            if class_name in self.class_map:
                class_mask = seg_map == self.class_map[class_name]
                if np.any(class_mask):
                    # 영역 크기 기반 신뢰도
                    ratio = np.sum(class_mask) / seg_map.size
                    size_confidence = min(1.0, ratio * 100)  # 크기가 클수록 높은 신뢰도
                    
                    # 형태 기반 신뢰도 (연결성, 모양 등)
                    shape_confidence = self._calculate_shape_confidence(class_mask, class_name)
                    
                    # 종합 신뢰도
                    confidence_scores[f'{class_name}_detection'] = (size_confidence + shape_confidence) / 2
                else:
                    confidence_scores[f'{class_name}_detection'] = 0.0
        
        # 전체 신뢰도
        if confidence_scores:
            avg_confidence = sum(confidence_scores.values()) / len(confidence_scores)
            if avg_confidence > 0.8:
                reliability = 'high'
            elif avg_confidence > 0.5:
                reliability = 'medium'
            else:
                reliability = 'low'
            confidence_scores['overall_reliability'] = reliability
        
        return confidence_scores

    def _calculate_shape_confidence(self, mask, class_name):
        """형태 기반 신뢰도 계산"""
        from scipy import ndimage
        
        # 연결된 컴포넌트 분석
        labeled, num_features = ndimage.label(mask)
        
        if num_features == 0:
            return 0.0
        
        # 가장 큰 영역의 형태 분석
        largest_component = 0
        largest_size = 0
        for i in range(1, num_features + 1):
            component_size = np.sum(labeled == i)
            if component_size > largest_size:
                largest_size = component_size
                largest_component = i
        
        if largest_component == 0:
            return 0.0
        
        component_mask = (labeled == largest_component)
        
        # 클래스별 형태 특성 확인
        if class_name == 'stairs':
            # 계단은 일반적으로 가로로 긴 형태
            return self._check_rectangular_shape(component_mask)
        elif class_name == 'door':
            # 문은 세로로 긴 직사각형
            return self._check_vertical_rectangle(component_mask)
        else:
            # 기본적인 연결성 확인
            return min(1.0, largest_size / np.sum(mask))

    def _check_rectangular_shape(self, mask):
        """직사각형 형태 확인"""
        # 바운딩 박스와 실제 영역의 비율로 직사각형성 측정
        rows, cols = np.where(mask)
        if len(rows) == 0:
            return 0.0
        
        height = np.max(rows) - np.min(rows) + 1
        width = np.max(cols) - np.min(cols) + 1
        bbox_area = height * width
        actual_area = np.sum(mask)
        
        return min(1.0, actual_area / bbox_area)

    def _check_vertical_rectangle(self, mask):
        """세로 직사각형 확인"""
        rows, cols = np.where(mask)
        if len(rows) == 0:
            return 0.0
        
        height = np.max(rows) - np.min(rows) + 1
        width = np.max(cols) - np.min(cols) + 1
        
        # 높이가 너비보다 크면 세로 직사각형
        aspect_ratio = height / width if width > 0 else 0
        vertical_score = min(1.0, aspect_ratio / 2.0)  # 2:1 비율을 이상으로 설정
        
        # 직사각형성도 함께 고려
        rectangularity = self._check_rectangular_shape(mask)
        
        return (vertical_score + rectangularity) / 2
    
    def _calculate_object_distance(self, mask1, mask2):
        """
        두 객체 마스크 간의 최소 거리 계산
        """
        # 두 마스크의 픽셀 좌표 얻기
        y1, x1 = np.where(mask1)
        y2, x2 = np.where(mask2)
        
        if len(y1) == 0 or len(y2) == 0:
            return float('inf')
        
        # 계산량을 줄이기 위해 각 마스크에서 최대 100개 픽셀만 샘플링
        max_samples = min(100, len(y1), len(y2))
        indices1 = np.random.choice(len(y1), max_samples) if len(y1) > max_samples else np.arange(len(y1))
        indices2 = np.random.choice(len(y2), max_samples) if len(y2) > max_samples else np.arange(len(y2))
        
        y1_sample, x1_sample = y1[indices1], x1[indices1]
        y2_sample, x2_sample = y2[indices2], x2[indices2]
        
        # 최소 거리 계산
        min_dist = float('inf')
        for i in range(len(y1_sample)):
            for j in range(len(y2_sample)):
                dist = np.sqrt((y1_sample[i] - y2_sample[j])**2 + (x1_sample[i] - x2_sample[j])**2)
                min_dist = min(min_dist, dist)
        
        return min_dist
    
    def _estimate_size(self, ratio):
        """
        픽셀 비율에 따른 상대적 크기 추정
        """
        if ratio < 0.01:
            return "very small"
        elif ratio < 0.05:
            return "small"
        elif ratio < 0.15:
            return "medium"
        elif ratio < 0.3:
            return "large"
        else:
            return "very large"
    
    def _estimate_door_width(self, ratio):
        """
        문의 상대적 너비 추정 및 휠체어 통과 가능성 판단
        """
        if ratio < 0.01:
            return "narrow"
        elif ratio < 0.03:
            return "standard"
        else:
            return "wide"
    
    def _calculate_accessibility_score(self, accessibility_info):
        """
        종합적인 접근성 점수 계산 (0-10)
        """
        score = 10  # 기본 점수
        
        # 계단 관련
        if 'stairs_at_entrance' in accessibility_info['obstacles']:
            # 입구 바로 앞에 계단이 있으면 큰 감점
            score -= 5
            
            # 난간이 있으면 약간 점수 보상
            if accessibility_info.get('has_stairs_railing', False):
                score += 1
        elif accessibility_info['has_stairs']:
            # 계단이 있지만 입구에서 떨어져 있으면 작은 감점
            score -= 2
        
        # 인도 연결성
        if 'disconnected_sidewalk' in accessibility_info['obstacles']:
            score -= 2
        
        # 문 너비
        if accessibility_info.get('has_door', False):
            door_width = accessibility_info['obstacle_details']['door']['estimated_width']
            if door_width == "narrow":
                score -= 3
            elif door_width == "wide":
                score += 1
        
        # 최종 점수 범위 조정
        return max(1, min(10, score))
    
    def get_accessibility_explanation(self, accessibility_info):
        """
        접근성 점수에 대한 설명 생성
        
        Args:
            accessibility_info: 접근성 정보
            
        Returns:
            str: 접근성 설명
        """
        score = accessibility_info.get('accessibility_score', 0)
        
        if score >= 9:
            explanation = "매우 높은 접근성: 휠체어 사용자가 쉽게 접근 가능한 환경입니다."
        elif score >= 7:
            explanation = "좋은 접근성: 휠체어 사용자가 대부분 접근 가능하나 약간의 불편함이 있을 수 있습니다."
        elif score >= 5:
            explanation = "보통 접근성: 휠체어 사용자가 접근 가능하나 일부 도움이 필요할 수 있습니다."
        elif score >= 3:
            explanation = "낮은 접근성: 휠체어 사용자는 접근에 상당한 어려움이 있을 수 있습니다."
        else:
            explanation = "매우 낮은 접근성: 휠체어 사용자는 도움 없이 접근하기 어렵습니다."
        
        return explanation