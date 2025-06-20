import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { getUTMParams, getStoredUTMParams, hasUTMParams, getCurrentOrStoredUTMParams, getUTMTimestamp } from '@/lib/utm';
import { captureUTMParameters, trackEventWithUTM } from '@/lib/amplitude';
import { toast } from '@/hooks/use-toast';

export default function UTMTestPanel() {
  const [currentUTM, setCurrentUTM] = useState<any>({});
  const [storedUTM, setStoredUTM] = useState<any>({});
  const [utmTimestamp, setUtmTimestamp] = useState<string | null>(null);
  const [hasCurrentUTM, setHasCurrentUTM] = useState(false);

  const refreshUTMData = () => {
    const current = getUTMParams();
    const stored = getStoredUTMParams();
    const timestamp = getUTMTimestamp();
    const hasCurrent = hasUTMParams();

    setCurrentUTM(current);
    setStoredUTM(stored || {});
    setUtmTimestamp(timestamp);
    setHasCurrentUTM(hasCurrent);
  };

  useEffect(() => {
    refreshUTMData();
  }, []);

  const testUTMLinks = [
    {
      name: '구글 광고 테스트',
      url: `${window.location.origin}?utm_source=google&utm_medium=cpc&utm_campaign=accessibility_search&utm_term=장애인접근성&utm_content=text_ad`
    },
    {
      name: '페이스북 광고 테스트',
      url: `${window.location.origin}?utm_source=facebook&utm_medium=social&utm_campaign=accessibility_awareness&utm_content=carousel_ad`
    },
    {
      name: '이메일 뉴스레터 테스트',
      url: `${window.location.origin}?utm_source=newsletter&utm_medium=email&utm_campaign=monthly_update&utm_content=feature_announcement`
    },
    {
      name: '유튜브 영상 테스트',
      url: `${window.location.origin}?utm_source=youtube&utm_medium=video&utm_campaign=accessibility_tutorial&utm_content=description_link`
    }
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "링크 복사됨",
      description: "UTM 테스트 링크가 클립보드에 복사되었습니다.",
    });
  };

  const testUTMCapture = () => {
    const result = captureUTMParameters();
    refreshUTMData();
    
    if (result) {
      toast({
        title: "UTM 캡처 성공",
        description: `${Object.keys(result).length}개의 UTM 파라미터가 캡처되었습니다.`,
      });
    } else {
      toast({
        title: "UTM 파라미터 없음",
        description: "현재 URL에 UTM 파라미터가 없습니다.",
        variant: "destructive"
      });
    }
  };

  const testEventWithUTM = () => {
    trackEventWithUTM('utm_test_event', {
      test_type: 'manual_test',
      timestamp: new Date().toISOString()
    });
    
    toast({
      title: "테스트 이벤트 전송",
      description: "UTM 컨텍스트가 포함된 테스트 이벤트가 전송되었습니다.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            UTM 파라미터 트래킹 테스트
            <Button size="sm" variant="outline" onClick={refreshUTMData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 현재 UTM 상태 */}
          <div>
            <h4 className="font-semibold mb-2">현재 URL UTM 파라미터</h4>
            {hasCurrentUTM ? (
              <div className="space-y-2">
                {Object.entries(currentUTM).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Badge variant="outline">{key}</Badge>
                    <span className="text-sm">{value as string}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">현재 URL에 UTM 파라미터가 없습니다.</p>
            )}
          </div>

          {/* 저장된 UTM 데이터 */}
          <div>
            <h4 className="font-semibold mb-2">저장된 UTM 파라미터</h4>
            {Object.keys(storedUTM).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(storedUTM).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Badge variant="secondary">{key}</Badge>
                    <span className="text-sm">{value as string}</span>
                  </div>
                ))}
                {utmTimestamp && (
                  <p className="text-xs text-muted-foreground">
                    캡처 시간: {new Date(utmTimestamp).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">저장된 UTM 파라미터가 없습니다.</p>
            )}
          </div>

          {/* 테스트 버튼 */}
          <div className="flex gap-2">
            <Button onClick={testUTMCapture} variant="outline">
              UTM 캡처 테스트
            </Button>
            <Button onClick={testEventWithUTM} variant="outline">
              UTM 이벤트 테스트
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>UTM 테스트 링크</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {testUTMLinks.map((link, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h5 className="font-medium">{link.name}</h5>
                  <p className="text-sm text-muted-foreground truncate max-w-md">
                    {link.url}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(link.url)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(link.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-2">테스트 방법</h5>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. 위 링크 중 하나를 새 탭에서 열기</li>
              <li>2. 페이지 로드 후 UTM 파라미터가 자동으로 캡처됨</li>
              <li>3. 브라우저 개발자 도구에서 Amplitude 이벤트 확인</li>
              <li>4. URL에서 UTM 파라미터가 자동으로 제거됨</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}