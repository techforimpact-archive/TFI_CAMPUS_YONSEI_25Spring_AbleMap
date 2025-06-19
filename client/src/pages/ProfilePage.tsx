import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { User, MapPin, Star, Upload, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Place } from "@shared/schema";


export default function ProfilePage() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<number | null>(null);
  
  // 북마크한 장소 가져오기
  const { data: bookmarkedPlaces, isLoading } = useQuery<Place[]>({
    queryKey: ['/api/bookmarks'],
    enabled: true,
  });

  // 사용자 정보 가져오기 (필요하면 추가)
  useEffect(() => {
    // 필요한 경우 사용자 정보 로드
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/kakao/user');
        if (response.ok) {
          const userData = await response.json();
          setUserId(userData.id);
        }
      } catch (error) {
        console.error('사용자 정보 로드 중 오류:', error);
      }
    };
    
    fetchUserInfo();
  }, []);

  // 북마크 뷰에서 상세 페이지로 이동
  const handleViewDetails = (place: Place) => {
    // 상세 페이지로 이동하는 로직 구현
    console.log('장소 상세 보기:', place);
    toast({
      title: "상세 정보",
      description: `${place.name}의 상세 정보를 확인합니다.`,
      duration: 3000,
    });
    
    // 여기에 지도 페이지로 이동하고 해당 장소 선택하는 로직 추가 가능
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-8">
        {/* 프로필 카드 */}
        <Card className="border-ablemap-orange">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="bg-ablemap-orange p-3 rounded-full">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">내 프로필</CardTitle>
                <CardDescription>카카오 계정으로 로그인되었습니다.</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 활동 탭 */}
        <Tabs defaultValue="bookmarks" className="w-full">
          <TabsList className="grid grid-cols-3 mb-8">
            <TabsTrigger value="bookmarks" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span>북마크</span>
            </TabsTrigger>
            <TabsTrigger value="contributions" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span>기여한 정보</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>최근 본 장소</span>
            </TabsTrigger>
          </TabsList>
          
          {/* 북마크 탭 내용 */}
          <TabsContent value="bookmarks">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {isLoading ? (
                <p>북마크를 로딩 중입니다...</p>
              ) : bookmarkedPlaces && bookmarkedPlaces.length > 0 ? (
                bookmarkedPlaces.map((place) => (
                  <Card key={place.id} className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-lg">{place.name}</CardTitle>
                      <CardDescription>{place.address}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {place.categoryId === 1 && "음식점"}
                            {place.categoryId === 2 && "편의점"}
                            {place.categoryId === 3 && "카페"}
                            {place.categoryId === 4 && "쇼핑"}
                          </span>
                        </div>
                        {place.accessibilityScore && (
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium">{place.accessibilityScore}/10</span>
                          </div>
                        )}
                      </div>
                      <Button 
                        className="w-full mt-3"
                        onClick={() => handleViewDetails(place)}
                      >
                        자세히 보기
                      </Button>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <Star className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">북마크한 장소가 없습니다</h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-6">
                    지도에서 마음에 드는 장소를 찾아 북마크 버튼을 클릭하세요.
                  </p>
                  <Button 
                    className="bg-ablemap-yellow hover:bg-yellow-400 text-ablemap-brown"
                    onClick={() => window.location.href = '/'}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    지도로 돌아가기
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* 기여한 정보 탭 내용 */}
          <TabsContent value="contributions">
            <div className="text-center py-8">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Upload className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">아직 기여한 정보가 없습니다</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                장소의 접근성 정보를 추가하여 다른 사용자들을 도와주세요.
              </p>
              <Button 
                className="bg-ablemap-yellow hover:bg-yellow-400 text-ablemap-brown"
                onClick={() => window.location.href = '/'}
              >
                <MapPin className="h-4 w-4 mr-2" />
                지도로 돌아가기
              </Button>
            </div>
          </TabsContent>
          
          {/* 최근 본 장소 탭 내용 */}
          <TabsContent value="history">
            <div className="text-center py-8">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">최근 본 장소가 없습니다</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                지도에서 장소를 검색하고 확인하면 여기에 기록됩니다.
              </p>
              <Button 
                className="bg-ablemap-yellow hover:bg-yellow-400 text-ablemap-brown"
                onClick={() => window.location.href = '/'}
              >
                <MapPin className="h-4 w-4 mr-2" />
                지도로 돌아가기
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}