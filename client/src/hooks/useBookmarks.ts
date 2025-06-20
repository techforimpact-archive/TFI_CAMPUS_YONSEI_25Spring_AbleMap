import { useState, useEffect, useCallback } from "react";
import { Bookmark } from "@shared/schema";
import { isLoggedInWithKakao } from "@/lib/kakaoAuth";
import { trackBookmarkAction } from "@/lib/amplitude";

interface BookmarkState {
  bookmarks: Bookmark[];
  bookmarkStatus: Record<string, boolean>;
  isLoading: boolean;
}

let globalBookmarkState: BookmarkState = {
  bookmarks: [],
  bookmarkStatus: {},
  isLoading: false
};

const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach(callback => callback());
};

export const useBookmarks = () => {
  const [state, setState] = useState(globalBookmarkState);

  useEffect(() => {
    const updateState = () => setState({ ...globalBookmarkState });
    subscribers.add(updateState);
    
    return () => {
      subscribers.delete(updateState);
    };
  }, []);

  const fetchBookmarks = useCallback(async () => {
    if (!isLoggedInWithKakao()) {
      globalBookmarkState.bookmarks = [];
      globalBookmarkState.bookmarkStatus = {};
      notifySubscribers();
      return;
    }

    const accessToken = localStorage.getItem('kakaoAccessToken');
    if (!accessToken) return;

    globalBookmarkState.isLoading = true;
    notifySubscribers();

    try {
      const response = await fetch('/api/bookmarks/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const bookmarks = await response.json();
        globalBookmarkState.bookmarks = bookmarks;
        
        // Update bookmark status map
        const newStatus: Record<string, boolean> = {};
        bookmarks.forEach((bookmark: Bookmark) => {
          newStatus[bookmark.placeId] = true;
        });
        globalBookmarkState.bookmarkStatus = newStatus;
      } else if (response.status === 401) {
        // Token expired, clear auth data
        localStorage.removeItem('kakaoAccessToken');
        localStorage.removeItem('kakaoLogin');
        localStorage.removeItem('kakaoUserInfo');
        globalBookmarkState.bookmarks = [];
        globalBookmarkState.bookmarkStatus = {};
        window.dispatchEvent(new CustomEvent('kakaoLoginStatusChanged', { detail: false }));
      }
    } catch (error) {
      console.error("북마크 목록 가져오기 오류:", error);
    } finally {
      globalBookmarkState.isLoading = false;
      notifySubscribers();
    }
  }, []);

  const addBookmark = useCallback(async (placeId: string, placeName: string) => {
    if (!isLoggedInWithKakao()) return false;

    const accessToken = localStorage.getItem('kakaoAccessToken');
    if (!accessToken) return false;

    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          poiId: placeId,
          placeName: placeName
        }),
      });

      if (response.ok) {
        globalBookmarkState.bookmarkStatus[placeId] = true;
        trackBookmarkAction('add', placeId, placeName);
        await fetchBookmarks(); // Refresh full list
        return true;
      } else if (response.status === 401) {
        // Token expired, clear auth data
        localStorage.removeItem('kakaoAccessToken');
        localStorage.removeItem('kakaoLogin');
        localStorage.removeItem('kakaoUserInfo');
        globalBookmarkState.bookmarks = [];
        globalBookmarkState.bookmarkStatus = {};
        window.dispatchEvent(new CustomEvent('kakaoLoginStatusChanged', { detail: false }));
        return false;
      }
    } catch (error) {
      console.error("북마크 추가 오류:", error);
    }
    return false;
  }, [fetchBookmarks]);

  const removeBookmark = useCallback(async (placeId: string, placeName: string) => {
    if (!isLoggedInWithKakao()) return false;

    const accessToken = localStorage.getItem('kakaoAccessToken');
    if (!accessToken) return false;

    try {
      const response = await fetch(`/api/bookmarks/${placeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        globalBookmarkState.bookmarkStatus[placeId] = false;
        trackBookmarkAction('remove', placeId, placeName);
        await fetchBookmarks(); // Refresh full list
        return true;
      } else if (response.status === 401) {
        // Token expired, clear auth data
        localStorage.removeItem('kakaoAccessToken');
        localStorage.removeItem('kakaoLogin');
        localStorage.removeItem('kakaoUserInfo');
        globalBookmarkState.bookmarks = [];
        globalBookmarkState.bookmarkStatus = {};
        window.dispatchEvent(new CustomEvent('kakaoLoginStatusChanged', { detail: false }));
        return false;
      }
    } catch (error) {
      console.error("북마크 제거 오류:", error);
    }
    return false;
  }, [fetchBookmarks]);

  const isBookmarked = useCallback((placeId: string) => {
    return globalBookmarkState.bookmarkStatus[placeId] || false;
  }, []);

  const getBookmarkCount = useCallback(() => {
    return globalBookmarkState.bookmarks.length;
  }, []);

  // Initial fetch when hook is first used
  useEffect(() => {
    if (isLoggedInWithKakao() && globalBookmarkState.bookmarks.length === 0) {
      fetchBookmarks();
    }
  }, [fetchBookmarks]);

  // Listen for login status changes
  useEffect(() => {
    const handleLoginStatusChange = () => {
      if (isLoggedInWithKakao()) {
        fetchBookmarks();
      } else {
        globalBookmarkState.bookmarks = [];
        globalBookmarkState.bookmarkStatus = {};
        notifySubscribers();
      }
    };

    window.addEventListener('kakaoLoginStatusChanged', handleLoginStatusChange);
    return () => {
      window.removeEventListener('kakaoLoginStatusChanged', handleLoginStatusChange);
    };
  }, [fetchBookmarks]);

  return {
    bookmarks: state.bookmarks,
    isLoading: state.isLoading,
    isBookmarked,
    addBookmark,
    removeBookmark,
    getBookmarkCount,
    refreshBookmarks: fetchBookmarks
  };
};