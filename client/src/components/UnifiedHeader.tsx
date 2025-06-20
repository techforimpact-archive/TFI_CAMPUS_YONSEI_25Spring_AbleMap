// src/components/UnifiedHeader.tsx
import React, { useState, useEffect, useRef } from "react";
import { SearchResult } from "@shared/schema";
import { Search, X, Clock, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import UserProfileDialog from "@/components/UserProfileDialog";
import BookmarkList from "@/components/BookmarkList";
import { useToast } from "@/hooks/use-toast";
import { loginWithKakao, isLoggedInWithKakao, logoutWithKakao, getKakaoAccessToken } from "@/lib/kakaoAuth";
import { trackOnboardingAction, trackSearchFocus, trackSearchResultClick } from "@/lib/amplitude";
import { useBookmarks } from "@/hooks/useBookmarks";

interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
}

interface UnifiedHeaderProps {
  searchQuery?: string;
  searchResults?: SearchResult[];
  showResults?: boolean;
  handleSearchInput?: (query: string) => void;
  executeSearch?: (query: string) => void;
  clearSearch?: () => void;
  selectResult?: (result: SearchResult) => void;
  onHistoryVisibilityChange?: (visible: boolean) => void;
  toggleSidebar?: () => void;
  isMobile?: boolean;
  mode?: 'search' | 'main';
  onViewPlace?: (placeId: string) => void;
}

export default function UnifiedHeader({
  searchQuery = '',
  searchResults = [],
  showResults = false,
  handleSearchInput = () => {},
  executeSearch = () => {},
  clearSearch = () => {},
  selectResult = () => {},
  onHistoryVisibilityChange,
  toggleSidebar,
  isMobile = false,
  mode = 'search',
  onViewPlace = () => {}
}: UnifiedHeaderProps) {
  const { toast } = useToast();
  const { getBookmarkCount } = useBookmarks();
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 로그인 상태 확인 (한 번만 실행)
  useEffect(() => {
    const checkLoginStatus = async () => {
      const loggedIn = isLoggedInWithKakao();
      setIsLoggedIn(loggedIn);
      
      if (loggedIn) {
        try {
          // 액세스 토큰 가져오기
          const accessToken = getKakaoAccessToken();
          if (accessToken) {
            // 사용자 정보 가져오기 (액세스 토큰 포함)
            const response = await fetch('/api/auth/kakao/user', {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });
            if (response.ok) {
              const userData = await response.json();
              if (userData.user !== null) {
                setCurrentUser(userData);
              }
            }
          }
        } catch (error) {
          console.error('사용자 정보 가져오기 오류:', error);
        }
      } else {
        setCurrentUser(null);
      }
    };

    checkLoginStatus();
    
    // 로그인 상태 변경 이벤트 리스너 추가
    const handleLoginStatusChange = (event: CustomEvent) => {
      const loggedIn = event.detail;
      setIsLoggedIn(loggedIn);
      if (!loggedIn) {
        setCurrentUser(null);
      } else {
        checkLoginStatus();
      }
    };

    window.addEventListener('kakaoLoginStatusChanged', handleLoginStatusChange as EventListener);
    
    return () => {
      window.removeEventListener('kakaoLoginStatusChanged', handleLoginStatusChange as EventListener);
    };
  }, []);

  // 검색 기록 불러오기
  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('검색 기록 파싱 오류:', error);
      }
    }
  }, []);

  // 검색 기록 저장
  const saveSearchHistory = (history: SearchHistoryItem[]) => {
    localStorage.setItem('searchHistory', JSON.stringify(history));
  };

  // 검색어 입력 핸들러
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    handleSearchInput(value);
    
    if (value.trim() === '') {
      setShowHistory(true);
      onHistoryVisibilityChange?.(true);
    } else {
      setShowHistory(false);
      onHistoryVisibilityChange?.(false);
    }
  };

  // 검색 결과 선택 핸들러
  const handleResultSelect = (result: SearchResult, index: number) => {
    // Track search result click
    trackSearchResultClick(searchQuery, result.name, index);
    
    // 검색 기록에 추가
    const newHistoryItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query: result.name,
      timestamp: Date.now()
    };

    const updatedHistory = [newHistoryItem, ...searchHistory.filter(item => item.query !== result.name)].slice(0, 10);
    setSearchHistory(updatedHistory);
    saveSearchHistory(updatedHistory);

    selectResult(result);
    setShowHistory(false);
    onHistoryVisibilityChange?.(false);
  };

  // 입력 필드 포커스 핸들러
  const handleInputFocus = () => {
    // Track search focus event
    trackSearchFocus();
    if (searchQuery.trim() === '') {
      setShowHistory(true);
      onHistoryVisibilityChange?.(true);
    }
  };

  // 입력 필드 블러 핸들러  
  const handleInputBlur = () => {
    setTimeout(() => {
      setShowHistory(false);
      onHistoryVisibilityChange?.(false);
    }, 200);
  };

  // 외부 클릭 핸들러
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowHistory(false);
        onHistoryVisibilityChange?.(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onHistoryVisibilityChange]);

  return (
    <>
      {mode === 'search' ? (
        <div className="bg-ablemap-beige shadow-md py-3 px-4 sticky top-0 z-30" ref={searchContainerRef}>
          <div className="flex items-center justify-between mb-3">
            <img src="/images/logo.png" alt="AbleMap" className="h-8 object-contain max-w-[180px]" />
            <div className="flex items-center space-x-2">
              {/* 북마크 목록 버튼 - 검색 모드에서도 표시 */}
              <BookmarkList 
                isLoggedIn={isLoggedIn}
                onViewPlace={(placeId) => onViewPlace(placeId)}
              />
              
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center text-ablemap-brown hover:text-ablemap-orange"
                onClick={() => setShowUserProfile(true)}
              >
                <User className="h-5 w-5 mr-1" />
                <span>내 정보</span>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="장소를 검색해주세요"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    // Enter 키로 검색 실행
                    executeSearch(searchQuery);
                  }
                }}
                className="w-full pl-10 pr-10 py-3 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-ablemap-orange focus:border-transparent"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full hover:bg-gray-200"
                  onClick={clearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {(showResults || showHistory) && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-40 max-h-80 overflow-y-auto mt-1">
                {showResults && searchResults.length > 0 && (
                  <ul>
                    {searchResults.map((result, index) => (
                      <li
                        key={result.id}
                        className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                        onClick={() => handleResultSelect(result, index)}
                      >
                        <div className="flex items-start">
                          <MapPin className="h-4 w-4 text-gray-400 mr-2 mt-1 flex-shrink-0" />
                          <div className="flex-grow">
                            <div className="font-medium text-ablemap-brown">{result.name}</div>
                            <div className="text-sm text-gray-500">{result.address}</div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {showHistory && searchHistory.length > 0 && (
                  <div>
                    <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium text-gray-600">
                      최근 검색
                    </div>
                    <ul>
                      {searchHistory.map((item) => (
                        <li
                          key={item.id}
                          className="p-3 hover:bg-gray-100 cursor-pointer border-b"
                          onClick={() => handleSearchInput(item.query)}
                        >
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="flex-grow">{item.query}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchHistory(prev => prev.filter(h => h.id !== item.id));
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <header className="bg-ablemap-orange shadow-md z-10 relative">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center">
              <img src="/images/logo.png" alt="AbleMap" className="h-10 object-contain max-w-[200px]" />
            </div>

            <div className="flex items-center space-x-3">
              {isMobile && toggleSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden bg-gray-100 hover:bg-gray-200 rounded-full p-2"
                  onClick={toggleSidebar}
                  aria-label="Toggle sidebar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </Button>
              )}

              {/* 북마크 목록 버튼 */}
              <BookmarkList 
                isLoggedIn={isLoggedIn}
                onViewPlace={(placeId) => onViewPlace(placeId)}
              />

              <Button 
                variant="ghost"
                size="icon"
                className="bg-gray-100 hover:bg-gray-200 rounded-full p-2"
                aria-label="내 정보"
                onClick={() => {
                  trackOnboardingAction('profile_button_click');
                  setShowUserProfile(true);
                }}
              >
                <User className="h-5 w-5" />
              </Button>

              <Button 
                className="bg-ablemap-yellow hover:bg-yellow-400 text-ablemap-brown font-medium py-2 px-4 rounded-lg text-sm transition"
                onClick={() => isLoggedIn ? logoutWithKakao() : loginWithKakao()}
              >
                {isLoggedIn ? '로그아웃' : '로그인'}
              </Button>
            </div>
          </div>
        </header>
      )}

      <UserProfileDialog 
        open={showUserProfile}
        onOpenChange={setShowUserProfile}
      />
    </>
  );
}