import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, Camera, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getKakaoAccessToken } from "@/lib/kakaoAuth";
import { trackEvent } from "@/lib/amplitude";

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  poiId: string;
  placeName: string;
  onUploadSuccess?: () => void;
}

export default function ImageUploadModal({ 
  isOpen, 
  onClose, 
  poiId, 
  placeName,
  onUploadSuccess 
}: ImageUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "오류",
        description: "이미지 파일만 업로드할 수 있습니다.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "오류",
        description: "파일 크기가 너무 큽니다. 10MB 이하의 파일을 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Track file selection
    trackEvent('image_upload_file_selected', {
      place_id: poiId,
      place_name: placeName,
      file_size: file.size,
      file_type: file.type,
      timestamp: new Date().toISOString()
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const accessToken = getKakaoAccessToken();
    if (!accessToken) {
      toast({
        title: "로그인 필요",
        description: "이미지를 업로드하려면 로그인해주세요.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('poiId', poiId);
      formData.append('placeName', placeName);

      const response = await fetch('/api/user-images/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        
        toast({
          title: "업로드 성공",
          description: "이미지가 성공적으로 업로드되었습니다.",
        });

        // Track successful upload
        trackEvent('image_upload_success', {
          place_id: poiId,
          place_name: placeName,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          timestamp: new Date().toISOString()
        });

        // Reset form
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Call success callback
        onUploadSuccess?.();
        
        // Close modal
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "업로드에 실패했습니다.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      
      // Track upload failure
      trackEvent('image_upload_error', {
        place_id: poiId,
        place_name: placeName,
        error_message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      });

      toast({
        title: "업로드 실패",
        description: error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            접근성 정보 업로드
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p className="font-medium">{placeName}</p>
            <p>장소의 접근성 정보를 다른 사용자들과 공유해주세요.</p>
          </div>

          {/* Upload Guidelines */}
          <div className="bg-blue-50 p-3 rounded-lg text-sm">
            <h4 className="font-medium text-blue-900 mb-1">업로드 가이드</h4>
            <ul className="text-blue-800 space-y-1 text-xs">
              <li>• 출입구, 화장실, 엘리베이터 등의 접근성 시설</li>
              <li>• 휠체어 접근 가능 여부를 보여주는 사진</li>
              <li>• 계단, 경사로, 턱 높이 등의 장애물 정보</li>
            </ul>
          </div>

          {/* File Upload Area */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            {previewUrl ? (
              <div className="space-y-3">
                <div className="relative">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 text-center">
                  {selectedFile?.name} ({Math.round((selectedFile?.size || 0) / 1024)} KB)
                </p>
              </div>
            ) : (
              <div className="text-center">
                <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    이미지 선택
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  JPG, PNG, GIF (최대 10MB)
                </p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              취소
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? "업로드 중..." : "업로드"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}