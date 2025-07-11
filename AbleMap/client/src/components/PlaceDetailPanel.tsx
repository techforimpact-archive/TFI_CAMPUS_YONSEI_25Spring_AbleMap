import { useEffect, useState } from "react";
import { Place, Facility } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { X, Phone, MapPin, Clock, Link, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BookmarkButton from "@/components/BookmarkButton";
import { isLoggedInWithKakao } from "@/lib/kakaoAuth";
import { trackAccessibilityReport, trackAccessibilityInfoMissingView } from "@/lib/amplitude";

interface PlaceDetailPanelProps {
  selectedPlace: Place;
  closePlaceDetail: () => void;
  isMobile: boolean;
  onAccessibilityCheck?: () => void;
}

export default function PlaceDetailPanel({
  selectedPlace,
  closePlaceDetail,
  isMobile,
  onAccessibilityCheck,
}: PlaceDetailPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const loggedIn = isLoggedInWithKakao();
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        try {
          const accessToken = localStorage.getItem("kakao_access_token");
          const headers: HeadersInit = {};

          if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
          }

          const response = await fetch("/api/auth/kakao/user", { headers });
          if (response.ok) {
            const userData = await response.json();
            setCurrentUser(userData);
          }
        } catch (error) {
          console.error("사용자 정보 가져오기 오류:", error);
        }
      } else {
        setCurrentUser(null);
      }
    };

    checkLoginStatus();
  }, []);

  useEffect(() => {
    console.log("🎯 PlaceDetailPanel 렌더링됨:", selectedPlace?.name);
    console.log("📊 접근성 점수 디버그:", {
      accessibilityScore: selectedPlace?.accessibilityScore,
      accessibilitySummary: selectedPlace?.accessibilitySummary,
      전체객체: selectedPlace
    });
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedPlace]);

  const getCategoryColor = (categoryId: number) => {
    switch (categoryId) {
      case 1: return "bg-red-500";
      case 2: return "bg-blue-500";
      case 3: return "bg-amber-500";
      case 4: return "bg-purple-500";
      default: return "bg-gray-500";
    }
  };

  const getCategoryName = (categoryId: number) => {
    switch (categoryId) {
      case 1: return "음식점";
      case 2: return "편의점";
      case 3: return "카페";
      case 4: return "쇼핑";
      default: return "기타";
    }
  };

  let facilities: Facility[] = [];
  if (selectedPlace?.facilities && Array.isArray(selectedPlace.facilities)) {
    facilities = selectedPlace.facilities;
  } else {
    facilities = [
      { name: "주차 가능", available: true },
      { name: "Wi-Fi", available: true },
      { name: "콘센트", available: true },
      { name: "흡연 불가", available: false },
    ];
  }

  if (!selectedPlace) return null;

  return (
    <div
      className={`absolute ${
        isMobile 
          ? "bottom-0 left-0 right-0 h-[80vh] flex flex-col" 
          : "right-4 bottom-4 w-96 h-[80vh] flex flex-col"
      } bg-white rounded-t-lg md:rounded-lg shadow-lg transition-transform transform ${
        isMobile
          ? isVisible ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-full opacity-0 pointer-events-none"
          : isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      } z-30 info-panel`}
    >
      <div className="flex-1 overflow-y-auto p-4" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-gray-800">{selectedPlace.name}</h3>
          <div className="flex items-center gap-2">
            <BookmarkButton 
              place={selectedPlace}
              className="text-xs"
            />
            <Button
              variant="ghost"
              size="sm"
              className="p-1.5 rounded-full hover:bg-gray-100"
              onClick={closePlaceDetail}
            >
              <X className="h-5 w-5 text-gray-500" />
            </Button>
          </div>
        </div>

        {/* <div className="mt-1">
          <span className={`inline-block ${getCategoryColor(selectedPlace.categoryId)} text-white text-xs px-2 py-0.5 rounded-full`}>
            {getCategoryName(selectedPlace.categoryId)}
          </span>
        </div> */}

        <div className="mt-3 space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
            <span>{selectedPlace.address || "주소 정보 없음"}</span>
          </div>
          {selectedPlace.phone && (
            <div className="flex items-center text-sm text-gray-600">
              <Phone className="h-4 w-4 mr-2 text-gray-400" />
              <span>{selectedPlace.phone}</span>
            </div>
          )}
          {selectedPlace.kakaoUrl && (
            <div className="flex items-center text-sm text-gray-600">
              <Link className="h-4 w-4 mr-2 text-gray-400" />
              <a href={selectedPlace.kakaoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                카카오맵에서 보기
              </a>
            </div>
          )}
        </div>

        {selectedPlace.accessibilityScore !== null && (
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(255, 215, 0, 0.2)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-black">접근성 점수</span>
              <div className="flex items-center">
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                <span className="ml-1 text-sm font-bold text-black">
                  {selectedPlace.accessibilityScore}/10
                </span>
              </div>
            </div>
            {selectedPlace.accessibilitySummary && (
              <p className="mt-2 text-xs text-black">{selectedPlace.accessibilitySummary}</p>
            )}
          </div>
        )}

        {/* 편의시설 섹션 주석처리 */}
        {/* <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">편의시설</h4>
          <div className="grid grid-cols-2 gap-2">
            {facilities.map((facility, index) => (
              <div
                key={index}
                className={`text-xs px-2 py-1.5 rounded ${
                  facility.available ? "text-black" : "bg-gray-100 text-gray-600"
                }`}
                style={facility.available ? { backgroundColor: 'rgba(255, 215, 0, 0.2)' } : {}}
              >
                <span className="font-medium">{facility.name}</span>
                <span className="ml-1">{facility.available ? "✓" : "✗"}</span>
              </div>
            ))}
          </div>
        </div> */}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <Button
            className="w-full text-black hover:opacity-80"
            style={{ backgroundColor: '#FFD700' }}
            onClick={() => {
              // Track accessibility report view
              trackAccessibilityReport(
                selectedPlace.kakaoPlaceId || selectedPlace.id?.toString() || 'unknown',
                selectedPlace.accessibilityScore || 0
              );
              
              if (onAccessibilityCheck) onAccessibilityCheck();
            }}
          >
            <div className="flex items-center justify-center">
              <span>접근성 정보 확인</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}