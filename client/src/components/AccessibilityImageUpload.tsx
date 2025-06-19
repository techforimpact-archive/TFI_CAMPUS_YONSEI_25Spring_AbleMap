import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Upload, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface AccessibilityImageUploadProps {
  placeId: number | string;
  placeName?: string;
  onUploadSuccess?: (imageUrl: string) => void;
  onUploadError?: (error: any) => void;
}

const AccessibilityImageUpload: React.FC<AccessibilityImageUploadProps> = ({
  placeId,
  placeName,
  onUploadSuccess,
  onUploadError
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [imageType, setImageType] = useState<string>("entrance");
  const [description, setDescription] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    imageUrl?: string;
  } | null>(null);
  
  // 로그인 상태 확인
  const accessToken = localStorage.getItem('kakaoAccessToken');
  const isLoggedIn = !!accessToken;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      // Check if file is an image
      if (!selectedFile.type.startsWith('image/')) {
        setUploadResult({
          success: false,
          message: "이미지 파일만 업로드 가능합니다.",
        });
        return;
      }
      
      // Reset previous results
      setUploadResult(null);
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadResult({
        success: false,
        message: "이미지 파일을 선택해주세요.",
      });
      return;
    }

    if (!isLoggedIn) {
      setUploadResult({
        success: false,
        message: "이미지 업로드를 위해 로그인이 필요합니다.",
      });
      return;
    }

    try {
      setIsUploading(true);
      console.log("=== 프론트엔드 이미지 업로드 시작 ===");
      console.log("업로드할 파일:", file.name, "크기:", file.size, "bytes");
      console.log("장소 정보:", { placeId, placeName });
      
      // FormData 생성 및 데이터 추가
      const formData = new FormData();
      formData.append('image', file);
      formData.append('poiId', placeId.toString());
      formData.append('placeName', placeName || description || '접근성 이미지');
      
      console.log("FormData 생성 완료");
      console.log("인증 토큰 존재:", !!accessToken);

      // 서버로 업로드 요청 전송
      console.log("서버 업로드 요청 전송 중...");
      const response = await fetch('/api/user-images/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      console.log("서버 응답 상태:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("업로드 실패:", errorData);
        throw new Error(errorData.message || `업로드 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log("업로드 성공 응답:", result);
      
      setUploadResult({
        success: true,
        message: result.message || "사진이 업로드되어 접근성 여부를 처리중입니다",
        imageUrl: result.userImage?.imageUrl,
      });
      
      console.log("업로드 결과 설정 완료");
      
      if (onUploadSuccess && result.userImage?.imageUrl) {
        console.log("성공 콜백 실행:", result.userImage.imageUrl);
        onUploadSuccess(result.userImage.imageUrl);
      }
    } catch (error) {
      console.error("Image upload error:", error);
      
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : "이미지 업로드 중 오류가 발생했습니다.",
      });
      
      if (onUploadError) {
        onUploadError(error);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>접근성 이미지 업로드</CardTitle>
        <CardDescription>장소의 접근성 정보를 위한 이미지를 업로드해주세요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 로그인 상태 알림 */}
        {!isLoggedIn && (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>로그인 필요</AlertTitle>
            <AlertDescription>
              이미지 업로드를 위해 로그인이 필요합니다.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="image-type">이미지 종류</Label>
          <Select
            value={imageType}
            onValueChange={setImageType}
            disabled={!isLoggedIn}
          >
            <SelectTrigger id="image-type">
              <SelectValue placeholder="이미지 종류 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entrance">입구/출입구</SelectItem>
              <SelectItem value="elevator">엘리베이터</SelectItem>
              <SelectItem value="toilet">화장실</SelectItem>
              <SelectItem value="other">기타 시설</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="image-description">설명 (선택사항)</Label>
          <Input
            id="image-description"
            placeholder="이미지에 대한 설명을 입력해주세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isLoggedIn}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="image-file">이미지 파일</Label>
          <Input
            id="image-file"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={!isLoggedIn}
          />
          {file && (
            <p className="text-sm text-muted-foreground">
              선택한 파일: {file.name} ({Math.round(file.size / 1024)} KB)
            </p>
          )}
        </div>

        {uploadResult && (
          <Alert variant={uploadResult.success ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {uploadResult.success ? "업로드 성공" : "업로드 실패"}
            </AlertTitle>
            <AlertDescription>{uploadResult.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleUpload} 
          disabled={!file || isUploading || !isLoggedIn}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              업로드 중...
            </>
          ) : !isLoggedIn ? (
            <>
              <Lock className="mr-2 h-4 w-4" />
              로그인 필요
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              이미지 업로드
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AccessibilityImageUpload;