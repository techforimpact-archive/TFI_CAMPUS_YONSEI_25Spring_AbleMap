import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, User, Calendar, Trash2, Download, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getKakaoAccessToken, getKakaoUserInfo } from "@/lib/kakaoAuth";
import { trackEvent } from "@/lib/amplitude";
import ImageUploadModal from "./ImageUploadModal";

interface UserImage {
  id: number;
  poiId: string;
  placeName: string;
  username: string;
  imageUrl: string;
  uploadedAt: string;
}

interface UserImageGalleryProps {
  poiId?: string;
  placeName?: string;
  showUploadButton?: boolean;
  maxItems?: number;
}

export default function UserImageGallery({ 
  poiId, 
  placeName, 
  showUploadButton = false,
  maxItems 
}: UserImageGalleryProps) {
  const [images, setImages] = useState<UserImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { toast } = useToast();
  const currentUser = getKakaoUserInfo();
  const isLoggedIn = !!getKakaoAccessToken();

  const fetchImages = async () => {
    try {
      setIsLoading(true);
      const endpoint = poiId 
        ? `/api/user-images/${poiId}`
        : '/api/user-images';
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        let filteredData = data;
        
        if (maxItems) {
          filteredData = data.slice(0, maxItems);
        }
        
        setImages(filteredData);
      } else {
        console.error('Failed to fetch user images');
      }
    } catch (error) {
      console.error('Error fetching user images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [poiId, maxItems]);

  const handleDeleteImage = async (imageId: number) => {
    const accessToken = getKakaoAccessToken();
    if (!accessToken) {
      toast({
        title: "로그인 필요",
        description: "이미지를 삭제하려면 로그인해주세요.",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/user-images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        setImages(prev => prev.filter(img => img.id !== imageId));
        
        // Track image deletion
        trackEvent('user_image_delete', {
          image_id: imageId,
          place_id: poiId,
          timestamp: new Date().toISOString()
        });

        toast({
          title: "삭제 완료",
          description: "이미지가 삭제되었습니다.",
        });
      } else {
        throw new Error('삭제에 실패했습니다.');
      }
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleImageClick = (image: UserImage) => {
    // Track image view
    trackEvent('user_image_view', {
      image_id: image.id,
      place_id: image.poiId,
      place_name: image.placeName,
      uploader: image.username,
      timestamp: new Date().toISOString()
    });

    // Open image in new tab
    window.open(`/${image.imageUrl}`, '_blank');
  };

  const handleUploadSuccess = () => {
    fetchImages(); // Refresh the gallery
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 h-32 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">
            사용자 업로드 이미지
          </h3>
          <Badge variant="secondary">
            {images.length}개
          </Badge>
        </div>
        
        {showUploadButton && isLoggedIn && poiId && placeName && (
          <Button
            size="sm"
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Camera className="h-4 w-4 mr-1" />
            업로드
          </Button>
        )}
      </div>

      {/* Images Grid */}
      {images.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Camera className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">
              아직 업로드된 이미지가 없습니다
            </p>
            <p className="text-sm text-gray-500">
              첫 번째로 접근성 정보를 공유해보세요!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative group">
                <img
                  src={`/${image.imageUrl}`}
                  alt={`${image.placeName} 접근성 정보`}
                  className="w-full h-48 object-cover cursor-pointer"
                  onClick={() => handleImageClick(image)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/placeholder-image.png';
                  }}
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleImageClick(image)}
                      className="bg-white hover:bg-gray-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    
                    {currentUser?.nickname === image.username && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteImage(image.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {image.placeName}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <User className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-600">
                        {image.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-500">
                        {new Date(image.uploadedAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && poiId && placeName && (
        <ImageUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          poiId={poiId}
          placeName={placeName}
          onUploadSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}