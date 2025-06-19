import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Category, Place, SearchResult } from "@shared/schema";
import { CategoryWithActive } from "@/types";
import { 
  searchPlaces as kakaoSearchPlaces, 
  removeCurrentSearchPinMarker,
  removeCategoryMarkers,
  addDirectMarker,
  addCategoryMarker
} from "@/lib/kakaoMap";
import { trackSearchSubmit, trackPlaceView, trackCategoryFilter, trackMapInteraction } from "@/lib/amplitude";

export const usePlaces = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [categories, setCategories] = useState<CategoryWithActive[]>([]);
  
  // Fetch categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });
  
  // 카테고리 정렬 순서 (1. 음식점, 2. 편의점, 3. 카페, 4. 쇼핑)
  const categoryOrder = {
    food: 1,       // 음식점
    convenience: 2, // 편의점
    cafe: 3,       // 카페
    shopping: 4     // 쇼핑
  };

  // Fetch all places
  const { data: placesData, isLoading: placesLoading } = useQuery<Place[]>({
    queryKey: ['/api/places'],
  });

  // Initialize categories with active state and sort them based on predefined order
  useEffect(() => {
    if (categoriesData) {
      // 먼저 카테고리 데이터를 커스텀 순서로 정렬
      const sortedCategories = [...categoriesData].sort((a, b) => {
        const orderA = categoryOrder[a.key as keyof typeof categoryOrder] || 999;
        const orderB = categoryOrder[b.key as keyof typeof categoryOrder] || 999;
        return orderA - orderB;
      });
      
      // 정렬된 카테고리에 active 속성 추가
      const categoriesWithActive = sortedCategories.map((category: Category) => ({
        ...category,
        active: false
      }));
      
      console.log("카테고리 정렬됨: 1.음식점, 2.편의점, 3.카페, 4.쇼핑");
      setCategories(categoriesWithActive);
    }
  }, [categoriesData]);
  
  // Cleanup markers when component unmounts
  useEffect(() => {
    return () => {
      console.log("Places 컴포넌트 언마운트: 마커 정리");
      try {
        removeCategoryMarkers();
        removeCurrentSearchPinMarker();
      } catch (e) {
        console.error("언마운트 시 마커 정리 실패:", e);
      }
    };
  }, []);

  // 카테고리별 장소 가져오기 - 카카오맵 API로 전환을 위해 마커 생성 비활성화
  const fetchPlacesByCategory = async (categoryId: number): Promise<Place[]> => {
    try {
      console.log(`카테고리 ${categoryId}의 장소 가져오기 (서버 API)`);
      // 서버 API 호출
      const places = await apiRequest<Place[]>(`/api/places/category/${categoryId}`, "GET");
      
      if (places && Array.isArray(places) && places.length > 0) {
        console.log(`카테고리 ${categoryId}에서 ${places.length}개의 장소 찾음 (서버 데이터)`);
        
        // 서버 API 결과는 마커 생성이나 지도 이동을 하지 않음
        // 카카오맵 API 검색 결과만 사용하기 위함
        console.log("💡 서버 API 결과로 마커 생성 및 지도 이동 생략 (카카오맵 API 우선)");
        
        return places;
      }
      return [];
    } catch (error) {
      console.error(`카테고리 ${categoryId} 장소 가져오기 실패:`, error);
      return [];
    }
  };

  // Update filtered places when categories or places change
  useEffect(() => {
    if (!placesData) return;
    
    const activeCategories = categories
      .filter(cat => cat.active)
      .map(cat => cat.id);
    
    const updatePlaces = async () => {
      if (activeCategories.length === 0) {
        // 선택된 카테고리가 없으면 빈 배열로 설정 (마커 없음)
        setFilteredPlaces([]);
      } else if (activeCategories.length === 1) {
        // 하나의 카테고리만 선택된 경우 API로 가져오기
        // 서버 API 대신 카카오맵 API로 직접 검색하기 위해
        // 서버 API 결과는 저장만 하고 마커 표시는 하지 않음
        const categoryPlaces = await fetchPlacesByCategory(activeCategories[0]);
        setFilteredPlaces(categoryPlaces);
        
        // 신촌 지역 검색을 위한 카카오맵 API 호출은
        // 선택 변경 시 toggleCategory 함수에서 직접 호출됨
        console.log("☝️ 카카오맵 API 검색은 toggleCategory 함수에서 수행");
      } else {
        // 여러 카테고리 선택은 현재 사용하지 않음 (하나만 선택 가능)
        console.log(`⚠️ 다중 카테고리 선택은 비활성화됨`);
        
        const categoryPlaces = await fetchPlacesByCategory(activeCategories[0]);
        setFilteredPlaces(categoryPlaces);
      }
    };
    
    updatePlaces();
  }, [categories, placesData]);

  // Handle search input (typing only - no tracking)
  const handleSearchInput = async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    try {
      // Use Kakao Maps API to search for places
      const results = await kakaoSearchPlaces(query);
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
      
      // No tracking here - only when actually executing search
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Execute search (with tracking) - called on Enter key or result selection
  const executeSearch = async (query: string) => {
    if (query.trim().length < 2) {
      return;
    }
    
    try {
      // Use Kakao Maps API to search for places
      const results = await kakaoSearchPlaces(query);
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
      
      // Track search submit event (only when search is actually executed)
      trackSearchSubmit(query, results.length);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      setShowSearchResults(false);
      
      // Track failed search
      trackSearchSubmit(query, 0);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // Toggle category filter - 하나의 카테고리만 선택되도록 수정
  const toggleCategory = (categoryId: number) => {
    console.log(`카테고리 토글: ID ${categoryId}`);
    
    // 선택 상태 변경 전에 이전 값 확인
    const category = categories.find(c => c.id === categoryId);
    const wasActive = category?.active || false;
    
    // 카테고리 활성화 상태 변경 - 하나만 선택 가능하도록 수정
    setCategories(prev => {
      // 이미 선택된 카테고리를 다시 클릭하면 모든 카테고리 비활성화
      if (wasActive) {
        const allDeactivated = prev.map(cat => ({ ...cat, active: false }));
        console.log("모든 카테고리 선택 해제됨");
        return allDeactivated;
      } 
      // 다른 카테고리 선택 시 기존 선택 모두 해제하고 새 카테고리만 활성화
      else {
        const newSelection = prev.map(cat => ({
          ...cat,
          active: cat.id === categoryId // 선택한 카테고리만 활성화
        }));
        
        const selectedCategory = prev.find(c => c.id === categoryId);
        console.log("카테고리 선택됨:", selectedCategory?.name || '알 수 없음');
        
        // Track category filter event
        if (selectedCategory) {
          trackCategoryFilter(categoryId, selectedCategory.name);
        }
        
        return newSelection;
      }
    });
    
    // 선택 상태 변경에 따른 마커 관리 (수정됨)
    try {
      if (window.kakaoMap) {
        // *** 중요: 모든 종류의 마커 정리 ***
        console.log("⚠️ 카테고리 변경: 모든 마커 초기화");
        
        // 카테고리 마커 제거
        removeCategoryMarkers();
        
        // 검색 마커 제거
        removeCurrentSearchPinMarker();
        
        // 카카오맵 API 마커도 제거 시도
        setTimeout(() => {
          try {
            if (window.kakao && window.kakao.maps) {
              // 현재 맵에 있는 모든 마커 제거 시도
              console.log("🧹 카카오맵 마커 정리 시도");
            }
          } catch (e) {
            console.error("마커 초기화 오류:", e);
          }
        }, 100);
        
        // 전역 변수에 선택된 카테고리 ID 설정 (또는 해제)
        if (wasActive) {
          // 선택 해제된 경우
          window.selectedCategoryId = undefined;
          console.log("전역 카테고리 ID 해제됨");
        } else {
          // 새 카테고리 선택된 경우
          window.selectedCategoryId = categoryId;
          console.log(`전역 카테고리 ID 설정됨: ${categoryId}`);
          
          // 사용자가 현재 보고 있는 지역 기준으로 검색하기
          // 현재 지도 중심 좌표 가져오기
          const currentCenter = window.kakaoMap.getCenter();
          const currentLat = currentCenter.getLat();
          const currentLng = currentCenter.getLng();
          
          // 현재 줌 레벨 유지 (사용자가 설정한 줌 레벨 사용)
          const currentLevel = window.kakaoMap.getLevel();
          
          console.log(`🌍 현재 지도 중심 (${currentLat}, ${currentLng})과 줌 레벨 ${currentLevel} 기준으로 검색합니다`);
          
          // 마커 제거 후 카카오맵 API로 검색
          setTimeout(() => {
            try {
              // 현재 줌 레벨에서 해당 카테고리의 장소 검색
              const currentLevel = window.kakaoMap.getLevel();
              
              console.log(`🎯 카테고리 ${categoryId} 마커 검색 시작 (줌 레벨: ${currentLevel})`);
              
              // 카카오맵 API로 직접 검색 - 서버 API 대신 사용
              import("@/lib/kakaoMap").then(module => {
                console.log("✅ 카카오맵 API 모듈 로드 완료");
                
                // 현재 지도 지역 내 카테고리 장소 검색 및 마커 표시
                module.searchCategoryPlacesByZoomLevel(window.kakaoMap, categoryId, currentLevel);
                
                console.log(`🚀 카테고리 ${categoryId} 검색 요청 완료`);
              }).catch(error => {
                console.error("카카오맵 API 모듈 로드 실패:", error);
              });
            } catch (error) {
              console.error("카테고리 검색 오류:", error);
            }
          }, 100); // 0.1초로 단축
        }
      }
    } catch (e) {
      console.error("카테고리 변경 시 마커 관리 오류:", e);
    }
    
    // 선택된 장소 초기화
    setSelectedPlace(null);
  };

  // Select a place from search results or place list
  const selectPlaceFromSearch = async (result: SearchResult) => {
    console.log("🔵 selectPlaceFromSearch 호출됨:", result.name);
    
    // 마커 클릭 핸들러를 일시적으로 비활성화
    window.disableMarkerClick = true;
    console.log("🔴 마커 클릭 비활성화됨");
    
    // Create a temporary place object from search result
    const place: Place = {
      id: parseInt(result.id),
      kakaoPlaceId: result.id,
      placeName: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      accessibilityScore: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: result.name,
      address: result.address,
      categoryId: 1,
      phone: "",
      facilities: []
    };
    
    console.log("🔵 selectPlace 호출 중 (selectPlaceFromSearch에서 접근성 점수 포함)");
    await selectPlace(place);
    setShowSearchResults(false);
    
    // 1초 후 마커 클릭 핸들러 재활성화
    setTimeout(() => {
      window.disableMarkerClick = false;
      console.log("🟢 마커 클릭 재활성화됨");
    }, 1000);
  };

  const selectPlace = async (place: Place) => {
    console.log("🟡 selectPlace 호출됨:", place.name);
    console.log("🟡 데이터베이스에서 접근성 점수 확인 중...");
    
    // Track place view event
    const accessibilityScore = place.accessibilityScore === null ? undefined : place.accessibilityScore;
    trackPlaceView(place.kakaoPlaceId, place.placeName || place.name || "Unknown Place", accessibilityScore);
    
    try {
      // 카카오 ID로 데이터베이스에서 접근성 점수 가져오기
      if (place.kakaoPlaceId) {
        // 장소 정보를 쿼리 파라미터로 포함하여 자동 생성 지원
        const queryParams = new URLSearchParams({
          placeName: place.placeName || place.name || '',
          latitude: place.latitude || '',
          longitude: place.longitude || ''
        });
        
        console.log("🔍 API 호출:", `/api/places/${place.kakaoPlaceId}?${queryParams.toString()}`);
        const response = await fetch(`/api/places/${place.kakaoPlaceId}?${queryParams.toString()}`);
        console.log("📡 API 응답 상태:", response.status);
        
        if (response.ok) {
          const dbPlace = await response.json();
          console.log("💾 데이터베이스에서 가져온 접근성 정보:", dbPlace);
          
          // 데이터베이스 정보와 병합
          const enrichedPlace = {
            ...place,
            accessibilityScore: dbPlace.accessibilityScore || null,
            accessibilitySummary: dbPlace.accessibilitySummary || null
          };
          
          console.log("✨ 접근성 정보가 병합된 장소:", enrichedPlace);
          setSelectedPlace(enrichedPlace);
          return;
        } else {
          console.log("❌ API 응답 실패:", response.status);
        }
      }
    } catch (error) {
      console.log("⚠️ 데이터베이스 접근성 정보 가져오기 실패:", error);
    }
    
    // 데이터베이스에서 정보를 가져올 수 없으면 원본 장소 사용
    console.log("🟡 setSelectedPlace 호출 중 (selectPlace) - 원본 데이터 사용");
    setSelectedPlace(place);
  };
  
  // 카카오맵 API에서 전역으로 접근할 수 있도록 함수 등록
  useEffect(() => {
    // 카카오 핀 클릭 시 장소 선택하는 함수를 전역 객체에 등록
    if (window) {
      window.selectPlaceByKakaoPin = async (kakaoPlace: any) => {
        try {
          // 마커 클릭이 비활성화된 경우 무시
          if (window.disableMarkerClick) {
            console.log("🚫 selectPlaceByKakaoPin - 마커 클릭 비활성화 상태로 무시됨");
            return;
          }
          
          console.log("🟠 selectPlaceByKakaoPin 호출됨:", kakaoPlace.place_name || kakaoPlace.name);
          
          // Kakao API 검색 결과를 Place 객체로 변환
          const place: Place = {
            id: parseInt(kakaoPlace.id) || Math.floor(Math.random() * 10000),
            kakaoPlaceId: kakaoPlace.id || "0",
            placeName: kakaoPlace.place_name || kakaoPlace.name || "알 수 없는 장소",
            latitude: kakaoPlace.y || kakaoPlace.latitude || "0",
            longitude: kakaoPlace.x || kakaoPlace.longitude || "0",
            accessibilityScore: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: kakaoPlace.place_name || kakaoPlace.name || "알 수 없는 장소",
            address: kakaoPlace.address_name || kakaoPlace.road_address_name || "",
            categoryId: window.selectedCategoryId || 1,
            phone: kakaoPlace.phone || "",
            facilities: []
          };
          
          console.log("🟠 selectPlace 호출 예정 (selectPlaceByKakaoPin에서)");
          // Places 컴포넌트의 선택 함수 호출 (비동기 대기)
          await selectPlace(place);
        } catch (e) {
          console.error("카카오 장소 선택 처리 오류:", e);
        }
      };
      
      console.log("카카오 마커 클릭 핸들러 등록 완료");
    }
    
    // 컴포넌트 언마운트 시 전역 함수 참조 제거
    return () => {
      if (window) {
        window.selectPlaceByKakaoPin = undefined;
      }
    };
  }, []);

  // Close place detail panel
  const closePlaceDetail = () => {
    setSelectedPlace(null);
  };

  // 현재 지도 위치에서 카테고리 검색 실행
  const searchAtCurrentLocation = () => {
    try {
      if (!window.kakaoMap) {
        console.error("카카오맵 객체가 초기화되지 않았습니다");
        return;
      }

      // 활성화된 카테고리 확인
      const activeCategories = categories
        .filter(cat => cat.active)
        .map(cat => cat.id);
      
      if (activeCategories.length === 0) {
        console.log("⚠️ 검색할 카테고리가 선택되지 않았습니다");
        // 선택된 카테고리가 없으면 알림이나 토스트 메시지를 표시할 수 있음
        return;
      }

      // 현재 지도 중심 좌표와 줌 레벨 가져오기
      const currentCenter = window.kakaoMap.getCenter();
      const currentLat = currentCenter.getLat();
      const currentLng = currentCenter.getLng();
      const currentLevel = window.kakaoMap.getLevel();

      console.log(`🔍 현재 위치에서 검색 실행: 카테고리 ID ${activeCategories[0]}`);
      console.log(`🌍 현재 좌표 (${currentLat}, ${currentLng}), 줌 레벨: ${currentLevel}`);

      // 카테고리 마커 제거
      removeCategoryMarkers();

      // 검색 마커 제거
      removeCurrentSearchPinMarker();

      // 카카오맵 API로 현재 위치 기반 검색 실행
      setTimeout(() => {
        import("@/lib/kakaoMap").then(module => {
          module.searchCategoryPlacesByZoomLevel(
            window.kakaoMap, 
            activeCategories[0], 
            currentLevel
          );
          console.log("✅ 현재 위치에서 카테고리 검색 완료");
        });
      }, 100);
    } catch (error) {
      console.error("현재 위치 검색 오류:", error);
    }
  };

  return {
    searchQuery,
    searchResults,
    showSearchResults,
    selectedPlace,
    filteredPlaces,
    categories,
    isLoading: categoriesLoading || placesLoading,
    handleSearchInput,
    executeSearch,
    clearSearch,
    toggleCategory,
    selectPlaceFromSearch,
    selectPlace,
    closePlaceDetail,
    searchAtCurrentLocation
  };
};
