import React, { useState, useEffect, useRef } from "react";
import UnifiedHeader from "@/components/UnifiedHeader";
import MapContainer from "@/components/MapContainer";


import PlaceDetailsWithAccessibility from "@/components/PlaceDetailsWithAccessibility";
import CategoryFilter from "@/components/CategoryFilter";
// import OnboardingDialog from "@/components/OnboardingDialog";
import { useMap } from "@/hooks/useMap";
import { usePlaces } from "@/hooks/usePlaces";
import { useIsMobile } from "@/hooks/use-mobile";
import { isLoggedInWithKakao, handleAuthCallback } from "@/lib/kakaoAuth";
import { addDirectMarker } from "@/lib/kakaoMap";
import { trackUserSessionStart, captureUTMParameters } from "@/lib/amplitude";

export default function MapPage() {
  const isMobile = useIsMobile();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAccessibilityDetails, setShowAccessibilityDetails] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const {
    mapContainerRef,
    loading: mapLoading,
    updateMarkers,
    moveToPlace,
    selectedMarker,
    setSelectedMarker,
    moveToCurrentLocation,
    toggleMapType,
    handleZoomIn,
    handleZoomOut,
    addSearchResultMarker, // 검색 결과 마커 추가 함수 가져오기
    removeSearchPinMarker // 검색 핀 마커 제거 함수 가져오기
  } = useMap();

  const {
    searchQuery,
    searchResults,
    showSearchResults,
    selectedPlace,
    filteredPlaces,
    categories,
    isLoading: placesLoading,
    handleSearchInput,
    executeSearch,
    clearSearch,
    selectPlaceFromSearch,
    selectPlace,
    closePlaceDetail,
    toggleCategory,
    searchAtCurrentLocation
  } = usePlaces();

  // Use a ref to track the filtered places and avoid infinite loops
  const placesRef = useRef('');

  // Update markers when filtered places change
  useEffect(() => {
    if (filteredPlaces && filteredPlaces.length > 0) {
      // Use a more stable dependency check to prevent infinite updates
      const placeIds = JSON.stringify(filteredPlaces.map(p => p.id).sort());

      // Only update if the places have actually changed
      if (placesRef.current !== placeIds) {
        placesRef.current = placeIds;
        updateMarkers(filteredPlaces);
      }
    }
  }, [filteredPlaces, updateMarkers]);

  // Update selected place when marker is clicked
  useEffect(() => {
    if (selectedMarker) {
      selectPlace(selectedMarker.place);
    }
  }, [selectedMarker]);

  // Move to the selected place on the map and handle marker display
  useEffect(() => {
    if (selectedPlace) {
      // 일반 장소 이동
      moveToPlace(selectedPlace);
    }
  }, [selectedPlace]);

  // Place가 선택 해제될 때 처리 (모든 모달 닫기)
  useEffect(() => {
    if (!selectedPlace) {
      setShowAccessibilityDetails(false);
    }
  }, [selectedPlace]);

  // URL에서 인증 코드 처리
  useEffect(() => {
    // 카카오 OAuth 콜백 처리
    const processAuth = async () => {
      try {
        const authSuccess = await handleAuthCallback();
        if (authSuccess) {
          console.log('카카오 로그인 성공');
          // 로그인 성공 시 온보딩 표시하지 않음
          setShowOnboarding(false);
        }
      } catch (error) {
        console.error('OAuth 처리 중 오류:', error);
      }
    };

    processAuth();
  }, []);

  // 북마크에서 장소 보기 함수
  const handleViewPlaceFromBookmark = async (placeId: string) => {
    console.log('북마크에서 장소 보기 요청:', placeId);

    try {
      // 장소 정보 가져오기 (카카오 POI ID로 검색)
      const response = await fetch(`/api/places`);
      if (response.ok) {
        const places = await response.json();
        const place = places.find((p: any) => p.kakaoPlaceId === placeId);
        
        if (place) {
          console.log('장소 정보 로드 성공:', place.placeName);
          selectPlace(place);
          moveToPlace({
            latitude: place.latitude,
            longitude: place.longitude
          });
        } else {
          console.error('장소 정보를 찾을 수 없습니다');
        }
      } else {
        console.error('장소 목록을 가져올 수 없습니다');
      }
    } catch (error) {
      console.error('장소 정보 로드 실패:', error);
    }
  };

  useEffect(() => {
    const handleViewPlace = async (event: CustomEvent) => {
      const { placeId } = event.detail;
      await handleViewPlaceFromBookmark(placeId);
    };

    // 이벤트 리스너 등록
    window.addEventListener('viewPlace', handleViewPlace as EventListener);

    // 클린업
    return () => {
      window.removeEventListener('viewPlace', handleViewPlace as EventListener);
    };
  }, [selectPlace, moveToPlace]);

  // 페이지 로드 시 세션 시작 이벤트 트래킹 및 UTM 파라미터 캡처
  useEffect(() => {
    const isLoggedIn = isLoggedInWithKakao();

    // UTM 파라미터 캡처 (첫 번째로 실행)
    const utmParams = captureUTMParameters();

    // 세션 시작 이벤트 트래킹 (UTM 정보 포함)
    trackUserSessionStart(isLoggedIn);

    // UTM 파라미터가 감지된 경우 로그 출력
    if (utmParams && Object.keys(utmParams).length > 0) {
      console.log('📊 UTM 마케팅 파라미터 캡처됨:', utmParams);
    }
  }, []);

  // 온보딩 다이얼로그 표시 여부 결정
  useEffect(() => {
    // 로그인 상태나 온보딩 스킵 여부 확인
    const isLoggedIn = isLoggedInWithKakao();
    const skipOnboarding = localStorage.getItem("skipOnboarding") === "true";

    // 로그인하지 않았고, 온보딩을 스킵하지 않았으면 온보딩 표시
    if (!isLoggedIn && !skipOnboarding) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, []);

  // 접근성 정보 확인 핸들러
  const handleAccessibilityCheck = () => {
    setShowAccessibilityDetails(true);
  };

  // 장소 정보 모달 닫기
  const handleClosePlaceInfo = () => {
    closePlaceDetail();
    clearSearch(); // 검색어도 함께 초기화
  };

  // 접근성 상세 모달 닫기  
  const handleCloseAccessibilityDetails = () => {
    setShowAccessibilityDetails(false);
  };

  // 온보딩 닫기 처리
  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* 온보딩 다이얼로그 - 임시 비활성화 */}
      {/* {showOnboarding && (
        <OnboardingDialog onClose={handleCloseOnboarding} />
      )} */}

      {/* Search at the top */}
      <div className="w-full">
        <UnifiedHeader
          mode="search"
          searchQuery={searchQuery}
          searchResults={searchResults}
          showResults={showSearchResults}
          handleSearchInput={handleSearchInput}
          executeSearch={executeSearch}
          clearSearch={() => {
            // 검색어 초기화
            clearSearch();
            // 검색 핀 마커도 함께 제거
            removeSearchPinMarker();
          }}
          onHistoryVisibilityChange={setIsSearchActive}
          onViewPlace={handleViewPlaceFromBookmark}
          selectResult={(result) => {
            // 안전하게 기존 핀 마커 제거 (중복 마커 방지)
            removeSearchPinMarker();

            // 검색 결과를 선택하면 핀 마커 추가 및 장소 선택
            selectPlaceFromSearch(result);

            // 새롭게 추가한 함수를 사용하여 마커 생성
            setTimeout(() => {
              // 간단한 방식으로 마커 생성 (1초 지연)
              addDirectMarker(
                { lat: result.latitude, lng: result.longitude },
                result.name
              );
            }, 300);
          }}
        />
      </div>

      {/* Map takes the rest of the screen */}
      <div className="flex-1 relative overflow-hidden">
        {/* 카테고리 필터 추가 - 검색 관련 요소가 활성화될 때는 숨김 */}
        {!placesLoading && categories.length > 0 && !isSearchActive && (
          <CategoryFilter 
            categories={categories} 
            toggleCategory={toggleCategory} 
          />
        )}

        <MapContainer 
          mapRef={mapContainerRef}
          loading={mapLoading}
          selectedPlace={selectedPlace}
          closePlaceDetail={handleClosePlaceInfo}
          moveToCurrentLocation={moveToCurrentLocation}
          toggleMapType={toggleMapType}
          zoomIn={handleZoomIn}
          zoomOut={handleZoomOut}
          togglePlacesList={() => {}}
          searchCurrentLocation={searchAtCurrentLocation}
          isMobile={isMobile}
          onAccessibilityCheck={handleAccessibilityCheck}
        />



        {/* 2단계: 접근성 상세 모달 */}
        {selectedPlace && showAccessibilityDetails && (
          <PlaceDetailsWithAccessibility
            place={selectedPlace}
            onClose={handleCloseAccessibilityDetails}
          />
        )}
      </div>
    </div>
  );
}