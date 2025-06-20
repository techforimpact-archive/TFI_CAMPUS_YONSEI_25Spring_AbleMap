import { useState } from "react";
import { Check, X, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const satisfiedFeedbackOptions = [
  "출입로 접근성 정확해요",
  "화장실 정보가 정확해요", 
  "엘리베이터 정보가 정확해요",
  "장소 정보를 요약해줘서 편리해요",
  "어플이 사용하기 쉬워요",
  "기존 지도 어플보다 유용한 정보를 제공해요"
];

const dissatisfiedFeedbackOptions = [
  "출입로 정보가 정확하지 않아요",
  "화장실 정보가 정확하지 않아요",
  "엘리베이터 정보가 정확하지 않아요",
  "장소 정보 요약이 도움이 안돼요",
  "어플이 사용하기 어려워요",
  "기존 지도 어플보다 유용한 정보를 제공하지 않아요"
];

export default function FeedbackModal({
  open,
  onOpenChange,
}: FeedbackModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedFeedback, setSelectedFeedback] = useState<'satisfied' | 'dissatisfied' | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<string[]>([]);
  const [customFeedback, setCustomFeedback] = useState<string>("");

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: {
      satisfactionLevel: string;
      feedbackDetails: string[];
      userAgent: string;
      deviceId?: string;
      userId?: string;
    }) => {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData),
      });
      
      if (!response.ok) {
        throw new Error('피드백 제출에 실패했습니다');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // 모달 먼저 닫기
      onOpenChange(false);
      resetModal();
      
      // 약간의 지연 후 토스트 메시지 표시 (모달이 완전히 닫힌 후)
      setTimeout(() => {
        toast({
          title: "소중한 의견 주셔서 감사합니다! 😊",
          description: "더 나은 서비스를 만들어가겠습니다.",
          duration: 2000,
        });
      }, 300);
    },
    onError: (error) => {
      console.error('피드백 제출 오류:', error);
      toast({
        title: "제출 실패",
        description: "피드백 제출에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  });

  const resetModal = () => {
    setStep(1);
    setSelectedFeedback(null);
    setSelectedDetails([]);
    setCustomFeedback("");
  };

  const handlePositiveFeedback = () => {
    setSelectedFeedback('satisfied');
    setStep(2);
  };

  const handleNegativeFeedback = () => {
    setSelectedFeedback('dissatisfied');
    setStep(2);
  };

  const toggleDetailOption = (option: string) => {
    setSelectedDetails(prev => 
      prev.includes(option) 
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  const handleSubmit = (satisfaction: string, details: string[]) => {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }

    // 자유 텍스트 피드백이 있으면 details에 추가
    const allDetails = [...details];
    if (customFeedback.trim()) {
      allDetails.push(`기타 의견: ${customFeedback.trim()}`);
    }

    const feedbackData = {
      satisfactionLevel: satisfaction,
      feedbackDetails: allDetails,
      userAgent: navigator.userAgent,
      deviceId: deviceId,
    };

    submitFeedbackMutation.mutate(feedbackData);
  };

  const handleDetailSubmit = () => {
    if (selectedFeedback) {
      handleSubmit(selectedFeedback, selectedDetails);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetModal();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold text-gray-800">
            서비스 의견 보내기
          </DialogTitle>
        </DialogHeader>
        
        {step === 1 && (
          <div className="py-6">
            <div className="text-center mb-8">
              <p className="text-lg text-gray-700 leading-relaxed">
                본 서비스를 추후에도<br />
                사용할 의향이 있으신가요?
              </p>
            </div>
            
            <div className="flex justify-center space-x-12">
              {/* 긍정적 피드백 버튼 */}
              <div className="flex flex-col items-center space-y-3">
                <button
                  onClick={handlePositiveFeedback}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 transition-colors duration-200 flex items-center justify-center"
                >
                  <Check className="w-8 h-8 text-white" />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  네, 있습니다
                </span>
              </div>
              
              {/* 부정적 피드백 버튼 */}
              <div className="flex flex-col items-center space-y-3">
                <button
                  onClick={handleNegativeFeedback}
                  disabled={submitFeedbackMutation.isPending}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
                >
                  <X className="w-8 h-8 text-white" />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  아니요, 없습니다
                </span>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="py-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">
                {selectedFeedback === 'satisfied' ? (
                  <>어떤 점이 <span className="text-yellow-600">유용</span>하셨나요?</>
                ) : (
                  <>어떤 점이 <span className="text-yellow-600">불만족</span>스러웠나요?</>
                )}
              </h3>
              <p className="text-sm text-gray-600">
                개선해야 할 점을 알려주세요.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (중복 선택 가능)
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {(selectedFeedback === 'satisfied' ? satisfiedFeedbackOptions : dissatisfiedFeedbackOptions).map((option: string, index: number) => (
                <button
                  key={index}
                  onClick={() => toggleDetailOption(option)}
                  className={`w-full p-3 text-left rounded-lg border transition-all duration-200 flex items-center gap-3 ${
                    selectedDetails.includes(option)
                      ? 'border-gray-400 bg-gray-200'
                      : 'border-gray-200 bg-gray-100 hover:bg-gray-150'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedDetails.includes(option)
                      ? 'border-gray-600 bg-gray-600'
                      : 'border-gray-300'
                  }`}>
                    {selectedDetails.includes(option) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm">{option}</span>
                </button>
              ))}
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-2 text-center">
                다른 의견이 있으면 알려주세요.
              </p>
              <textarea
                value={customFeedback}
                onChange={(e) => setCustomFeedback(e.target.value)}
                placeholder="더 나은 서비스를 위한 소중한 의견을 남겨주세요."
                className="w-full p-3 border border-gray-200 rounded-lg resize-none h-20 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={200}
              />
              <p className="text-xs text-gray-400 text-right mt-1">
                {customFeedback.length}/200
              </p>
            </div>

            <Button 
              onClick={handleDetailSubmit}
              disabled={submitFeedbackMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
            >
              {submitFeedbackMutation.isPending ? '제출 중...' : '제출하기'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}