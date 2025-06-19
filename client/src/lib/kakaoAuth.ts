// 카카오 인증 관련 유틸리티 함수 (REST API 기반)
import { trackUserSignup, trackUserAuth } from "./amplitude";

// 사용자 정보 타입 정의
export interface KakaoUserInfo {
  id: number;
  nickname: string;
  profile_image: string | null;
  dbUserId?: number; // 데이터베이스에 저장된 사용자 ID
  authProviderId?: string; // 카카오 계정 ID
}

// REST API로 로그인 페이지 호출
export const loginWithKakao = async (): Promise<boolean> => {
  try {
    // 서버에서 API 키 정보 가져오기
    const configResponse = await fetch('/api/config');
    const config = await configResponse.json();
    const restApiKey = config.kakaoRestApiKey;
    const redirectUri = config.redirectUri || '/oauth/callback';
    
    console.log("카카오 로그인 시작");
    console.log("REST API 키:", restApiKey ? `${restApiKey.substring(0, 10)}...` : "없음");
    console.log("리다이렉트 URI:", redirectUri);
    
    if (!restApiKey || !redirectUri) {
      console.error("카카오 REST API 키 또는 리다이렉트 URI가 설정되지 않았습니다");
      return false;
    }
    
    // 고정 리다이렉트 URI 사용
    const finalRedirectUri = 'https://kakao-map-info-hyuneee1.replit.app/oauth/callback';
    
    console.log("Kakao Login - Final Redirect URI:", finalRedirectUri);
    
    // 인가 코드 요청 URL 생성
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${restApiKey}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&response_type=code`;
    
    console.log("Generated Kakao Auth URL:", kakaoAuthUrl);
    console.log("Redirecting to Kakao Auth URL");
    
    // 인가 코드 요청 페이지로 이동
    window.location.href = kakaoAuthUrl;
    
    return true;
  } catch (error) {
    console.error("카카오 로그인 요청 중 오류 발생", error);
    return false;
  }
};

// 코드를 이용해 토큰 얻기
export const getTokenFromCode = async (code: string): Promise<any> => {
  try {
    // 서버 API를 통해 토큰 요청
    const response = await fetch('/api/auth/kakao/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      credentials: 'include' // Include credentials with the request
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`토큰 요청 실패 (${response.status}): ${errorText}`);
    }
    
    const tokenData = await response.json();
    
    // 토큰 저장
    console.log('카카오 액세스 토큰 저장:', tokenData.access_token ? `${tokenData.access_token.substring(0, 10)}...` : '없음');
    localStorage.setItem('kakaoAccessToken', tokenData.access_token);
    
    // 회원가입 및 로그인 이벤트 트래킹
    if (tokenData.user) {
      const userId = tokenData.user.authProviderId || tokenData.user.id?.toString();
      
      if (tokenData.isNewUser) {
        // 신규 회원가입 이벤트
        trackUserSignup('kakao', userId);
        console.log('📊 신규 회원가입 이벤트 발생:', userId);
      }
      
      // 로그인 이벤트 (신규/기존 사용자 구분)
      trackUserAuth('login', 'kakao', tokenData.isNewUser);
      console.log('📊 로그인 이벤트 발생:', tokenData.isNewUser ? '신규 사용자' : '기존 사용자');
    }
    
    // 사용자 정보 요청
    await getUserInfo(tokenData.access_token);
    
    return tokenData;
  } catch (error) {
    console.error('토큰 요청 중 오류 발생:', error);
    throw error;
  }
};

// 사용자 정보 요청
const getUserInfo = async (accessToken: string): Promise<void> => {
  try {
    // 서버 API를 통해 사용자 정보 요청
    const response = await fetch('/api/auth/kakao/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      credentials: 'include' // Include credentials with the request
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`사용자 정보 요청 실패 (${response.status}): ${errorText}`);
    }
    
    const userData = await response.json();
    
    // 응답에서 Kakao API 사용자 정보와 DB 사용자 정보 추출
    const kakaoData = userData.kakao || userData;
    const dbUser = userData.dbUser;
    
    console.log("카카오 인증 및 DB 사용자 정보:", userData);
    
    // 사용자 정보 객체 생성
    const userInfo: KakaoUserInfo = {
      id: kakaoData.id,
      nickname: kakaoData.properties?.nickname || kakaoData.kakao_account?.profile?.nickname || "사용자",
      profile_image: kakaoData.properties?.profile_image || kakaoData.kakao_account?.profile?.profile_image_url || null,
      dbUserId: dbUser?.id,
      authProviderId: dbUser?.authProviderId
    };
    
    // 사용자 정보 저장
    console.log('카카오 로그인 상태 저장: true');
    localStorage.setItem('kakaoLogin', 'true');
    console.log('카카오 사용자 정보 저장:', userInfo);
    localStorage.setItem('kakaoUserInfo', JSON.stringify(userInfo));
    
    // 디버깅: localStorage 값 확인
    setTimeout(() => {
      console.log('로그인 후 localStorage 확인:');
      console.log('- kakaoLogin =', localStorage.getItem('kakaoLogin'));
      console.log('- kakaoAccessToken =', localStorage.getItem('kakaoAccessToken') ? '있음' : '없음');
      console.log('- kakaoUserInfo =', localStorage.getItem('kakaoUserInfo') ? '있음' : '없음');
    }, 100);
    
    // 로그인 상태 변경 이벤트 발생
    window.dispatchEvent(new CustomEvent('kakaoLoginStatusChanged', { detail: true }));
    
    // 북마크 기능이 제거되었습니다
  } catch (error) {
    console.error('사용자 정보 요청 중 오류 발생:', error);
    throw error;
  }
};

// OAuth 코드 파라미터 처리
export const handleAuthCallback = async (): Promise<boolean> => {
  console.log("KAKAO AUTH DEBUG - 인증 콜백 처리 시작");
  
  // URL에서 인증 코드 확인
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');
  
  // 오류 파라미터 확인
  if (error) {
    console.error(`카카오 인증 오류: ${error}`);
    return false;
  }
  
  console.log("현재 URL:", window.location.href);
  console.log("검색된 코드:", code);
  console.log(`URL에서 코드 파라미터 ${code ? '발견' : '없음'}`);
  
  if (code) {
    try {
      // UTM 파라미터 보존하면서 코드 파라미터만 제거
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.delete('code'); // 인증 코드만 제거
      currentParams.delete('error'); // 오류 파라미터도 제거
      
      // UTM 파라미터를 보존한 URL로 업데이트
      const newUrl = currentParams.toString() ? 
        `${window.location.pathname}?${currentParams.toString()}` : 
        window.location.pathname;
      
      window.history.pushState(null, '', newUrl);
      
      // 코드를 이용해 토큰 획득
      await getTokenFromCode(code);
      
      return true;
    } catch (error) {
      console.error('인증 콜백 처리 중 오류 발생:', error);
      // 오류 발생 시에도 UTM 파라미터는 보존하고 코드만 제거
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.delete('code');
      currentParams.delete('error');
      
      const newUrl = currentParams.toString() ? 
        `${window.location.pathname}?${currentParams.toString()}` : 
        window.location.pathname;
      
      window.history.pushState(null, '', newUrl);
      return false;
    }
  } else {
    console.log("인증 코드 없음, 정상적인 페이지 로드");
  }
  
  return false;
};

// 카카오 로그아웃
export const logoutWithKakao = async (): Promise<void> => {
  try {
    // 액세스 토큰 확인
    const accessToken = localStorage.getItem('kakaoAccessToken');
    
    if (accessToken) {
      // 서버 API를 통해 로그아웃 요청
      try {
        const response = await fetch('/api/auth/kakao/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          credentials: 'include' // Include credentials with the request
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("로그아웃 API 실패:", errorText);
        }
      } catch (error) {
        console.error("로그아웃 API 호출 오류:", error);
      }
    }
    
    // 로컬 스토리지에서 토큰과 사용자 정보 제거
    localStorage.removeItem('kakaoAccessToken');
    localStorage.removeItem('kakaoLogin');
    localStorage.removeItem('kakaoUserInfo');
    
    // 로그인 상태 변경 이벤트 발생
    window.dispatchEvent(new CustomEvent('kakaoLoginStatusChanged', { detail: false }));
  } catch (error) {
    console.error('로그아웃 중 오류 발생:', error);
    
    // 오류가 발생해도 로컬 데이터는 지움
    localStorage.removeItem('kakaoAccessToken');
    localStorage.removeItem('kakaoLogin');
    localStorage.removeItem('kakaoUserInfo');
    window.dispatchEvent(new CustomEvent('kakaoLoginStatusChanged', { detail: false }));
  }
};

// 로그인 상태 확인
export const isLoggedInWithKakao = (): boolean => {
  const isLoggedIn = localStorage.getItem("kakaoLogin") === "true";
  const accessToken = localStorage.getItem("kakaoAccessToken");
  
  // 토큰이 있지만 로그인 상태가 false인 경우, 자동으로 로그인 상태로 설정
  if (!isLoggedIn && accessToken) {
    localStorage.setItem('kakaoLogin', 'true');
    return true;
  }
  
  if (isLoggedIn && !accessToken) {
    return false;
  }
  
  return isLoggedIn || !!accessToken;
};

// 카카오 사용자 정보 가져오기
export const getKakaoUserInfo = (): KakaoUserInfo | null => {
  const userInfo = localStorage.getItem("kakaoUserInfo");
  return userInfo ? JSON.parse(userInfo) : null;
};

// 카카오 액세스 토큰 가져오기
export const getKakaoAccessToken = (): string | null => {
  return localStorage.getItem("kakaoAccessToken");
};