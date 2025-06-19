import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Image as ImageIcon, Loader2 } from 'lucide-react';
import { UserImage } from '@shared/schema';

interface UserActivityProps {
  username: string;
}

export default function UserActivity({ username }: UserActivityProps) {
  // 현재 로그인한 사용자의 업로드 기록 조회
  const { data: userImages, isLoading, error } = useQuery<UserImage[]>({
    queryKey: ['/api/user-images/my-uploads'],
    queryFn: async () => {
      const accessToken = localStorage.getItem('kakaoAccessToken');
      if (!accessToken) {
        throw new Error('로그인이 필요합니다.');
      }

      const response = await fetch('/api/user-images/my-uploads', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
        }
        throw new Error('업로드 기록을 가져올 수 없습니다.');
      }

      return response.json();
    },
    enabled: !!username && !!localStorage.getItem('kakaoAccessToken'),
  });

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>업로드 기록을 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500">업로드 기록을 불러올 수 없습니다.</p>
      </div>
    );
  }

  if (!userImages || userImages.length === 0) {
    return (
      <div className="text-center p-8">
        <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">아직 업로드한 접근성 정보가 없습니다.</p>
        <p className="text-sm text-gray-400 mt-2">
          장소를 방문하고 접근성 이미지를 공유해보세요!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">업로드한 접근성 정보</h3>
        <Badge variant="secondary">
          총 {userImages.length}개
        </Badge>
      </div>

      <div className="space-y-3">
        {userImages.map((image) => (
          <Card key={image.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start space-x-4">
                {/* 이미지 썸네일 */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                    <img
                      src={`/images/${image.imageUrl}`}
                      alt={`${image.placeName} 접근성 이미지`}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        // 이미지 로딩 실패 시 기본 아이콘 표시
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg>';
                        }
                      }}
                    />
                  </div>
                </div>

                {/* 장소 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 truncate">
                        {image.placeName}
                      </h4>
                      
                      <div className="flex items-center text-sm text-gray-500 mt-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(image.uploadedAt)}
                      </div>
                      
                      {image.poiId && (
                        <div className="flex items-center text-xs text-gray-400 mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          POI ID: {image.poiId}
                        </div>
                      )}
                    </div>

                    {/* 상태 뱃지 */}
                    <Badge variant="outline" className="text-xs">
                      업로드 완료
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 통계 정보 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium">활동 통계</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{userImages.length}</p>
              <p className="text-sm text-gray-500">총 업로드</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {new Set(userImages.map(img => img.poiId)).size}
              </p>
              <p className="text-sm text-gray-500">방문한 장소</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}