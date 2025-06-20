import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import FeedbackModal from "./FeedbackModal";

interface FeedbackFloatingButtonProps {
  hide?: boolean;
}

export default function FeedbackFloatingButton({ hide = false }: FeedbackFloatingButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);

  useEffect(() => {
    // 다양한 UI 상태 변화를 감지해서 버튼 숨김 처리
    const handlePlaceModalOpen = () => setShouldHide(true);
    const handlePlaceModalClose = () => setShouldHide(false);
    const handleSearchActive = () => setShouldHide(true);
    const handleSearchInactive = () => setShouldHide(false);

    // 모든 이벤트 리스너 등록
    window.addEventListener('placeModalOpen', handlePlaceModalOpen);
    window.addEventListener('placeModalClose', handlePlaceModalClose);
    window.addEventListener('searchActive', handleSearchActive);
    window.addEventListener('searchInactive', handleSearchInactive);

    // 바텀시트 감지 로직 - 무한루프 완전 방지
    let lastState = false;
    
    const checkForBottomSheet = () => {
      // 1. 피드백 모달이 열려있으면 아무것도 하지 않음
      if (isModalOpen) {
        return;
      }
      
      // 2. PlaceDetailPanel과 PlaceDetailsWithAccessibility 모달 감지
      const placeDetailPanel = document.querySelector('.info-panel'); // PlaceDetailPanel
      const placeDetailModal = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50.z-50'); // PlaceDetailsWithAccessibility
      
      const hasBottomSheet = placeDetailPanel !== null || placeDetailModal !== null;
      
      // 3. 상태가 실제로 변경될 때만 업데이트 (무한루프 방지)
      if (hasBottomSheet !== lastState) {
        lastState = hasBottomSheet;
        setShouldHide(hasBottomSheet);
      }
    };

    // 1초마다 확인 (성능 최적화)
    const interval = setInterval(checkForBottomSheet, 1000);

    return () => {
      window.removeEventListener('placeModalOpen', handlePlaceModalOpen);
      window.removeEventListener('placeModalClose', handlePlaceModalClose);
      window.removeEventListener('searchActive', handleSearchActive);
      window.removeEventListener('searchInactive', handleSearchInactive);
      clearInterval(interval);
    };
  }, [isModalOpen]);

  // 바텀시트가 열려있거나 hide prop이 true일 때 버튼 숨김
  if (shouldHide || hide) {
    return null;
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 bg-[#FFD745] hover:bg-[#E6C23D] text-gray-800 rounded-[20px] shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 px-4 py-3 space-x-2"
        aria-label="서비스 의견 보내기"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-medium whitespace-nowrap">
          서비스 의견 보내기
        </span>
      </button>

      {/* 피드백 모달 */}
      <FeedbackModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
      />
    </>
  );
}