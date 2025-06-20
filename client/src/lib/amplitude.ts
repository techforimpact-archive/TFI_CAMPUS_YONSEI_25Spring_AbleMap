import * as amplitude from '@amplitude/analytics-browser';
import { Identify } from '@amplitude/analytics-browser';
import { getUTMParams, hasUTMParams, storeUTMParams, removeUTMFromHistory, getCurrentOrStoredUTMParams, type UTMParameters } from './utm';

// Window 타입 확장
declare global {
  interface Window {
    amplitude: {
      track: (eventName: string, properties?: Record<string, any>) => void;
      identify: (identify: any) => void;
      setUserId: (userId: string) => void;
      Identify: new () => any;
    };
  }
}

// Amplitude 초기화 상태 확인
let isInitialized = false;

// Amplitude 초기화
const initAmplitude = () => {
  if (isInitialized) return;
  
  // HTML 스크립트에서 이미 초기화된 경우 체크
  if ((window as any).amplitude) {
    console.log('✅ Amplitude already initialized via HTML script');
    isInitialized = true;
    return;
  }
  
  const apiKey = 'a5decfb794c0daeaccbf7ce7027d96df';
  
  console.log('🔧 Amplitude JavaScript SDK 초기화 시도...');
  
  try {
    amplitude.init(apiKey, undefined, {
      defaultTracking: {
        pageViews: true,
        sessions: true,
        formInteractions: true,
        fileDownloads: true
      }
    });
    
    // 테스트 이벤트 전송
    amplitude.track('amplitude_js_sdk_initialized', {
      timestamp: new Date().toISOString(),
      method: 'javascript_sdk'
    });
    
    console.log('✅ Amplitude JavaScript SDK 초기화 완료');
    isInitialized = true;
  } catch (error) {
    console.error('❌ Amplitude JavaScript SDK 초기화 실패:', error);
  }
};

// DOM 로드 후 초기화
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAmplitude);
  } else {
    initAmplitude();
  }
}

// 이벤트 트래킹 함수들 (단순화된 버전)
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  console.log('📊 Amplitude Event:', eventName, properties);
  
  // 직접 HTML 스크립트의 amplitude 사용
  if ((window as any).amplitude && typeof (window as any).amplitude.track === 'function') {
    (window as any).amplitude.track(eventName, properties);
    console.log('✅ 이벤트 전송 완료:', eventName);
  } else {
    console.error('❌ Amplitude 객체를 찾을 수 없음');
  }
};

// 사용자 속성 설정
export const setUserProperties = (properties: Record<string, any>) => {
  // HTML 스크립트 방식
  if ((window as any).amplitude && (window as any).amplitude.Identify) {
    const identify = new (window as any).amplitude.Identify();
    Object.entries(properties).forEach(([key, value]) => {
      identify.set(key, value);
    });
    (window as any).amplitude.identify(identify);
    return;
  }
  
  // JavaScript SDK 방식
  const identify = new Identify();
  Object.entries(properties).forEach(([key, value]) => {
    identify.set(key, value);
  });
  amplitude.identify(identify);
};

// 사용자 ID 설정
export const setUserId = (userId: string) => {
  // HTML 스크립트 방식
  if ((window as any).amplitude && typeof (window as any).amplitude.setUserId === 'function') {
    (window as any).amplitude.setUserId(userId);
    return;
  }
  
  // JavaScript SDK 방식
  amplitude.setUserId(userId);
};

// 특정 이벤트 트래킹 함수들
export const trackSearchFocus = () => {
  trackEvent('search_focus', {
    timestamp: new Date().toISOString()
  });
};

export const trackSearchSubmit = (query: string, resultCount: number) => {
  trackEvent('search_submit', {
    search_query: query,
    result_count: resultCount,
    timestamp: new Date().toISOString()
  });
};

export const trackSearchResultClick = (query: string, placeName: string, resultIndex: number) => {
  trackEvent('search_result_click', {
    search_query: query,
    place_name: placeName,
    result_index: resultIndex,
    timestamp: new Date().toISOString()
  });
};

// 기존 함수는 유지 (다른 곳에서 사용할 수 있음)
export const trackPlaceSearch = (query: string, resultCount: number) => {
  trackEvent('place_search', {
    search_query: query,
    result_count: resultCount,
    timestamp: new Date().toISOString()
  });
};

export const trackPlaceView = (placeId: string, placeName: string, accessibilityScore?: number) => {
  trackEvent('place_view', {
    place_id: placeId,
    place_name: placeName,
    accessibility_score: accessibilityScore,
    timestamp: new Date().toISOString()
  });
};

export const trackBookmarkAction = (action: 'add' | 'remove', placeId: string, placeName: string) => {
  trackEvent('bookmark_action', {
    action,
    place_id: placeId,
    place_name: placeName,
    timestamp: new Date().toISOString()
  });
};

export const trackImageView = (placeId: string, imageType: string) => {
  trackEvent('image_view', {
    place_id: placeId,
    image_type: imageType,
    timestamp: new Date().toISOString()
  });
};

export const trackImageUpload = (placeId: string, imageType: string) => {
  trackEvent('image_upload', {
    place_id: placeId,
    image_type: imageType,
    timestamp: new Date().toISOString()
  });
};

export const trackCategoryFilter = (categoryId: number, categoryName: string) => {
  trackEvent('category_filter', {
    category_id: categoryId,
    category_name: categoryName,
    timestamp: new Date().toISOString()
  });
};

export const trackMapInteraction = (action: 'zoom' | 'pan' | 'marker_click', details?: Record<string, any>) => {
  trackEvent('map_interaction', {
    action,
    ...details,
    timestamp: new Date().toISOString()
  });
};

export const trackUserAuth = (action: 'login' | 'logout', provider: string, isNewUser?: boolean) => {
  trackEvent('user_auth', {
    action,
    auth_provider: provider,
    is_new_user: isNewUser,
    timestamp: new Date().toISOString()
  });
};

export const trackUserSignup = (provider: string, userId: string) => {
  trackEvent('user_signup', {
    auth_provider: provider,
    user_id: userId,
    timestamp: new Date().toISOString()
  });
};

export const trackUserSessionStart = (isLoggedIn: boolean, userId?: string) => {
  // UTM 컨텍스트가 포함된 세션 시작 이벤트
  trackEventWithUTM('session_start', {
    is_logged_in: isLoggedIn,
    user_id: userId,
    timestamp: new Date().toISOString()
  });
};

export const trackAccessibilityReport = (placeId: string, accessibilityScore: number) => {
  trackEvent('accessibility_report_view', {
    place_id: placeId,
    accessibility_score: accessibilityScore,
    timestamp: new Date().toISOString()
  });
};

export const trackOnboardingAction = (action: 'profile_button_click' | 'login_button_click') => {
  trackEvent('onboarding_action', {
    action,
    timestamp: new Date().toISOString()
  });
};

export const trackAccessibilityTabClick = (tabName: string, placeId: string, placeName: string) => {
  trackEvent('accessibility_tab_click', {
    tab_name: tabName,
    place_id: placeId,
    place_name: placeName,
    timestamp: new Date().toISOString()
  });
};

export const trackAccessibilityRegistration = (placeId: string, placeName: string) => {
  trackEvent('accessibility_registration_request', {
    place_id: placeId,
    place_name: placeName,
    timestamp: new Date().toISOString()
  });
};

export const trackPoiPinClick = (placeId: string, placeName: string, source: 'kakao_api' | 'database', coordinates?: { lat: string, lng: string }) => {
  trackEvent('poi_pin_click', {
    place_id: placeId,
    place_name: placeName,
    pin_source: source,
    latitude: coordinates?.lat,
    longitude: coordinates?.lng,
    timestamp: new Date().toISOString()
  });
};

export const trackAccessibilityInfoMissingView = (placeId: string, placeName: string, hasBasicInfo: boolean = false) => {
  trackEvent('accessibility_info_missing_view', {
    place_id: placeId,
    place_name: placeName,
    has_basic_info: hasBasicInfo,
    user_action: 'view',
    timestamp: new Date().toISOString()
  });
};

export const trackAccessibilityInfoAvailableView = (placeId: string, placeName: string, accessibilityScore: number, activeTab: string) => {
  trackEvent('accessibility_info_available_view', {
    place_id: placeId,
    place_name: placeName,
    accessibility_score: accessibilityScore,
    active_tab: activeTab,
    user_action: 'view',
    timestamp: new Date().toISOString()
  });
};

/**
 * UTM 파라미터를 캡처하고 Amplitude User Properties에 저장
 */
export const captureUTMParameters = (): UTMParameters | null => {
  try {
    console.log('🎯 UTM 캡처 함수 실행 시작');
    console.log('🌐 현재 전체 URL:', window.location.href);
    console.log('🔗 현재 검색 파라미터:', window.location.search);
    
    const currentUTM = getUTMParams();
    
    // 현재 URL에 UTM 파라미터가 있는 경우
    if (Object.keys(currentUTM).length > 0) {
      console.log('🎉 UTM 파라미터 감지됨:', currentUTM);
      
      // User Properties에 UTM 정보 저장
      const utmUserProperties: Record<string, any> = {
        first_utm_source: currentUTM.utm_source,
        first_utm_medium: currentUTM.utm_medium,
        first_utm_campaign: currentUTM.utm_campaign,
        first_utm_term: currentUTM.utm_term,
        first_utm_content: currentUTM.utm_content,
        utm_capture_timestamp: new Date().toISOString()
      };
      
      // null 값 제거
      Object.keys(utmUserProperties).forEach(key => {
        if (utmUserProperties[key] === undefined || utmUserProperties[key] === null) {
          delete utmUserProperties[key];
        }
      });
      
      setUserProperties(utmUserProperties);
      
      // localStorage에 저장 (세션 간 지속)
      storeUTMParams(currentUTM);
      
      // UTM 파라미터를 URL에서 제거하지 않고 유지 (트래킹을 위해)
      
      console.log('✅ UTM 파라미터가 User Properties에 저장됨');
      return currentUTM;
    } else {
      console.log('ℹ️ 현재 URL에 UTM 파라미터가 없습니다');
      return null;
    }
  } catch (error) {
    console.error('❌ UTM 파라미터 캡처 실패:', error);
    return null;
  }
};

/**
 * 이벤트에 UTM 컨텍스트 추가
 */
export const addUTMContext = (eventProperties: Record<string, any> = {}): Record<string, any> => {
  const utmParams = getCurrentOrStoredUTMParams();
  
  if (Object.keys(utmParams).length > 0) {
    return {
      ...eventProperties,
      utm_source: utmParams.utm_source,
      utm_medium: utmParams.utm_medium,
      utm_campaign: utmParams.utm_campaign,
      utm_term: utmParams.utm_term,
      utm_content: utmParams.utm_content
    };
  }
  
  return eventProperties;
};

/**
 * UTM 컨텍스트가 포함된 이벤트 트래킹
 */
export const trackEventWithUTM = (eventName: string, properties?: Record<string, any>) => {
  const propertiesWithUTM = addUTMContext(properties);
  trackEvent(eventName, propertiesWithUTM);
};

// 특정 핵심 이벤트들에 UTM 컨텍스트 자동 추가
export const trackSignupWithUTM = (provider: string, userId: string) => {
  trackEventWithUTM('user_signup', {
    auth_provider: provider,
    user_id: userId,
    timestamp: new Date().toISOString()
  });
};

export const trackBookmarkActionWithUTM = (action: 'add' | 'remove', placeId: string, placeName: string) => {
  trackEventWithUTM('bookmark_action', {
    action,
    place_id: placeId,
    place_name: placeName,
    timestamp: new Date().toISOString()
  });
};

export const trackSearchSubmitWithUTM = (query: string, resultCount: number) => {
  trackEventWithUTM('search_submit', {
    search_query: query,
    result_count: resultCount,
    timestamp: new Date().toISOString()
  });
};

// Amplitude는 HTML 스크립트에서 초기화됨