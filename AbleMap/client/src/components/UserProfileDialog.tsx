import { useState, useEffect } from "react";
import { User, LogOut, LogIn, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KakaoUserInfo, loginWithKakao, logoutWithKakao, getKakaoUserInfo, isLoggedInWithKakao } from "@/lib/kakaoAuth";
import { toast } from "@/hooks/use-toast";
import { trackOnboardingAction } from "@/lib/amplitude";
import UserActivity from "@/components/UserActivity";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserProfileDialog({
  open,
  onOpenChange,
}: UserProfileDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<KakaoUserInfo | null>(null);

  // 컴포넌트 마운트 시 사용자 정보 로드 및 로그인 상태 변경 감지
  useEffect(() => {
    // 초기 로그인 상태 확인
    const loggedIn = isLoggedInWithKakao();
    setIsLoggedIn(loggedIn);
    
    if (loggedIn) {
      const kakaoInfo = getKakaoUserInfo();
      setUserInfo(kakaoInfo);
      
      // 사용자 정보에 DB ID가 없는 경우 서버에 재요청
      if (kakaoInfo && !kakaoInfo.dbUserId) {
        console.log("DB 사용자 ID가 없어 서버에 사용자 정보 재요청");
        // 사용자 정보 API 재요청 로직 추가
        const refreshUserData = async () => {
          try {
            const accessToken = localStorage.getItem('kakaoAccessToken');
            if (accessToken) {
              const response = await fetch('/api/auth/kakao/user', {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              });
              
              if (response.ok) {
                const userData = await response.json();
                console.log("사용자 정보 재요청 성공:", userData);
                
                // 로컬 스토리지 업데이트
                if (userData.kakao && userData.dbUser) {
                  const updatedInfo = {
                    ...kakaoInfo,
                    dbUserId: userData.dbUser.id,
                    authProviderId: userData.dbUser.authProviderId
                  };
                  localStorage.setItem('kakaoUserInfo', JSON.stringify(updatedInfo));
                  setUserInfo(updatedInfo);
                  

                }
              }
            }
          } catch (error) {
            console.error("사용자 정보 재요청 실패:", error);
          }
        };
        
        refreshUserData();
      }
    }
    
    // 로그인 상태 변경 이벤트 리스너
    const handleLoginStatusChange = (event: CustomEvent) => {
      const loggedIn = event.detail;
      setIsLoggedIn(loggedIn);
      
      if (loggedIn) {
        const userInfo = getKakaoUserInfo();
        setUserInfo(userInfo);
      } else {
        setUserInfo(null);
      }
    };
    
    // 사용자 정보 새로고침 이벤트 리스너
    const handleRefreshUserInfo = () => {
      console.log("사용자 정보 새로고침 이벤트 수신");
      if (isLoggedInWithKakao()) {
        const refreshedInfo = getKakaoUserInfo();
        setUserInfo(refreshedInfo);
      }
    };
    
    // 이벤트 리스너 등록
    window.addEventListener(
      'kakaoLoginStatusChanged', 
      handleLoginStatusChange as EventListener
    );
    
    window.addEventListener(
      'refreshUserInfo',
      handleRefreshUserInfo as EventListener
    );
    

    
    // 컴포넌트 언마운트 시 리스너 제거
    return () => {
      window.removeEventListener(
        'kakaoLoginStatusChanged', 
        handleLoginStatusChange as EventListener
      );
      
      window.removeEventListener(
        'refreshUserInfo',
        handleRefreshUserInfo as EventListener
      );
      
      // Event listener with function reference needs to be removed differently
      // Just ensure the handler doesn't cause issues if called after unmount
    };
  }, [open]);
  


  // 로그인 처리
  const handleLogin = () => {
    setIsLoading(true);
    try {
      // Track login button click
      trackOnboardingAction('login_button_click');
      
      // 카카오 로그인 페이지로 리다이렉트
      const result = loginWithKakao();
      
      if (!result) {
        // 로그인 실패 시 토스트 메시지 표시
        toast({
          title: "로그인 오류",
          description: "카카오 로그인을 시작할 수 없습니다. 나중에 다시 시도해주세요.",
          variant: "destructive",
          duration: 3000,
        });
        setIsLoading(false);
      }
      
      // 리다이렉트 중이므로 로딩 상태는 유지
    } catch (error) {
      console.error("로그인 처리 실패", error);
      toast({
        title: "오류 발생",
        description: "다시 시도해주세요",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logoutWithKakao();
      toast({
        title: "로그아웃 성공",
        description: "안녕히 가세요!",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("로그아웃 실패", error);
      toast({
        title: "로그아웃 실패",
        description: "다시 시도해주세요",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>내 정보</DialogTitle>
          <DialogDescription>
            계정 정보를 확인하고 관리하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoggedIn && userInfo ? (
            <div className="space-y-4">
              {/* 사용자 기본 정보 */}
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={userInfo.profile_image || ""} alt={userInfo.nickname} />
                  <AvatarFallback>{userInfo.nickname?.substring(0, 2) || "사용자"}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-lg">{userInfo.nickname || "사용자"}</h3>
                  <p className="text-sm text-gray-500">카카오 계정으로 로그인됨</p>
                </div>
              </div>

              <Separator />

              {/* 탭 구조 */}
              <Tabs defaultValue="activity" className="w-full">
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger value="activity">나의 활동</TabsTrigger>
                </TabsList>
                
                <TabsContent value="activity" className="mt-4">
                  <UserActivity username={userInfo.nickname || ""} />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="bg-gray-100 rounded-full p-6 mx-auto w-24 h-24 flex items-center justify-center">
                <User className="h-12 w-12 text-gray-400" />
              </div>
              <div>
                <h3 className="font-medium text-lg">로그인이 필요합니다</h3>
                <p className="text-sm text-gray-500 mt-1">
                  로그인하시면 더 많은 기능을 사용할 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {isLoggedIn ? (
            <Button 
              variant="outline" 
              className="w-full flex items-center justify-center"
              onClick={handleLogout}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent"></span>
                  로그아웃 중...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  로그아웃
                </>
              )}
            </Button>
          ) : (
            <Button 
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-white flex items-center justify-center"
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  처리 중...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  카카오 계정으로 로그인
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}