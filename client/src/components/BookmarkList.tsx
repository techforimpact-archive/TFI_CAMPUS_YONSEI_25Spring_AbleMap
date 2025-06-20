import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, MapPin, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBookmarks } from "@/hooks/useBookmarks";

interface BookmarkListProps {
  isLoggedIn: boolean;
  onViewPlace: (placeId: string) => void;
}

export default function BookmarkList({ isLoggedIn, onViewPlace }: BookmarkListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { bookmarks, isLoading, removeBookmark, getBookmarkCount } = useBookmarks();

  // 북마크 제거 핸들러
  const handleRemoveBookmark = async (placeId: string, placeName: string) => {
    const success = await removeBookmark(placeId, placeName);
    
    if (success) {
      toast({
        title: "북마크 제거",
        description: "북마크가 제거되었습니다.",
        duration: 2000,
      });
    } else {
      toast({
        title: "오류",
        description: "북마크 제거 중 오류가 발생했습니다.",
        duration: 3000,
      });
    }
  };

  // 장소 보기 (지도에서 해당 장소로 이동)
  const handleViewPlace = (placeId: string, placeName: string) => {
    onViewPlace(placeId);
    
    toast({
      title: "장소 이동",
      description: `${placeName}(으)로 이동합니다.`,
      duration: 2000,
    });

    setIsOpen(false); // 이동 후 다이얼로그 닫기
  };

  // 로그인하지 않은 경우
  if (!isLoggedIn) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Star className="w-4 h-4 mr-1" />
            북마크
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>로그인 필요</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <Star className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-4">
              북마크 기능을 사용하려면 로그인해주세요.
            </p>
            <Button onClick={() => setIsOpen(false)}>
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const bookmarkCount = getBookmarkCount();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Star className="w-4 h-4 mr-1 fill-current text-yellow-500" />
          북마크 ({bookmarkCount})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 fill-current text-yellow-500" />
            내 북마크 ({bookmarkCount}개)
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">북마크를 불러오는 중...</p>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center py-8">
              <Star className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-4">
                아직 저장된 북마크가 없습니다.
              </p>
              <p className="text-sm text-gray-500">
                장소를 둘러보고 마음에 드는 곳을 북마크해보세요!
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleViewPlace(bookmark.placeId, bookmark.placeName)}
                        className="text-left w-full group"
                      >
                        <h3 className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {bookmark.placeName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          지도에서 보기
                        </p>
                      </button>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        onClick={() => handleViewPlace(bookmark.placeId, bookmark.placeName)}
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3" />
                        보기
                      </Button>
                      <Button
                        onClick={() => handleRemoveBookmark(bookmark.placeId, bookmark.placeName)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}