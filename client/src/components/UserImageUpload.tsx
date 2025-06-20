import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserImageUploadProps {
  poiId: string;
  placeName: string;
  onUploadSuccess?: () => void;
}

export default function UserImageUpload({ poiId, placeName, onUploadSuccess }: UserImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();
  
  // 로그인 상태 확인
  const accessToken = localStorage.getItem('kakaoAccessToken');
  const isLoggedIn = !!accessToken;

  // 파일 선택 핸들러
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 이미지 파일 검증
      if (!file.type.startsWith('image/')) {
        toast({
          title: "파일 형식 오류",
          description: "이미지 파일만 업로드할 수 있습니다.",
          variant: "destructive"
        });
        return;
      }
      
      // 파일 크기 검증 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "파일 크기 오류",
          description: "파일 크기는 5MB 이하여야 합니다.",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedFile(file);
      setUploadStatus('idle');
    }
  };

  // 이미지 업로드 핸들러
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "입력 오류",
        description: "이미지 파일을 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    if (!isLoggedIn) {
      toast({
        title: "로그인 필요",
        description: "이미지 업로드를 위해 로그인이 필요합니다.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      // FormData 생성
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('poiId', poiId);
      formData.append('placeName', placeName);

      // 서버에 업로드 요청 (인증 토큰 포함)
      const response = await fetch('/api/user-images/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '업로드에 실패했습니다.');
      }

      const result = await response.json();
      
      setUploadStatus('success');
      toast({
        title: "업로드 성공",
        description: "이미지가 성공적으로 업로드되었습니다.",
      });

      // 폼 초기화
      setSelectedFile(null);
      
      // 업로드 성공 콜백 호출
      if (onUploadSuccess) {
        onUploadSuccess();
      }

    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      setUploadStatus('error');
      toast({
        title: "업로드 실패",
        description: error instanceof Error ? error.message : "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          이미지 업로드
        </CardTitle>
        <p className="text-sm text-gray-600">
          {placeName}에 대한 이미지를 업로드해보세요
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 로그인 상태 알림 */}
        {!isLoggedIn && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <Lock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-700">
              이미지 업로드를 위해 로그인이 필요합니다.
            </span>
          </div>
        )}

        {/* 파일 선택 */}
        <div className="space-y-2">
          <Label htmlFor="image">이미지 선택</Label>
          <Input
            id="image"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isUploading || !isLoggedIn}
          />
          {selectedFile && (
            <p className="text-sm text-gray-500">
              선택된 파일: {selectedFile.name}
            </p>
          )}
        </div>

        {/* 업로드 상태 표시 */}
        {uploadStatus === 'success' && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">업로드가 완료되었습니다!</span>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">업로드에 실패했습니다.</span>
          </div>
        )}

        {/* 업로드 버튼 */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || !isLoggedIn || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              업로드 중...
            </>
          ) : !isLoggedIn ? (
            <>
              <Lock className="h-4 w-4 mr-2" />
              로그인 필요
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              이미지 업로드
            </>
          )}
        </Button>

        {/* 안내 텍스트 */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• 이미지 파일만 업로드 가능합니다.</p>
          <p>• 최대 파일 크기: 5MB</p>
          <p>• 업로드된 이미지는 다른 사용자들과 공유됩니다.</p>
          {isLoggedIn && <p>• 로그인된 사용자명으로 자동 등록됩니다.</p>}
        </div>
      </CardContent>
    </Card>
  );
}