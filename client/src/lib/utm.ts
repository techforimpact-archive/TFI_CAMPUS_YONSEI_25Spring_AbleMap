/**
 * UTM 파라미터 트래킹 유틸리티 함수들
 * 마케팅 캠페인 추적을 위한 UTM 파라미터 처리
 */

export interface UTMParameters {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

/**
 * URL에서 특정 쿼리 파라미터 값을 추출
 */
export function getQueryParam(paramName: string, url?: string): string | null {
  try {
    const urlToUse = url || window.location.href;
    console.log('🔍 URL 파싱 시도:', urlToUse);
    const urlObj = new URL(urlToUse);
    const value = urlObj.searchParams.get(paramName);
    console.log(`📝 파라미터 ${paramName}:`, value);
    return value;
  } catch (error) {
    console.error('❌ URL 파싱 실패:', error);
    return null;
  }
}

/**
 * 현재 URL에서 모든 UTM 파라미터를 추출
 */
export function getUTMParams(url?: string): UTMParameters {
  console.log('🚀 UTM 파라미터 추출 시작');
  const utmParams: UTMParameters = {};
  
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
  
  utmKeys.forEach(key => {
    const value = getQueryParam(key, url);
    if (value) {
      utmParams[key] = value;
      console.log(`✅ UTM 파라미터 발견: ${key} = ${value}`);
    }
  });
  
  console.log('📊 최종 UTM 파라미터:', utmParams);
  console.log('📈 발견된 UTM 파라미터 개수:', Object.keys(utmParams).length);
  
  return utmParams;
}

/**
 * UTM 파라미터가 URL에 존재하는지 확인
 */
export function hasUTMParams(url?: string): boolean {
  const utmParams = getUTMParams(url);
  return Object.keys(utmParams).length > 0;
}

/**
 * URL에서 UTM 파라미터를 제거하고 깔끔한 URL 반환
 */
export function cleanURLFromUTM(url?: string): string {
  const urlToUse = url || window.location.href;
  const urlObj = new URL(urlToUse);
  
  // UTM 파라미터들 제거
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  utmKeys.forEach(key => {
    urlObj.searchParams.delete(key);
  });
  
  return urlObj.toString();
}

/**
 * 브라우저 히스토리에서 UTM 파라미터를 제거 (URL 정리)
 */
export function removeUTMFromHistory(): void {
  if (hasUTMParams() && window.history && window.history.replaceState) {
    const cleanUrl = cleanURLFromUTM();
    window.history.replaceState(null, '', cleanUrl);
  }
}

/**
 * UTM 파라미터를 localStorage에 저장 (세션 간 지속)
 */
export function storeUTMParams(utmParams: UTMParameters): void {
  try {
    localStorage.setItem('utm_params', JSON.stringify(utmParams));
    localStorage.setItem('utm_timestamp', new Date().toISOString());
  } catch (error) {
    console.warn('UTM 파라미터 저장 실패:', error);
  }
}

/**
 * localStorage에서 저장된 UTM 파라미터 조회
 */
export function getStoredUTMParams(): UTMParameters | null {
  try {
    const stored = localStorage.getItem('utm_params');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('저장된 UTM 파라미터 조회 실패:', error);
    return null;
  }
}

/**
 * UTM 파라미터 저장 시점 조회
 */
export function getUTMTimestamp(): string | null {
  try {
    return localStorage.getItem('utm_timestamp');
  } catch (error) {
    console.warn('UTM 타임스탬프 조회 실패:', error);
    return null;
  }
}

/**
 * 현재 UTM 파라미터 또는 저장된 UTM 파라미터 반환
 * 우선순위: 현재 URL > localStorage
 */
export function getCurrentOrStoredUTMParams(): UTMParameters {
  const currentUTM = getUTMParams();
  
  // 현재 URL에 UTM 파라미터가 있으면 사용
  if (Object.keys(currentUTM).length > 0) {
    return currentUTM;
  }
  
  // 없으면 저장된 UTM 파라미터 사용
  return getStoredUTMParams() || {};
}