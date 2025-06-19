import { useState, useEffect } from "react";
import {
  X,
  Upload,
  Info,
  CircleDashed,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
} from "lucide-react";
import { Place, AccessibilityReport } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { removeCurrentSearchPinMarker } from "@/lib/kakaoMap";
import BookmarkButton from "@/components/BookmarkButton";
import { isLoggedInWithKakao } from "@/lib/kakaoAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import AccessibilityImageUpload from "./AccessibilityImageUpload";
import UserImageGallery from "./UserImageGallery";
import {
  trackAccessibilityTabClick,
  trackAccessibilityRegistration,
  trackAccessibilityInfoMissingView,
  trackAccessibilityInfoAvailableView,
} from "@/lib/amplitude";

interface AccessibilityImage {
  type: "entrance" | "elevator" | "toilet";
  url: string | null;
  description: string;
}

interface PlaceDetailsWithAccessibilityProps {
  place: Place;
  onClose: () => void;
}

export default function PlaceDetailsWithAccessibility({
  place,
  onClose,
}: PlaceDetailsWithAccessibilityProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "summary" | "entrance" | "elevator" | "toilet"
  >("summary");
  const [accessibilityData, setAccessibilityData] =
    useState<AccessibilityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [placeImages, setPlaceImages] = useState<{ [key: string]: string[] }>({
    entrance: [],
    elevator: [],
    toilet: [],
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // 탭 클릭 핸들러 (이벤트 트래킹 포함)
  const handleTabClick = (
    tabName: "summary" | "entrance" | "elevator" | "toilet",
  ) => {
    setActiveTab(tabName);
    trackAccessibilityTabClick(
      tabName,
      place.kakaoPlaceId,
      place.placeName || place.name || "Unknown Place",
    );
  };

  // Load accessibility data and user info on component mount
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        await fetchAccessibilityData();
        await fetchPlaceImages(); // Enable image loading
        await checkLoginStatus();
      } catch (error) {
        console.error("컴포넌트 초기화 중 오류:", error);
      }
    };

    initializeComponent();

    // 모달이 열릴 때 피드백 버튼 숨기기 이벤트 발생
    window.dispatchEvent(new CustomEvent("placeModalOpen"));

    // 컴포넌트가 언마운트될 때 마커를 제거하는 클린업 함수
    return () => {
      console.log(
        "🧹 PlaceDetailsWithAccessibility 컴포넌트 언마운트: 마커 자동 제거",
      );
      // 모달이 닫힐 때 피드백 버튼 다시 표시 이벤트 발생
      window.dispatchEvent(new CustomEvent("placeModalClose"));
      try {
        removeCurrentSearchPinMarker();
      } catch (error) {
        console.error("컴포넌트 언마운트 시 마커 제거 오류:", error);
      }
    };
  }, [place.id]);

  // Track accessibility info missing view when data is null/empty
  useEffect(() => {
    // Only track if loading is complete and no accessibility data exists
    if (!loading && !accessibilityData) {
      trackAccessibilityInfoMissingView(
        place.kakaoPlaceId || place.id?.toString() || "unknown",
        place.placeName || place.name || "Unknown Place",
        Boolean(place.name || place.address), // has basic info if name or address exists
      );
    }
  }, [loading, accessibilityData, place]);

  // Track accessibility info available view when data exists
  useEffect(() => {
    // Only track if loading is complete and accessibility data exists
    if (!loading && accessibilityData) {
      trackAccessibilityInfoAvailableView(
        place.kakaoPlaceId || place.id?.toString() || "unknown",
        place.placeName || place.name || "Unknown Place",
        accessibilityData.accessibility_score || 0,
        activeTab,
      );
    }
  }, [loading, accessibilityData, activeTab, place]);

  // 사용자 정보 확인 함수
  const checkLoginStatus = async () => {
    const loggedIn = isLoggedInWithKakao();
    setIsLoggedIn(loggedIn);

    if (loggedIn) {
      try {
        const accessToken = localStorage.getItem("kakao_access_token");
        const headers: HeadersInit = {};

        if (accessToken) {
          headers["Authorization"] = `Bearer ${accessToken}`;
        }

        const response = await fetch("/api/auth/kakao/user", { headers });
        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
        }
      } catch (error) {
        console.error("사용자 정보 가져오기 오류:", error);
      }
    } else {
      setCurrentUser(null);
    }
  };

  // 장소 이미지를 가져오는 함수
  const fetchPlaceImages = async () => {
    try {
      // API를 통해 장소 이미지 가져오기 - kakaoPlaceId 사용
      const placeId = place.kakaoPlaceId || place.id;
      const response = await fetch(`/api/places/${placeId}/images`);
      if (!response.ok) {
        console.log("장소 이미지를 가져오는데 실패했습니다.");
        return;
      }

      const data = await response.json();

      // 이미지를 타입별로 분류
      const imagesByType: { [key: string]: string[] } = {
        entrance: [],
        elevator: [],
        toilet: [],
      };

      data.forEach((image: any) => {
        const imageType = image.image_type || image.imageType;
        const imageUrl = image.image_url || image.imageUrl;
        if (imageType in imagesByType) {
          imagesByType[imageType].push(imageUrl);
        }
      });

      setPlaceImages(imagesByType);
    } catch (error) {
      console.error("Failed to fetch place images:", error);
    }
  };

  const fetchAccessibilityData = async () => {
    try {
      setLoading(true);

      // 장소 정보와 함께 접근성 정보 요청 (좌표 기반 매칭을 위해)
      const searchParams = new URLSearchParams({
        name: place.name || "",
        lat: place.latitude || "",
        lng: place.longitude || "",
      });

      console.log(
        `접근성 정보 API 호출 - ${place.name} (${place.latitude}, ${place.longitude})`,
      );
      const response = await fetch(
        `/api/places/${place.kakaoPlaceId || place.id}/accessibility?${searchParams}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAccessibilityData(data);

      // 접근성 데이터가 있는 경우에만 이미지 조회
      fetchPlaceImages();
    } catch (error) {
      console.error("Failed to fetch accessibility data:", error);
      // 데이터 없음 상태 유지
      setAccessibilityData(null);
    } finally {
      setLoading(false);
    }
  };

  const hasAccessibilityData = accessibilityData !== null;

  // 접근성 정보 업로드 처리 함수
  const handleUpload = async () => {
    try {
      setLoading(true);

      // 여기서는 예시 데이터를 사용합니다. 실제로는 form에서 수집한 데이터를 사용해야 합니다.
      const demoAccessibilityData: AccessibilityReport = {
        summary: "사용자 제공 접근성 정보입니다.",
        recommendations: [
          "휠체어 이용자는 정문보다 옆문을 이용하는 것이 좋습니다.",
        ],
        accessibility_score: 6,
        highlighted_obstacles: ["stairs", "narrow_entrance"],
        ai_analysis: {
          has_stairs: true,
          has_ramp: false,
          entrance_accessible: false,
          obstacles: ["stairs", "narrow_door"],
        },
        facility_details: {
          entrance: {
            accessible: false,
            features: ["stairs"],
          },
          restroom: {
            available: true,
            features: ["standard_size"],
          },
          parking: {
            available: false,
            features: [],
          },
          elevator: {
            available: false,
          },
        },
      };

      const response = await fetch(`/api/places/${place.id}/accessibility`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(demoAccessibilityData),
      });

      if (!response.ok) {
        throw new Error("접근성 정보 업로드에 실패했습니다.");
      }

      const updatedData = await response.json();
      setAccessibilityData(updatedData);

      toast({
        title: "접근성 정보가 업로드되었습니다.",
        description: "소중한 정보 공유에 감사드립니다!",
        duration: 3000,
      });

      setShowUploadDialog(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "업로드 실패",
        description:
          "접근성 정보 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  // 이미지 확대 보기 함수
  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
  };

  // Sample guide text for each accessibility feature
  const guideText = {
    summary:
      "장소의 전반적인 접근성 정보를 업로드해주세요. 휠체어 이용자가 이용할 수 있는지 등의 정보가 포함되면 좋습니다.",
    entrance:
      "건물의 정문이나 주요 출입구의 사진을 업로드해주세요. 계단이나 경사로, 자동문 등의 특징이 잘 보이는 사진이 좋습니다.",
    elevator:
      "엘리베이터의 크기, 버튼 높이, 점자 표시 등이 잘 보이는 사진을 업로드해주세요.",
    toilet:
      "화장실 입구, 내부 공간, 편의 시설 등이 잘 보이는 사진을 업로드해주세요.",
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex flex-col">
      <div className="bg-white rounded-t-xl flex-1 overflow-auto max-h-full flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200">
          <div className="flex justify-between items-center p-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold truncate">{place.name}</h1>
              <p className="text-sm text-gray-500 truncate">{place.address}</p>
            </div>
            <div className="flex items-center gap-2">
              <BookmarkButton place={place} className="text-xs" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  console.log("상세 정보 닫기 버튼 클릭 - 직접 마커 제거");
                  // 피드백 버튼 다시 표시 이벤트 발생
                  window.dispatchEvent(new CustomEvent("placeModalClose"));
                  try {
                    // 1. 직접 마커 제거 함수 호출
                    removeCurrentSearchPinMarker();
                  } catch (e) {
                    console.error("마커 제거 오류:", e);
                  }
                  // 2. 원래 닫기 함수 호출
                  onClose();
                }}
                className="text-gray-600"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            // 로딩 중일 때
            <div className="flex justify-center items-center h-full p-6">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4 ml-10"></div>
                <p>접근성 정보를 가져오는 중...</p>
              </div>
            </div>
          ) : hasAccessibilityData ? (
            // 접근성 데이터가 있을 때
            <div className="p-4 space-y-6">
              {/* 접근성 탭 네비게이션 */}
              <div className="flex border-b border-gray-200">
                <button
                  className={`flex-1 py-2 px-4 text-center font-medium ${
                    activeTab === "summary"
                      ? "text-yellow-500 border-b-2 border-yellow-500"
                      : "text-gray-500"
                  }`}
                  onClick={() => handleTabClick("summary")}
                >
                  요약
                </button>
                <button
                  className={`flex-1 py-2 px-4 text-center font-medium ${
                    activeTab === "entrance"
                      ? "text-yellow-500 border-b-2 border-yellow-500"
                      : "text-gray-500"
                  }`}
                  onClick={() => handleTabClick("entrance")}
                >
                  출입구
                </button>
                <button
                  className={`flex-1 py-2 px-4 text-center font-medium ${
                    activeTab === "elevator"
                      ? "text-yellow-500 border-b-2 border-yellow-500"
                      : "text-gray-500"
                  }`}
                  onClick={() => handleTabClick("elevator")}
                >
                  엘리베이터
                </button>
                <button
                  className={`flex-1 py-2 px-4 text-center font-medium ${
                    activeTab === "toilet"
                      ? "text-yellow-500 border-b-2 border-yellow-500"
                      : "text-gray-500"
                  }`}
                  onClick={() => handleTabClick("toilet")}
                >
                  화장실
                </button>
              </div>

              {/* 접근성 컨텐츠 */}
              {activeTab === "summary" && accessibilityData && (
                <div className="space-y-6">
                  {/* 접근성 점수 */}
                  <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold">접근성 점수</h3>
                      <div className="flex items-center">
                        <CircleDashed className="h-5 w-5 text-yellow-500 mr-1" />
                        <span className="font-bold text-xl">
                          {accessibilityData.accessibility_score}/10
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          accessibilityData.accessibility_score >= 7
                            ? "bg-green-500"
                            : accessibilityData.accessibility_score >= 4
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{
                          width: `${accessibilityData.accessibility_score * 10}%`,
                          animation: `progressFillAnimation 1.5s ease-out forwards`,
                          transform: "translateX(-100%)",
                          animationDelay: "0.3s",
                        }}
                      />
                    </div>
                  </div>

                  {/* 요약 정보 - 주석처리 */}
                  {/* <div className="bg-gray-50 p-5 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">요약</h3>
                    <p className="text-gray-700 mb-4">
                      {accessibilityData.summary}
                    </p>
                  </div> */}

                  {/* 추천 사항 */}
                  {accessibilityData.recommendations &&
                    Array.isArray(accessibilityData.recommendations) &&
                    accessibilityData.recommendations.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">
                          이동약자 이용 시 참고사항
                        </h3>
                        <ul className="space-y-2">
                          {accessibilityData.recommendations.map(
                            (rec, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-yellow-500 mr-2 mt-1">
                                  •
                                </span>
                                <span>{rec}</span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                  {/* 장애물 정보 */}
                  {accessibilityData.highlighted_obstacles &&
                    Array.isArray(accessibilityData.highlighted_obstacles) &&
                    accessibilityData.highlighted_obstacles.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">주요 장애물</h3>
                        <div className="flex flex-wrap gap-2">
                          {accessibilityData.highlighted_obstacles.map(
                            (obstacle, index) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm font-medium"
                              >
                                {obstacle}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {/* 사용자 업로드 이미지 */}
                  <UserImageGallery
                    poiId={place.kakaoPlaceId}
                    placeName={place.placeName || place.name}
                    showUploadButton={true}
                    maxItems={6}
                  />

                  {/* AI 분석 결과 */}
                  {accessibilityData.ai_analysis &&
                    typeof accessibilityData.ai_analysis === "object" && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">AI 분석 결과</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {/* 계단 여부 */}
                          {typeof accessibilityData.ai_analysis.has_stairs ===
                            "boolean" && (
                            <div className="flex items-center p-3 bg-white rounded-lg border border-gray-100">
                              <div className="mr-3">
                                {accessibilityData.ai_analysis.has_stairs ? (
                                  <XCircle className="h-5 w-5 text-red-500" />
                                ) : (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                )}
                              </div>
                              <div>
                                <span className="text-sm font-medium">
                                  계단 여부
                                </span>
                                <p className="text-xs text-gray-500">
                                  {accessibilityData.ai_analysis.has_stairs
                                    ? "계단이 있습니다"
                                    : "계단이 없습니다"}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 경사로 여부 */}
                          {typeof accessibilityData.ai_analysis.has_ramp ===
                            "boolean" && (
                            <div className="flex items-center p-3 bg-white rounded-lg border border-gray-100">
                              <div className="mr-3">
                                {accessibilityData.ai_analysis.has_ramp ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-500" />
                                )}
                              </div>
                              <div>
                                <span className="text-sm font-medium">
                                  경사로 여부
                                </span>
                                <p className="text-xs text-gray-500">
                                  {accessibilityData.ai_analysis.has_ramp
                                    ? "경사로가 있습니다"
                                    : "경사로가 없습니다"}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 입구 접근성 */}
                          {typeof accessibilityData.ai_analysis
                            .entrance_accessible === "boolean" && (
                            <div className="flex items-center p-3 bg-white rounded-lg border border-gray-100">
                              <div className="mr-3">
                                {accessibilityData.ai_analysis
                                  .entrance_accessible ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-500" />
                                )}
                              </div>
                              <div>
                                <span className="text-sm font-medium">
                                  입구 접근 가능
                                </span>
                                <p className="text-xs text-gray-500">
                                  {accessibilityData.ai_analysis
                                    .entrance_accessible
                                    ? "접근 가능합니다"
                                    : "접근이 어렵습니다"}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* 세부 시설 정보 탭 */}
              {activeTab === "entrance" &&
                accessibilityData?.facility_details && (
                  <div className="space-y-4">
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">출입구 정보</h3>
                        <div>
                          {accessibilityData.facility_details.entrance
                            ?.accessible ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                              접근 가능
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                              접근성 정보 미확인
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-500">
                          특징
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {accessibilityData.facility_details?.entrance
                            ?.features &&
                          Array.isArray(
                            accessibilityData.facility_details.entrance
                              .features,
                          ) ? (
                            accessibilityData.facility_details.entrance.features.map(
                              (feature, index) => (
                                <span
                                  key={index}
                                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                                >
                                  {feature}
                                </span>
                              ),
                            )
                          ) : (
                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                              정보 없음
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 출입구 이미지 */}
                      {placeImages.entrance.length > 0 && (
                        <div className="mt-5 space-y-3">
                          <h4 className="text-sm font-medium text-gray-500">
                            출입구 사진
                          </h4>
                          <div className="grid grid-cols-1 gap-4">
                            {placeImages.entrance.map((imageUrl, index) => (
                              <div
                                key={index}
                                className="relative"
                                style={{
                                  animation: `fadeInUp 0.5s ease-out ${index * 100}ms both`,
                                }}
                              >
                                <div
                                  className="relative aspect-video rounded-lg overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 transform"
                                  onClick={() => setSelectedImage(imageUrl)}
                                >
                                  <img
                                    src={imageUrl}
                                    alt={`출입구 사진 ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center">
                                    <div className="opacity-0 hover:opacity-100 transition-opacity duration-300 bg-white bg-opacity-90 rounded-full p-2">
                                      <svg
                                        className="w-6 h-6 text-gray-700"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center text-sm text-gray-500">
                                  <ImageIcon className="h-4 w-4 mr-1" />
                                  <span>출입구 사진 {index + 1}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {activeTab === "elevator" &&
                accessibilityData?.facility_details && (
                  <div className="space-y-4">
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">
                          엘리베이터 정보
                        </h3>
                        <div>
                          {accessibilityData.facility_details.elevator
                            ?.available ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                              이용 가능
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                              이용 불가
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 엘리베이터 이미지 */}
                      {placeImages.elevator.length > 0 && (
                        <div className="mt-5 space-y-3">
                          <h4 className="text-sm font-medium text-gray-500">
                            엘리베이터 사진
                          </h4>
                          <div className="grid grid-cols-1 gap-4">
                            {placeImages.elevator.map((imageUrl, index) => (
                              <div
                                key={index}
                                className="relative"
                                style={{
                                  animation: `fadeInUp 0.5s ease-out ${index * 100}ms both`,
                                }}
                              >
                                <div
                                  className="relative aspect-video rounded-lg overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 transform"
                                  onClick={() => setSelectedImage(imageUrl)}
                                >
                                  <img
                                    src={imageUrl}
                                    alt={`엘리베이터 사진 ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center">
                                    <div className="opacity-0 hover:opacity-100 transition-opacity duration-300 bg-white bg-opacity-90 rounded-full p-2">
                                      <svg
                                        className="w-6 h-6 text-gray-700"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center text-sm text-gray-500">
                                  <ImageIcon className="h-4 w-4 mr-1" />
                                  <span>엘리베이터 사진 {index + 1}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {activeTab === "toilet" &&
                accessibilityData?.facility_details && (
                  <div className="space-y-4">
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">화장실 정보</h3>
                        <div>
                          {accessibilityData.facility_details.restroom
                            ?.available ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                              이용 가능
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                              이용 불가
                            </span>
                          )}
                        </div>
                      </div>
                      {accessibilityData.facility_details.restroom
                        ?.available && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-500">
                            특징
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {accessibilityData.facility_details.restroom?.features?.map(
                              (feature, index) => (
                                <span
                                  key={index}
                                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                                >
                                  {feature}
                                </span>
                              ),
                            ) || (
                              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                                정보 없음
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 화장실 이미지 */}
                      {placeImages.toilet.length > 0 && (
                        <div className="mt-5 space-y-3">
                          <h4 className="text-sm font-medium text-gray-500">
                            화장실 사진
                          </h4>
                          <div className="grid grid-cols-1 gap-4">
                            {placeImages.toilet.map((imageUrl, index) => (
                              <div
                                key={index}
                                className="relative"
                                style={{
                                  animation: `fadeInUp 0.5s ease-out ${index * 100}ms both`,
                                }}
                              >
                                <div
                                  className="relative aspect-video rounded-lg overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 transform"
                                  onClick={() => setSelectedImage(imageUrl)}
                                >
                                  <img
                                    src={imageUrl}
                                    alt={`화장실 사진 ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center">
                                    <div className="opacity-0 hover:opacity-100 transition-opacity duration-300 bg-white bg-opacity-90 rounded-full p-2">
                                      <svg
                                        className="w-6 h-6 text-gray-700"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center text-sm text-gray-500">
                                  <ImageIcon className="h-4 w-4 mr-1" />
                                  <span>화장실 사진 {index + 1}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            // 접근성 데이터가 없을 때
            <div className="flex flex-col items-center justify-center p-6 space-y-6 h-full">
              <div className="text-center">
                <div className="bg-gray-100 rounded-full p-4 inline-block mb-4">
                  <Info className="h-10 w-10 text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">
                  접근성 정보가 없습니다
                </h2>
                <p className="text-gray-500 max-w-md mx-auto">
                  이 장소에 대한 접근성 정보가 아직 등록되지 않았습니다.
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  이미지 업로드 시 100% 커피 기프티콘 증정☕️
                </p>
                <Button
                  className="bg-yellow-400 hover:bg-yellow-500 text-white"
                  onClick={() => {
                    trackAccessibilityRegistration(
                      place.kakaoPlaceId,
                      place.placeName || place.name || "Unknown Place",
                    );
                    window.open(
                      "https://forms.gle/ovuJefBDYvxFt3DV6",
                      "_blank",
                    );
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  접근성 정보 등록하기
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>접근성 정보 업로드</DialogTitle>
            <DialogDescription className="text-gray-500 text-sm">
              신촌 지역의 접근성 정보를 공유하여 다른 사용자들에게 도움을
              주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">가이드라인</h3>
              <div className="bg-amber-50 p-3 rounded-md text-sm">
                <p className="text-amber-800">{guideText[activeTab]}</p>
              </div>
            </div>

            {/* AccessibilityImageUpload component */}
            <AccessibilityImageUpload
              placeId={place.kakaoPlaceId || place.id}
              placeName={place.placeName || place.name}
              onUploadSuccess={(imageUrl) => {
                toast({
                  title: "이미지 업로드 성공",
                  description: "사진이 업로드되어 접근성 여부를 처리중입니다",
                  duration: 3000,
                });

                // Refresh images after upload
                fetchPlaceImages();

                // Close dialog after successful upload
                setShowUploadDialog(false);
              }}
              onUploadError={(error) => {
                toast({
                  title: "이미지 업로드 실패",
                  description:
                    "이미지 업로드 중 오류가 발생했습니다. 다시 시도해주세요.",
                  variant: "destructive",
                  duration: 3000,
                });
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full p-4">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={selectedImage}
              alt="확대 이미지"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
