import { useState, useEffect } from "react";
import { Star, LogIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { loginWithKakao, isLoggedInWithKakao } from "@/lib/kakaoAuth";
import { toast } from "@/hooks/use-toast";

interface OnboardingDialogProps {
  onClose: () => void;
}

export default function OnboardingDialog({ onClose }: OnboardingDialogProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showDialog, setShowDialog] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // 컴포넌트 마운트 시 로그인 상태 확인
  useEffect(() => {
    // 로그인 상태 확인
    if (isLoggedInWithKakao()) {
      setIsLoggedIn(true);
      setShowDialog(false);
    }
    
    // 온보딩 스킵 여부 확인
    const skipOnboarding = localStorage.getItem("skipOnboarding");
    if (skipOnboarding === "true") {
      setShowDialog(false);
    }
  }, []);

  // 카카오 로그인 처리 함수 (REST API 방식)
  const handleKakaoLogin = () => {
    setIsLoading(true);
    try {
      // REST API 방식 로그인 시작
      const loginStarted = loginWithKakao();
      
      // 로그인 시작에 실패한 경우
      if (loginStarted === false) {
        console.error("카카오 로그인 시작 실패");
        toast({
          title: "로그인 실패",
          description: "카카오 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.",
          variant: "destructive",
          duration: 5000,
        });
        setIsLoading(false);
      } else {
        // 성공적으로 로그인 프로세스가 시작되면 타임아웃 설정 (리다이렉트가 발생해야 함)
        setTimeout(() => {
          setIsLoading(false);
        }, 5000);
      }
    } catch (error) {
      console.error("카카오 로그인 시작 실패", error);
      toast({
        title: "로그인 실패",
        description: "카카오 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.",
        variant: "destructive",
        duration: 5000,
      });
      setIsLoading(false);
    }
  };

  // 로그인 없이 계속하기
  const handleContinueWithoutLogin = () => {
    localStorage.setItem("skipOnboarding", "true");
    setShowDialog(false);
    onClose();
  };

  // 다이얼로그가 닫힐 때 처리
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      localStorage.setItem("skipOnboarding", "true");
      onClose();
    }
    setShowDialog(open);
  };

  return (
    <Dialog open={showDialog} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-3">
            <Star className="h-8 w-8 text-yellow-400 mr-2" fill="#FACC15" />
            <DialogTitle className="text-xl font-bold text-gray-900">
              별안간출발에 오신 것을 환영합니다
            </DialogTitle>
          </div>
          <DialogDescription className="text-center">
            전동보장구 사용자들을 위한 배리어프리 장소 검색 지도입니다.
            신촌 지역의 접근성 정보를 쉽게 찾을 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">주요 기능</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="mr-2">•</span> 
                <span>신촌 지역 내 식당, 카페 등의 <b>접근성 정보 제공</b></span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span> 
                <span>출입구, 엘리베이터, 화장실 등의 <b>상세 접근성 정보</b></span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span> 
                <span>자주 방문하는 장소를 <b>북마크</b>로 저장</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span> 
                <span>누락된 접근성 정보 <b>직접 업로드</b> 가능</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-medium text-yellow-800 mb-2">로그인 안내</h3>
            <p className="text-sm text-yellow-700">
              로그인하시면 정보 업로드, 리뷰 작성 등 더 많은 기능을 사용하실 수 있습니다.
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button 
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-white flex items-center justify-center"
            onClick={handleKakaoLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                로그인 중...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                카카오 계정으로 로그인
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleContinueWithoutLogin}
            disabled={isLoading}
          >
            로그인 없이 계속하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
