import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { handleAuthCallback } from "@/lib/kakaoAuth";
import { toast } from "@/hooks/use-toast";
import MapPage from "@/pages/MapPage";
import NotFound from "@/pages/not-found";
import ProfilePage from "@/pages/ProfilePage";
import TestUploadPage from "@/pages/TestUploadPage";
import UTMTestPage from "@/pages/UTMTestPage";
import FeedbackFloatingButton from "@/components/FeedbackFloatingButton";
import "@/lib/amplitude"; // Amplitude 초기화

function Router() {
  return (
    <Switch>
      <Route path="/" component={MapPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/test-upload" component={TestUploadPage} />
      <Route path="/utm-test" component={UTMTestPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthCallback() {
  useEffect(() => {
    // Kakao 인증 콜백 처리
    const processAuthCallback = async () => {
      try {
        const isAuthenticated = await handleAuthCallback();
        if (isAuthenticated) {
          toast({
            title: "로그인 성공",
            description: "카카오 계정으로 로그인되었습니다.",
          });
        }
      } catch (error) {
        console.error("인증 콜백 처리 실패:", error);
        toast({
          title: "로그인 실패",
          description: "카카오 계정 로그인 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };

    processAuthCallback();
  }, []);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthCallback />
        <Router />
        <FeedbackFloatingButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
