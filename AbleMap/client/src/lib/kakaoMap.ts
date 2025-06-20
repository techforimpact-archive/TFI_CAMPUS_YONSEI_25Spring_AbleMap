import { useEffect } from "react";
import { SearchResult } from "@shared/schema";
import { trackPoiPinClick } from "./amplitude";

// window 타입 확장 - TypeScript 타입 정의
declare global {
  interface Window {
    kakao: any;
    kakaoMap: any;
    selectedCategoryId?: number; // 현재 선택된 카테고리 ID 저장
    selectPlaceByKakaoPin?: (place: any) => void; // 카카오맵 핀 클릭 시 장소 선택 함수
    lastMapEvent?: {
      type: string;
      level: number;
      center: {
        lat: number;
        lng: number;
      };
    };
  }
}

// 서울특별시 서대문구 신촌동 coordinates (centered on Sinchon Station area)
const DEFAULT_LOCATION = {
  lat: "37.5559",
  lng: "126.9368", // Sinchon, Seodaemun-gu, Seoul
};

// 카테고리별 키워드 매핑
const CATEGORY_KEYWORDS: Record<string, string> = {
  "1": "음식점", // 음식점
  "2": "카페", // 카페
  "3": "쇼핑", // 쇼핑
  "6": "편의점" // 편의점
};

// 줌 레벨별 검색 반경 설정 (미터 단위)
const ZOOM_LEVEL_RADIUS: Record<number, number> = {
  1: 5000,  // 가장 멀리 볼 때
  2: 3000,
  3: 2000,
  4: 1000,
  5: 500,
  6: 300,
  7: 200,   // 가장 가까이 볼 때
};

// 카테고리 마커를 저장할 배열
let categoryMarkers: any[] = [];

export const initializeMap = (
  container: HTMLElement | null,
  options = {
    center: DEFAULT_LOCATION,
    level: 3,
    draggable: true,
    zoomable: true,
    restrictBounds: false
  }
): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!container) {
      console.error("Map container not found");
      reject(new Error("Map container not found"));
      return;
    }

    // Check if Kakao Maps SDK is loaded
    if (!window.kakao || !window.kakao.maps) {
      console.error("Kakao Maps SDK not loaded");
      reject(new Error("Kakao Maps SDK not loaded"));
      return;
    }

    try {
      console.log("Creating map with container:", container);
      console.log("Container dimensions:", container.offsetWidth, "x", container.offsetHeight);
      
      // Force the container to have dimensions
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        container.style.width = "100%";
        container.style.height = "500px";
        container.style.position = "relative";
        console.log("Applied dimensions to container");
      }
      
      // Create map instance
      const center = new window.kakao.maps.LatLng(
        options.center.lat,
        options.center.lng
      );
      
      const map = new window.kakao.maps.Map(container, {
        center,
        level: options.level,
        draggable: options.draggable,
        zoomable: options.zoomable,
      });
      
      // Set initial position to default location (no restrictions)
      const defaultCenter = new window.kakao.maps.LatLng(37.5559, 126.9368);
      map.setCenter(defaultCenter);
      
      // Set initial zoom level (no restrictions)
      map.setLevel(3);
      
      // 카테고리 검색용 줌 레벨 변경 이벤트 리스너
      // 함수 참조 문제를 피하기 위해 간소화된 버전으로 먼저 구현
      window.kakao.maps.event.addListener(map, 'zoom_changed', function() {
        const currentLevel = map.getLevel();
        console.log(`지도 줌 레벨 변경: ${currentLevel}`);
        
        // 필요한 상태 정보만 저장하고 이벤트를 트리거
        // 실제 검색은 외부 모듈에서 처리
        try {
          // @ts-ignore - 타입스크립트 에러 방지
          window.lastMapEvent = {
            type: 'zoom_changed',
            level: currentLevel,
            center: {
              lat: map.getCenter().getLat(),
              lng: map.getCenter().getLng()
            }
          };
        } catch (e) {
          console.error("이벤트 상태 저장 중 오류:", e);
        }
      });

      // 카테고리 검색용 지도 이동 완료 이벤트 리스너
      window.kakao.maps.event.addListener(map, 'dragend', function() {
        const center = map.getCenter();
        console.log(`지도 중심 이동: ${center.getLat()}, ${center.getLng()}`);
        
        // 필요한 상태 정보만 저장하고 이벤트를 트리거
        try {
          // @ts-ignore - 타입스크립트 에러 방지
          window.lastMapEvent = {
            type: 'dragend',
            level: map.getLevel(),
            center: {
              lat: center.getLat(),
              lng: center.getLng()
            }
          };
        } catch (e) {
          console.error("이벤트 상태 저장 중 오류:", e);
        }
      });

      // 전역 객체에 맵 저장 - 다른 컴포넌트에서 직접 접근 가능
      window.kakaoMap = map;
      
      console.log("Map created successfully");
      resolve(map);
    } catch (error) {
      console.error("Error creating map:", error);
      reject(error);
    }
  });
};

// 전역 변수로 지도와 마커 관리
// @ts-ignore - 타입스크립트 에러 방지
window.kakaoMap = null; // 글로벌 맵 객체
// 마커 관리를 위한 전역 변수들
let currentSearchPinMarker: any = null;
// categoryMarkers는 파일 상단에 이미 선언되어 있음

// 현재의 핀 마커를 제거하는 전역 함수 추가 - 강화된 버전
// 검색 마커만 제거하는 함수
export const removeCurrentSearchPinMarker = (): void => {
  console.log("🧨 검색 마커 제거 함수 실행 시작");
  
  // 모든 카카오맵 관련 전역 변수와 임시 변수들을 한 곳에서 관리
  let markerRemovedCount = 0;
  
  // 1. 전역 변수로 추적 중인 마커 제거
  if (currentSearchPinMarker) {
    console.log("▶ 전역 변수로 저장된 마커 제거 시도");
    try {
      // 먼저 마커 객체 검증
      if (typeof currentSearchPinMarker?.setMap === 'function') {
        console.log("유효한 마커 객체 발견, 맵에서 제거 시도");
        // 마커의 지도 연결 제거
        currentSearchPinMarker.setMap(null);
        console.log("✓ 마커가 맵에서 성공적으로 제거됨");
        markerRemovedCount++;
      } else {
        console.log("⚠️ 유효하지 않은 마커 객체 (setMap 메서드 없음)");
      }
      
      // 객체 참조 해제 - 중요: 가비지 컬렉션을 위해
      currentSearchPinMarker = null;
      console.log("✓ 전역 변수 참조 해제 완료");
    } catch (e) {
      console.error("❌ 전역 마커 제거 중 에러 발생:", e);
    }
  } else {
    console.log("⚪ 전역 변수에 제거할 마커 없음");
  }
  
  // 2. 카카오맵 API에 추가 정리 작업 수행
  try {
    if (window.kakao && window.kakao.maps) {
      if (window.kakao.maps.Marker) {
        console.log("▶ 카카오맵 API 마커 관련 정리 작업");
        
        // 2.1 임시 속성에 저장된 마커 제거
        if (window.kakao.maps.Marker._lastCreatedMarker) {
          try {
            window.kakao.maps.Marker._lastCreatedMarker.setMap(null);
            window.kakao.maps.Marker._lastCreatedMarker = null;
            console.log("✓ 임시 속성에 저장된 마커 제거 성공");
            markerRemovedCount++;
          } catch (lastMarkerError) {
            console.error("임시 속성 마커 제거 실패:", lastMarkerError);
          }
        }
        
        // 2.2 임시 변수로 추가 (마커 생성 시 추가했을 수 있음)
        if (window.kakao.maps._lastPinMarker) {
          try {
            window.kakao.maps._lastPinMarker.setMap(null);
            window.kakao.maps._lastPinMarker = null;
            console.log("✓ 추가 임시 변수의 마커 제거 성공");
            markerRemovedCount++;
          } catch (error) {
            // 무시
          }
        }
      }
    }
  } catch (e) {
    console.error("❌ 카카오맵 API 접근 중 오류:", e);
  }
  
  console.log(`✓✓ 전역 마커 제거 작업 완료 (${markerRemovedCount}개 제거됨)`);
  
  // 추가 안전장치: 전역 객체에 마커가 남아있지 않도록 초기화
  currentSearchPinMarker = null;
  
  // 3. 다른 전역 객체들도 초기화 (필요한 경우)
  try {
    if (window.kakao?.maps) {
      // 마커 관련 전역 변수 초기화
      window.kakao.maps._activeMarkers = [];
      window.kakao.maps._searchMarker = null;
    }
  } catch (e) {
    // 무시
  }
};

// 모든 카테고리 마커를 제거하는 함수
export const removeCategoryMarkers = (): void => {
  console.log("🧹 카테고리 마커 제거 시작");
  
  if (categoryMarkers.length === 0) {
    console.log("ℹ️ 제거할 카테고리 마커가 없습니다.");
    return;
  }
  
  let removedCount = 0;
  
  categoryMarkers.forEach((marker, index) => {
    try {
      if (marker && typeof marker.setMap === 'function') {
        marker.setMap(null);
        removedCount++;
      }
    } catch (e) {
      console.error(`카테고리 마커 제거 실패 (${index}):`, e);
    }
  });
  
  console.log(`✓ 카테고리 마커 ${removedCount}/${categoryMarkers.length}개 제거 완료`);
  // 배열 초기화
  categoryMarkers = [];
};

// 마커를 간단하게 생성하는 함수 - 복잡성 제거
export const createMarker = (
  map: any,
  position: { lat: string; lng: string },
  options: { color?: string; zIndex?: number; isSearchResult?: boolean; id?: string | number } = {}
): any => {
  // 마커 생성 전 기존 검색 마커 제거
  if (options.isSearchResult && currentSearchPinMarker) {
    try {
      currentSearchPinMarker.setMap(null);
      currentSearchPinMarker = null;
    } catch (e) {
      console.error("기존 마커 제거 실패:", e);
    }
  }

  try {
    if (!window.kakao?.maps) {
      console.error("Kakao Maps API가 로드되지 않았습니다");
      return null;
    }

    // 가장 기본적인 Kakao 마커 생성 방식
    const markerPosition = new window.kakao.maps.LatLng(position.lat, position.lng);
    
    const marker = new window.kakao.maps.Marker({
      position: markerPosition,
      map: map,  // 생성 시 바로 맵에 추가
    });
    
    console.log(`새 마커 생성 성공 [${options.isSearchResult ? '검색' : '일반'}]:`, 
      position.lat, position.lng);
    
    // 검색 결과 마커인 경우 전역 변수에 저장
    if (options.isSearchResult) {
      // ID 속성 추가
      marker.id = options.id || Date.now();
      // 전역 변수에 저장
      currentSearchPinMarker = marker;
    }
    
    return marker;
  } catch (error) {
    console.error("마커 생성 실패:", error);
    return null;
  }
};

export const createCustomOverlay = (
  map: any,
  position: { lat: string; lng: string },
  content: string
): any => {
  try {
    // Check if Kakao Maps API is properly loaded
    if (!window.kakao || !window.kakao.maps || typeof window.kakao.maps.CustomOverlay !== 'function') {
      console.warn("Kakao Maps API not fully loaded, returning mock overlay");
      return { setMap: () => {} };
    }

    const overlayPosition = new window.kakao.maps.LatLng(position.lat, position.lng);
    
    // Create a custom overlay
    const customOverlay = new window.kakao.maps.CustomOverlay({
      position: overlayPosition,
      content: content,
      xAnchor: 0.5,
      yAnchor: 1,
      zIndex: 10,
    });

    customOverlay.setMap(map);
    return customOverlay;
  } catch (error) {
    console.error("Error creating custom overlay:", error);
    return { setMap: () => {} };
  }
};

export const searchPlaces = (
  query: string
): Promise<SearchResult[]> => {
  return new Promise((resolve, reject) => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      reject(new Error("Kakao Maps Services not loaded"));
      return;
    }

    const places = new window.kakao.maps.services.Places();
    
    // 전국 검색을 위해 지역 제한 제거
    const options = {
      size: 15  // 검색 결과 개수만 제한
    };
    
    // 전국 검색 실행 - 지역 제한 없음
    places.keywordSearch(query, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const searchResults: SearchResult[] = result.map((item: any) => ({
          id: item.id,
          name: item.place_name,
          address: item.address_name,
          latitude: item.y,
          longitude: item.x,
        }));
        
        // 지역 필터링 제거 - 전국 어디든 검색 가능
        resolve(searchResults);
      } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]);
      } else {
        reject(new Error(`Search failed: ${status}`));
      }
    }, options);
  });
};

export const getCurrentLocation = (): Promise<{ lat: string; lng: string }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude.toString(),
          lng: position.coords.longitude.toString(),
        });
      },
      (error) => {
        reject(error);
        // Fallback to default location
        resolve(DEFAULT_LOCATION);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
};

export const panTo = (
  map: any,
  position: { lat: string; lng: string }
): void => {
  if (!map) return;
  
  try {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.LatLng) {
      console.warn("Kakao Maps API not fully loaded, skipping panTo");
      return;
    }
    const center = new window.kakao.maps.LatLng(position.lat, position.lng);
    map.panTo(center);
  } catch (error) {
    console.error("Error panning map:", error);
  }
};

export const setMapType = (map: any, type: string): void => {
  if (!map) return;
  
  try {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.MapTypeId) {
      console.warn("Kakao Maps API not fully loaded, skipping setMapType");
      return;
    }
    
    if (type === 'satellite') {
      map.setMapTypeId(window.kakao.maps.MapTypeId.HYBRID);
    } else {
      map.setMapTypeId(window.kakao.maps.MapTypeId.ROADMAP);
    }
  } catch (error) {
    console.error("Error setting map type:", error);
  }
};

export const zoomIn = (map: any): void => {
  if (!map) return;
  
  try {
    if (typeof map.setLevel !== 'function' || typeof map.getLevel !== 'function') {
      console.warn("Map does not support zoom functions");
      return;
    }
    map.setLevel(map.getLevel() - 1);
  } catch (error) {
    console.error("Error zooming in:", error);
  }
};

export const zoomOut = (map: any): void => {
  if (!map) return;
  
  try {
    if (typeof map.setLevel !== 'function' || typeof map.getLevel !== 'function') {
      console.warn("Map does not support zoom functions");
      return;
    }
    map.setLevel(map.getLevel() + 1);
  } catch (error) {
    console.error("Error zooming out:", error);
  }
};

// 줌 레벨에 따라 현재 지도 중심의 카테고리별 장소를 검색하고 표시하는 함수
export function searchCategoryPlacesByZoomLevel(map: any, categoryId: number, zoomLevel: number) {
  if (!map || !window.kakao || !window.kakao.maps) {
    console.error("카카오 맵 또는 맵 객체가 없습니다.");
    return;
  }
  
  try {
    console.log(`🔍 카테고리 ${categoryId} 장소 검색 (줌 레벨: ${zoomLevel})`);
    
    // 현재 지도 중심 좌표 가져오기
    const currentCenter = map.getCenter();
    const searchLat = currentCenter.getLat();
    const searchLng = currentCenter.getLng();
    
    console.log(`🌍 현재 좌표 (${searchLat}, ${searchLng}) 기준으로 검색합니다`);
    
    // 줌 레벨에 따른 검색 반경 설정
    let radius = 1000; // 기본값 1km
    
    // 줌 레벨별 반경 설정 (키가 존재하면 해당 값 사용)
    if (zoomLevel >= 1 && zoomLevel <= 7) {
      if (zoomLevel in ZOOM_LEVEL_RADIUS) {
        radius = ZOOM_LEVEL_RADIUS[zoomLevel as keyof typeof ZOOM_LEVEL_RADIUS];
      }
    }
    
    // 높은 줌 레벨에서는 반경을 더 넓게 조정 (멀리 보는 경우)
    if (zoomLevel <= 2) {
      radius = Math.min(radius * 1.5, 5000); // 최대 5km
    }
    
    // 카테고리 키워드 결정
    const categoryKey = categoryId.toString();
    let keyword = "장소";
    
    if (categoryKey in CATEGORY_KEYWORDS) {
      keyword = CATEGORY_KEYWORDS[categoryKey];
    }
    
    // 키워드 검색 (지역명 없이 카테고리만으로 검색)
    console.log(`🔍 검색: '${keyword}' - 반경 ${radius}m (${searchLat}, ${searchLng})`);
    
    // 기존 카테고리 마커 제거
    try {
      removeCategoryMarkers();
    } catch (e) {
      console.error("마커 제거 중 오류:", e);
    }
    
    // 검색 API 호출
    try {
      if (!window.kakao.maps.services) {
        console.error("카카오맵 서비스 API가 초기화되지 않았습니다.");
        return;
      }
      
      const places = new window.kakao.maps.services.Places();
      
      const callback = function(result: any, status: any) {
        if (status === window.kakao.maps.services.Status.OK) {
          console.log(`✅ 검색 성공: ${result.length}개 결과`);
          
          // 결과 수 제한 (최대 15개)
          const MAX_PLACES = 15;
          const limitedResults = result.slice(0, MAX_PLACES);
          
          if (limitedResults.length === 0) {
            console.log("💬 이 지역에 해당 카테고리의 장소가 없습니다.");
            return;
          }
          
          console.log(`🎯 ${limitedResults.length}개 마커 생성 시작`);
          
          // 각 장소에 마커 생성
          limitedResults.forEach((place: any, index: number) => {
            try {
              // 마커 생성
              const markerPosition = new window.kakao.maps.LatLng(place.y, place.x);
              
              // 기본 마커 이미지 사용 (더 안정적)
              const marker = new window.kakao.maps.Marker({
                position: markerPosition,
                map: map,
                title: place.place_name
              });
              
              // 마커 배열에 추가
              categoryMarkers.push(marker);
              console.log(`📍 마커 ${index + 1}/${limitedResults.length} 생성: ${place.place_name}`);
              
              // 인포윈도우 생성
              const infowindow = new window.kakao.maps.InfoWindow({
                content: `
                  <div style="padding:8px;font-size:14px;max-width:200px;">
                    <div style="font-weight:bold;margin-bottom:4px;">${place.place_name}</div>
                    <div style="font-size:12px;color:#777;">${place.address_name}</div>
                  </div>
                `
              });
              
              // 마커 클릭 시 인포윈도우 표시 및 상세 페이지 열기
              window.kakao.maps.event.addListener(marker, 'click', function() {
                // POI 핀 클릭 이벤트 추적
                trackPoiPinClick(
                  place.id,
                  place.place_name,
                  'kakao_api',
                  { lat: place.y, lng: place.x }
                );
                
                // 다른 인포윈도우 닫기
                categoryMarkers.forEach((m: any) => {
                  if (m.infowindow) {
                    m.infowindow.close();
                  }
                });
                
                // 이 마커의 인포윈도우 열기
                infowindow.open(map, marker);
                
                // 마커에 인포윈도우 참조 저장
                marker.infowindow = infowindow;
                
                // 상세 페이지 열기
                if (window.selectPlaceByKakaoPin) {
                  console.log("🔶 카카오 노란색 핀 클릭 -> 상세 페이지 열기");
                  // 장소 정보 전달하여 상세 페이지 표시
                  window.selectPlaceByKakaoPin(place);
                } else {
                  console.warn("🔶 전역 장소 선택 함수가 정의되지 않았습니다");
                }
              });
              
            } catch (err) {
              console.error(`마커 ${index + 1} 생성 오류:`, err);
            }
          });
          
          console.log(`🎉 카테고리 ${categoryId} 마커 생성 완료: ${categoryMarkers.length}개`);
          
        } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
          console.log("🔍 검색 결과가 없습니다.");
        } else {
          console.log(`❌ 검색 실패: ${status}`);
        }
      };
      
      // 검색 실행
      places.keywordSearch(keyword, callback, {
        location: new window.kakao.maps.LatLng(searchLat, searchLng),
        radius: radius,
        sort: window.kakao.maps.services.SortBy.DISTANCE // 거리순 정렬
      });
      
    } catch (searchError) {
      console.error("장소 검색 API 호출 중 오류:", searchError);
    }
    
  } catch (error) {
    console.error("카테고리 장소 검색 함수 실행 중 오류:", error);
  }
}

// 카테고리 마커를 생성하는 함수
export const addCategoryMarker = (
  position: { lat: string; lng: string },
  title: string = "",
  categoryId: number = 0
): any => {
  try {
    console.log(`🟢 카테고리 마커 생성: ${title} (카테고리 ${categoryId})`);
    
    // 전역 맵 객체에 접근
    const map = window.kakaoMap;
    if (!map) {
      console.error("전역 맵 객체가 없음");
      return null;
    }
    
    // 위치 객체 생성
    const markerPosition = new window.kakao.maps.LatLng(position.lat, position.lng);
    
    // 마커 생성
    const marker = new window.kakao.maps.Marker({
      position: markerPosition,
      map: map
    });
    
    // 마커에 정보 추가
    marker.title = title;
    marker.categoryId = categoryId;
    
    // 마커 클릭 시 이벤트 (상세 정보 표시 가능)
    window.kakao.maps.event.addListener(marker, 'click', function() {
      // POI 핀 클릭 이벤트 추적
      trackPoiPinClick(
        categoryId.toString(),
        title,
        'database',
        { lat: position.lat.toString(), lng: position.lng.toString() }
      );
      
      console.log(`카테고리 마커 클릭: ${title}, 카테고리: ${categoryId}`);
      
      // 지도 중심 이동
      map.panTo(markerPosition);
      
      // 추후 상세 정보 표시를 위한 이벤트 발생 가능
      if (window.dispatchEvent) {
        try {
          const event = new CustomEvent('markerClick', { 
            detail: { 
              title, 
              position,
              categoryId
            } 
          });
          window.dispatchEvent(event);
        } catch (e) {
          console.error("이벤트 발생 실패:", e);
        }
      }
    });
    
    // 전역 배열에 저장
    categoryMarkers.push(marker);
    
    console.log(`✅ 카테고리 마커 생성 성공 (총 ${categoryMarkers.length}개)`);
    return marker;
  } catch (e) {
    console.error("카테고리 마커 생성 실패:", e);
    return null;
  }
};

// 전역 카카오맵 객체를 사용하여 직접 마커를 생성하는 간단한 함수
export const addDirectMarker = (
  position: { lat: string; lng: string },
  title: string = ""
): any => {
  try {
    // 기존 마커 모두 제거
    removeCurrentSearchPinMarker();
    
    console.log("🔴 직접 마커 생성 시작:", position.lat, position.lng, title);
    
    // 전역 맵 객체에 접근
    const map = window.kakaoMap;
    if (!map) {
      console.error("전역 맵 객체가 없음");
      return null;
    }
    
    // 위치 객체 생성
    const markerPosition = new window.kakao.maps.LatLng(position.lat, position.lng);
    
    // 마커 생성
    const marker = new window.kakao.maps.Marker({
      position: markerPosition,
      map: map // 전역 맵 객체 사용
    });
    
    // 마커 클릭 시 이벤트 (디버깅용)
    window.kakao.maps.event.addListener(marker, 'click', function() {
      // POI 핀 클릭 이벤트 추적
      trackPoiPinClick(
        'direct_marker',
        title || '무제',
        'database',
        { lat: position.lat.toString(), lng: position.lng.toString() }
      );
      
      console.log(`마커 클릭됨: ${title || '무제'}`, position);
    });
    
    // 전역 변수에 저장
    currentSearchPinMarker = marker;
    
    // 지도 중심 이동 및 줌 레벨 조정
    map.setCenter(markerPosition);
    map.setLevel(2);
    
    console.log("✅ 직접 마커 생성 성공");
    return marker;
  } catch (e) {
    console.error("직접 마커 생성 실패:", e);
    return null;
  }
};