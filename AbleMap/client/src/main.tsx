import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Make the Kakao Maps SDK and Kakao Login SDK available globally
declare global {
  interface Window {
    kakao: any;
    kakaoMap: any; // 전역 지도 객체 추가
    disableMarkerClick?: boolean; // 마커 클릭 비활성화 플래그
    Kakao: {
      init: (appKey: string) => void;
      isInitialized: () => boolean;
      version?: string; // Optional version property
      Auth: {
        login: (options: any) => void;
        logout: (callback: () => void) => void;
        getAccessToken: () => string | null;
      };
      API: {
        request: (options: any) => void;
      };
    };
  }
}

// Load Kakao Maps SDK script
const script = document.createElement("script");
script.async = true;
// Get API key from environment variables if available
const apiKey = import.meta.env.VITE_KAKAO_MAPS_API_KEY || 'DEMO_KEY';
script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,clusterer,drawing&autoload=false`;
document.head.appendChild(script);

createRoot(document.getElementById("root")!).render(<App />);
