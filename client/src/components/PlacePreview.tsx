import { Place } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronRight, X, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { removeCurrentSearchPinMarker } from "@/lib/kakaoMap";
import { useToast } from "@/hooks/use-toast";
import { isLoggedInWithKakao, loginWithKakao } from "@/lib/kakaoAuth";
import { trackBookmarkAction } from "@/lib/amplitude";

interface PlacePreviewProps {
  place: Place;
  onViewDetails: () => void;
  onClose: () => void;
}

export default function PlacePreview({
  place,
  onViewDetails,
  onClose,
}: PlacePreviewProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // 사용자 정보 가져오기
  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/auth/kakao/user', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUserId(userData.id?.toString());
      }
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error);
    }
  };

  // 로그인 상태 확인
  useEffect(() => {
    const loginStatus = isLoggedInWithKakao();
    setIsLoggedIn(loginStatus);
    
    if (loginStatus) {
      fetchUserInfo();
    }
    
    // 이벤트 리스너 등록 (로그인 상태 변경 시 호출)
    const handleLoginStatusChange = () => {
      setIsLoggedIn(isLoggedInWithKakao());
    };
    
    window.addEventListener("kakaoLoginStatusChanged", handleLoginStatusChange);
    
    return () => {
      window.removeEventListener("kakaoLoginStatusChanged", handleLoginStatusChange);
    };
  }, []);

  // 북마크 기능이 제거되었습니다

  // 컴포넌트가 언마운트될 때 마커를 제거하는 효과 추가
  useEffect(() => {
    // 컴포넌트가 마운트될 때는 아무 작업도 하지 않음
    
    // 컴포넌트가 언마운트될 때 마커 제거 (클린업 함수)
    return () => {
      console.log("💥 PlacePreview 컴포넌트 언마운트: 마커 자동 제거");
      try {
        // 전역 함수 직접 호출하여 마커 제거
        removeCurrentSearchPinMarker();
      } catch (e) {
        console.error("언마운트 시 마커 제거 오류:", e);
      }
    };
  }, []);

  // 북마크 상태 조회 API 호출
  const checkBookmarkStatus = async () => {
    if (!isLoggedIn || !userId) return;
    
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/bookmarks/${userId}/${place.id}/status`);
      if (response.ok) {
        const data = await response.json();
        setIsBookmarked(data.isBookmarked);
      }
    } catch (error) {
      console.error("북마크 상태 확인 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 북마크 추가/제거
  const toggleBookmark = async () => {
    // 로그인 확인
    if (!isLoggedIn || !userId) {
      toast({
        title: "로그인 필요",
        description: "북마크 기능을 사용하려면 로그인해주세요.",
        duration: 3000,
      });
      
      // 로그인 안내만 표시, 리다이렉트 없음
      return;
    }
    
    try {
      setIsLoading(true);
      
      if (isBookmarked) {
        // 북마크 제거
        const response = await fetch(`/api/bookmarks/${userId}/${place.id}`, {
          method: "DELETE",
        });
        
        if (response.ok) {
          setIsBookmarked(false);
          
          // Track bookmark removal
          trackBookmarkAction('remove', place.kakaoPlaceId, place.placeName || "Unknown Place");
          
          toast({
            title: "북마크 제거",
            description: "북마크가 제거되었습니다.",
            duration: 2000,
          });
        }
      } else {
        // 북마크 추가
        const response = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            userId: parseInt(userId),
            placeId: parseInt(place.kakaoPlaceId || place.id?.toString() || "0"),
            placeName: place.placeName || "Unknown Place",
            placeAddress: place.address || "",
            placeLatitude: place.latitude,
            placeLongitude: place.longitude,
          }),
        });
        
        if (response.ok) {
          setIsBookmarked(true);
          
          // Track bookmark addition
          trackBookmarkAction('add', place.kakaoPlaceId, place.placeName || "Unknown Place");
          
          toast({
            title: "북마크 추가",
            description: "북마크가 추가되었습니다.",
            duration: 2000,
          });
        }
      }
    } catch (error) {
      console.error("북마크 토글 오류:", error);
      toast({
        title: "오류 발생",
        description: "북마크 처리 중 오류가 발생했습니다.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 닫기 버튼 클릭 핸들러 개선
  const handleClose = () => {
    console.log("장소 미리보기 닫기 버튼 클릭 - 개선된 처리");
    
    // 1. 직접 마커 제거 시도
    try {
      console.log("마커 직접 제거 시도");
      removeCurrentSearchPinMarker();
    } catch (e) {
      console.error("마커 제거 오류:", e);
    }
    
    // 2. 부모 컴포넌트의 닫기 핸들러 호출 (기존 로직)
    onClose();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg z-40 p-4">
      {/* 닫기 버튼 추가 - 개선된 핸들러 사용 */}
      <button 
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        onClick={handleClose}
      >
        <X className="h-5 w-5" />
      </button>
      
      <div className="flex justify-between items-start">
        <div className="flex-1 mr-4">
          <div className="flex items-center">
            <h3 className="font-bold text-gray-900 text-lg">{place.name}</h3>
            {/* 북마크 버튼 - 상태에 따라 다른 스타일로 표시 */}
            <button
              onClick={toggleBookmark}
              disabled={isLoading}
              className={`ml-2 p-1 rounded-full bookmark-btn ${
                isBookmarked 
                  ? "text-yellow-500" 
                  : "text-gray-400 hover:text-yellow-500"
              }`}
            >
              <Star className={`h-5 w-5 ${isBookmarked ? "fill-yellow-500" : ""}`} />
            </button>
          </div>
          <div className="flex items-center text-gray-500 mt-1">
            <MapPin className="h-4 w-4 mr-1" />
            <p className="text-sm truncate">{place.address}</p>
          </div>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center"
          onClick={onViewDetails}
        >
          <span>장소 정보 확인</span>
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}