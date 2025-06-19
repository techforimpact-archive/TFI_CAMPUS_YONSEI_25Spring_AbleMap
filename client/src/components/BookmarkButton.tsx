
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Place } from "@shared/schema";
import { trackOnboardingAction, trackEvent } from "@/lib/amplitude";
import { isLoggedInWithKakao } from "@/lib/kakaoAuth";
import UserProfileDialog from "@/components/UserProfileDialog";
import { useBookmarks } from "@/hooks/useBookmarks";

interface BookmarkButtonProps {
  place: Place;
  className?: string;
}

export default function BookmarkButton({ place, className }: BookmarkButtonProps) {
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { toast } = useToast();
  
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();

  // 로그인 상태 실시간 감지
  useEffect(() => {
    const checkLoginStatus = () => {
      const loginStatus = isLoggedInWithKakao();
      setIsLoggedIn(loginStatus);
    };

    checkLoginStatus();
    window.addEventListener('kakaoLoginStatusChanged', checkLoginStatus);
    
    return () => {
      window.removeEventListener('kakaoLoginStatusChanged', checkLoginStatus);
    };
  }, []);

  const handleLoginRequired = () => {
    trackOnboardingAction('login_button_click');
    setShowLoginDialog(true);
  };

  const toggleBookmark = async () => {
    trackEvent('modal_bookmark_click', {
      place_id: place.kakaoPlaceId || place.id?.toString(),
      place_name: place.placeName || "Unknown Place",
      is_logged_in: isLoggedIn,
      current_bookmark_status: isBookmarked(place.kakaoPlaceId),
      timestamp: new Date().toISOString()
    });

    if (!isLoggedIn) {
      const { dismiss } = toast({
        title: "로그인 필요",
        description: (
          <div className="flex items-center justify-between">
            <span>북마크 기능을 사용하려면 로그인해주세요.</span>
            <button
              onClick={() => {
                handleLoginRequired();
                dismiss();
              }}
              className="ml-3 bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              로그인
            </button>
          </div>
        ),
        duration: 5000,
      });
      return;
    }

    if (!place.kakaoPlaceId) {
      toast({
        title: "오류",
        description: "장소 정보를 찾을 수 없습니다.",
        duration: 3000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const currentBookmarkStatus = isBookmarked(place.kakaoPlaceId);
      let success = false;
      
      if (currentBookmarkStatus) {
        success = await removeBookmark(place.kakaoPlaceId, place.placeName);
        if (success) {
          toast({
            title: "북마크 제거",
            description: "북마크가 제거되었습니다.",
            duration: 2000,
          });
        }
      } else {
        success = await addBookmark(place.kakaoPlaceId, place.placeName);
        if (success) {
          toast({
            title: "북마크 추가",
            description: "북마크가 추가되었습니다.",
            duration: 2000,
          });
        }
      }

      if (!success) {
        throw new Error("북마크 처리에 실패했습니다.");
      }
    } catch (error) {
      console.error("북마크 토글 오류:", error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "북마크 처리 중 오류가 발생했습니다.",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentBookmarkStatus = isBookmarked(place.kakaoPlaceId);

  return (
    <>
      <Button
        onClick={toggleBookmark}
        disabled={isLoading}
        variant={currentBookmarkStatus ? "default" : "outline"}
        size="sm"
        className={className}
      >
        <Star 
          className={`w-4 h-4 mr-1 ${currentBookmarkStatus ? 'fill-current' : ''}`}
        />
        {isLoading ? "처리중..." : currentBookmarkStatus ? "북마크됨" : "북마크"}
      </Button>
      
      <UserProfileDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
      />
    </>
  );
}
