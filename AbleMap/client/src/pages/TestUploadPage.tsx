import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UserImageUpload from '@/components/UserImageUpload';

export default function TestUploadPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>사용자 이미지 업로드 테스트</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-6">
              접근성 정보를 위한 이미지 업로드 기능을 테스트해보세요.
            </p>
            
            <UserImageUpload 
              poiId="8375653" 
              placeName="버거킹 신촌1점"
              onUploadSuccess={() => {
                console.log('업로드 성공!');
                // 페이지 새로고침으로 업로드된 이미지 확인
                window.location.reload();
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}