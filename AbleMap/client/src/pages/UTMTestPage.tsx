import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UTMTestPanel from '@/components/UTMTestPanel';

export default function UTMTestPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              메인으로 돌아가기
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">UTM 파라미터 트래킹 테스트</h1>
          <p className="text-muted-foreground mt-2">
            마케팅 캠페인 추적을 위한 UTM 파라미터 캡처 및 분석 기능을 테스트할 수 있습니다.
          </p>
        </div>
        
        <UTMTestPanel />
      </div>
    </div>
  );
}