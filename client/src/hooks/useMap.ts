import { useState, useEffect, useRef } from "react";
import { 
  initializeMap, 
  createMarker, 
  createCustomOverlay,
  getCurrentLocation,
  panTo,
  setMapType,
  zoomIn,
  zoomOut,
  removeCurrentSearchPinMarker, // 추가: 전역 핀 마커 제거 함수
  addDirectMarker // 추가: 직접 마커 생성 함수
} from "@/lib/kakaoMap";
import { KakaoMapOptions, MapMarker } from "@/types";
import { Place, SearchResult } from "@shared/schema";
import { trackPoiPinClick } from "@/lib/amplitude";

export const useMap = () => {
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapTypeState] = useState<'normal' | 'satellite'>('normal');
  const [searchPinMarker, setSearchPinMarker] = useState<any>(null); // 검색 핀 마커 저장용 상태
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Initialize the map
  useEffect(() => {
    const initMap = async () => {
      // Add a timeout to handle cases when the Kakao API fails to load
      const timeoutId = setTimeout(() => {
        console.warn("Map loading timeout - API key might be invalid or missing");
        setLoading(false);
      }, 10000); // Increase timeout for slow connections

      try {
        // Check for kakao API multiple times with increasing delays
        let waitTime = 500;
        let maxAttempts = 5;
        let attempts = 0;
        
        while (!window.kakao || !window.kakao.maps) {
          if (attempts >= maxAttempts) break;
          console.log(`Waiting for Kakao Maps SDK to load... (attempt ${attempts + 1}/${maxAttempts})`);
          // Exponential backoff waiting
          await new Promise(resolve => setTimeout(resolve, waitTime));
          waitTime *= 1.5; // Increase wait time for next attempt
          attempts++;
        }
        
        if (!window.kakao || !window.kakao.maps) {
          console.log("Using development fallback for Kakao Maps SDK");
          // Add a fallback mock version of kakao for development without API key
          window.kakao = { 
            maps: { 
              Map: function() { return { 
                setLevel: () => {},
                getLevel: () => 3,
                setMapTypeId: () => {},
                panTo: () => {}
              }; },
              LatLng: function() { return {}; },
              event: { addListener: () => {} },
              MapTypeId: { ROADMAP: 'ROADMAP', HYBRID: 'HYBRID' },
              services: { 
                Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT' },
                Places: function() {
                  return { keywordSearch: (q: string, callback: any) => callback([], 'ZERO_RESULT') };
                }
              },
              Marker: function() { 
                return { 
                  setMap: () => {},
                  getPosition: () => {}
                }; 
              },
              CustomOverlay: function() { 
                return { setMap: () => {} }; 
              }
            }
          };
        } else {
          console.log("Kakao Maps SDK loaded successfully");
        }

        // Wait a bit more after SDK is confirmed to be loaded to ensure it's fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));

        // Force reset the map container to make sure it has proper dimensions
        if (mapContainerRef.current) {
          mapContainerRef.current.style.width = "100%";
          mapContainerRef.current.style.height = "100%";
          mapContainerRef.current.style.minHeight = "500px";
        }

        // Initialize the map centered on Sinchon, Seodaemun-gu, Seoul with restricted bounds
        const mapInstance = await initializeMap(mapContainerRef.current, {
          center: {
            lat: "37.5559",
            lng: "126.9368"
          },
          level: 4, // Slightly zoomed out to show more of the area
          draggable: true,
          zoomable: true,
          restrictBounds: true // Enable boundary restriction
        });
        
        setMap(mapInstance);
        console.log("Map initialized successfully");
        
      } catch (error) {
        console.error("Failed to initialize map:", error);
      } finally {
        setLoading(false);
        clearTimeout(timeoutId);
      }
    };

    // Small delay before initializing map to make sure DOM is fully rendered
    const startupDelay = setTimeout(() => {
      initMap();
    }, 300);
    
    // Cleanup function - 코드 개선: 마커와 맵 객체 정리 추가
    return () => {
      clearTimeout(startupDelay);
      
      console.log("🧹 언마운트: 모든 마커와 맵 객체 정리");
      
      // 1. 검색 핀 마커 제거
      if (searchPinMarker) {
        try {
          searchPinMarker.setMap(null);
          console.log("✓ 언마운트 시 검색 핀 마커 제거됨");
        } catch (error) {
          console.error("언마운트 시 검색 핀 마커 제거 오류:", error);
        }
      }
      
      // 2. 전역 변수의 마커 제거
      try {
        removeCurrentSearchPinMarker();
        console.log("✓ 언마운트 시 전역 마커 제거됨");
      } catch (error) {
        console.error("언마운트 시 전역 마커 제거 오류:", error);
      }
      
      // 3. 일반 마커들도 제거
      markers.forEach(marker => {
        if (marker.markerRef) {
          try {
            marker.markerRef.setMap(null);
          } catch (e) {
            // 무시
          }
        }
      });
      
      // 4. 마지막으로 맵 정리 시도
      if (map) {
        try {
          // 마커가 표시되는 맵 요소 초기화
          const mapContainer = document.getElementById("map");
          if (mapContainer) {
            mapContainer.innerHTML = "";
          }
          console.log("✓ 맵 컨테이너 내용 초기화");
        } catch (e) {
          console.error("맵 컨테이너 초기화 오류:", e);
        }
      }
    };
  }, []);

  // Update markers when the places array changes
  const updateMarkers = (places: Place[]) => {
    if (!map || !places || places.length === 0) return;
    
    try {
      // Remove existing markers
      markers.forEach(marker => {
        if (marker.markerRef) {
          marker.markerRef.setMap(null);
        }
      });

      // In development mode without API key, just create marker objects without actual rendering
      if (!window.kakao || !window.kakao.maps || typeof window.kakao.maps.Marker !== 'function') {
        const mockMarkers = places.map(place => ({
          id: place.id,
          position: { lat: place.latitude, lng: place.longitude },
          place: place,
          markerRef: { setMap: () => {} }
        }));
        setMarkers(mockMarkers);
        return;
      }

      // Create new markers in production with API key
      const newMarkers = places.map(place => {
        try {
          const marker = createMarker(
            map, 
            { lat: place.latitude, lng: place.longitude },
            { color: '#FF5757' } // 일반 마커 색상
          );

          // Add click event to marker
          window.kakao.maps.event.addListener(marker, 'click', () => {
            const newMarker: MapMarker = {
              id: place.id,
              position: { lat: place.latitude, lng: place.longitude },
              place: place,
              markerRef: marker
            };
            setSelectedMarker(newMarker);
          });

          return {
            id: place.id,
            position: { lat: place.latitude, lng: place.longitude },
            place: place,
            markerRef: marker
          };
        } catch (err) {
          console.log("Error creating marker for place:", place.name);
          return {
            id: place.id,
            position: { lat: place.latitude, lng: place.longitude },
            place: place,
            markerRef: null
          };
        }
      });

      setMarkers(newMarkers);
    } catch (error) {
      console.error("Error updating markers:", error);
    }
  };
  
  // 검색 핀 마커 제거 함수 - 완전히 개선된 버전
  const removeSearchPinMarker = () => {
    console.log("🧹 고급 핀 마커 제거 함수 실행");
    
    // 1. React 상태로 관리 중인 마커 제거
    if (searchPinMarker) {
      try {
        console.log("1단계: React 상태의 마커 제거");
        searchPinMarker.setMap(null);
        console.log("✅ React 상태의 마커가 성공적으로 지도에서 제거됨");
      } catch (error) {
        console.error("❌ React 상태의 마커 제거 중 오류:", error);
      }
      
      // React 상태도 초기화
      setSearchPinMarker(null);
      console.log("React 상태 초기화 완료");
    } else {
      console.log("React 상태에 제거할 마커 없음");
    }
    
    // 2. 전역 변수로 관리 중인 마커 제거
    try {
      console.log("2단계: 전역 변수의 마커 제거");
      removeCurrentSearchPinMarker();
    } catch (error) {
      console.error("❌ 전역 변수의 마커 제거 중 오류:", error);
    }
    
    // 3. 카카오맵의 마지막 생성된 마커 제거 (추가 안전장치)
    try {
      console.log("3단계: 카카오맵 API에 마지막 생성된 마커 제거");
      if (window.kakao?.maps?.Marker?._lastCreatedMarker) {
        window.kakao.maps.Marker._lastCreatedMarker.setMap(null);
        window.kakao.maps.Marker._lastCreatedMarker = null;
        console.log("✅ 마지막 생성된 마커 제거 성공");
      } else {
        console.log("제거할 마지막 생성된 마커 없음");
      }
    } catch (error) {
      console.error("❌ 마지막 생성된 마커 제거 중 오류:", error);
    }
    
    // 4. 맵 객체 직접 접근 시도 (추가적인 안전 장치)
    if (map) {
      try {
        console.log("4단계: 맵 객체 내부 점검...");
        
        // 지도에 표시된 모든 객체 확인 (내부 구현이 있다면)
        if (typeof map.getObjects === 'function') {
          console.log("맵의 모든 객체 확인 중...");
        }
      } catch (error) {
        console.log("❌ 맵 객체 직접 접근 불가:", error);
      }
    }
    
    console.log("🏁 마커 제거 과정 완료");
  };

  // 검색 결과 표시를 위한 핀 마커를 생성하는 함수 - 단순화된 버전
  const addSearchResultMarker = (result: SearchResult) => {
    if (!map) return null;
    
    try {
      console.log("🔍 검색 결과 마커 생성:", result.name);
      
      // 1. 기존 마커 정리 및 상태 초기화
      // 단계를 간소화하고 일관된 방식으로 정리
      
      // 기존 React 상태의 마커 제거
      if (searchPinMarker) {
        try {
          searchPinMarker.setMap(null);
        } catch (e) {
          // 무시
        }
        setSearchPinMarker(null);
      }
      
      // 전역 마커 정리 함수 호출 - 모든 핀 마커 정리
      removeCurrentSearchPinMarker();
      
      // 2. 지도 위치 이동 및 확대
      panTo(map, { lat: result.latitude, lng: result.longitude });
      
      // 지도 확대 (더 가깝게 보기)
      if (typeof map.setLevel === 'function') {
        map.setLevel(2);
      }
      
      // 3. 개선된 createMarker 함수로 마커 생성
      const newMarker = createMarker(
        map,
        { lat: result.latitude, lng: result.longitude },
        { 
          isSearchResult: true,
          zIndex: 9999,
          id: `search-${result.id || Date.now()}`
        }
      );
      
      // 4. 생성된 마커 확인 및 상태 저장
      if (newMarker) {
        // React 상태 업데이트
        setSearchPinMarker(newMarker);
        
        // 추가 안전장치: 맵에 명시적으로 추가
        if (typeof newMarker.getMap !== 'function' || !newMarker.getMap()) {
          newMarker.setMap(map);
        }
        
        return newMarker;
      } else {
        console.error("마커 생성 실패");
        return null;
      }
    } catch (error) {
      console.error("💥 전체 마커 생성 과정 실패:", error);
      return null;
    }
  };

  // Move to current location
  const moveToCurrentLocation = async () => {
    try {
      const position = await getCurrentLocation();
      if (map) {
        panTo(map, position);
      }
    } catch (error) {
      console.error("Failed to get current location:", error);
    }
  };

  // Toggle map type
  const toggleMapType = () => {
    if (!map) return;
    
    const newType = mapType === 'normal' ? 'satellite' : 'normal';
    setMapType(map, newType);
    setMapTypeState(newType);
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (map) zoomIn(map);
  };

  const handleZoomOut = () => {
    if (map) zoomOut(map);
  };

  // Move the map to show a specific place
  const moveToPlace = (place: Place) => {
    if (!map) return;
    
    // 1. 지도 위치 이동
    panTo(map, { lat: place.latitude, lng: place.longitude });
    
    // 2. 마커 표시 - 전역 카카오맵을 사용하는 방식
    try {
      // addDirectMarker 함수를 이미 위에서 import했으므로 직접 사용
      setTimeout(() => {
        // 직접 마커 생성 - 전역 객체 활용
        addDirectMarker(
          { lat: place.latitude, lng: place.longitude },
          place.name
        );
      }, 100);
    } catch (e) {
      console.error("마커 생성 중 오류:", e);
    }
    
    // 3. 기존 로직 - 마커 선택
    const marker = markers.find(m => m.id === place.id);
    if (marker) {
      setSelectedMarker(marker);
    }
  };

  return {
    map,
    markers,
    selectedMarker,
    loading,
    mapType,
    mapContainerRef,
    updateMarkers,
    moveToCurrentLocation,
    toggleMapType,
    handleZoomIn,
    handleZoomOut,
    moveToPlace,
    setSelectedMarker,
    addSearchResultMarker, // 검색 결과 마커 추가 함수 내보내기
    removeSearchPinMarker  // 검색 핀 마커 제거 함수 내보내기
  };
};
