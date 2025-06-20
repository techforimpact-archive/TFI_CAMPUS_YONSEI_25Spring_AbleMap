import { RefObject } from "react";
import { Place } from "@shared/schema";
import PlaceDetailPanel from "./PlaceDetailPanel";
import MapControls from "./MapControls";
import { Button } from "@/components/ui/button";
import { MapPinIcon, ListIcon } from "lucide-react";

interface MapContainerProps {
  mapRef: RefObject<HTMLDivElement>;
  loading: boolean;
  selectedPlace: Place | null;
  closePlaceDetail: () => void;
  moveToCurrentLocation: () => void;
  toggleMapType: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  togglePlacesList: () => void;
  searchCurrentLocation: () => void;
  isMobile: boolean;
  onAccessibilityCheck?: () => void;
}

export default function MapContainer({
  mapRef,
  loading,
  selectedPlace,
  closePlaceDetail,
  moveToCurrentLocation,
  toggleMapType,
  zoomIn,
  zoomOut,
  togglePlacesList,
  searchCurrentLocation,
  isMobile,
  onAccessibilityCheck,
}: MapContainerProps) {
  return (
    <div className="flex-1 relative h-full" style={{ minHeight: "calc(100vh - 64px)" }}>
      <div className="map-container" ref={mapRef} style={{ width: "100%", height: "100%", minHeight: "500px" }}>
        {/* Map Loading Indicator */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50 ${
            loading ? "" : "hidden"
          }`}
          id="mapLoading"
        >
          <div className="flex flex-col items-center">
            <svg
              className="animate-spin h-10 w-10 text-map-blue mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-gray-700">지도를 불러오는 중...</p>
            <p className="text-sm text-gray-500 mt-2">* 개발환경에서는 Kakao Maps API 키가 필요합니다.</p>
          </div>
        </div>

        {/* Map Controls */}
        <MapControls
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          moveToCurrentLocation={moveToCurrentLocation}
          toggleMapType={toggleMapType}
          searchCurrentLocation={searchCurrentLocation}
        />

        {/* Place Detail Panel */}
        {selectedPlace && (
          <PlaceDetailPanel
            selectedPlace={selectedPlace}
            closePlaceDetail={closePlaceDetail}
            isMobile={isMobile}
            onAccessibilityCheck={onAccessibilityCheck}
          />
        )}
      </div>

      {/* Mobile Controls */}
      {isMobile && (
        <>
          {/* Current Location Button (Mobile) */}
          <Button
            variant="default"
            size="icon"
            className="md:hidden absolute left-4 bottom-4 bg-white p-3 rounded-full shadow-lg z-20"
            onClick={moveToCurrentLocation}
          >
            <MapPinIcon className="h-6 w-6 text-map-blue" />
          </Button>

          {/* Show List Button (Mobile) */}
          <Button
            variant="default"
            size="icon"
            className="md:hidden absolute right-4 bottom-4 bg-kakao-yellow p-3 rounded-full shadow-lg z-20"
            onClick={togglePlacesList}
          >
            <ListIcon className="h-6 w-6 text-kakao-brown" />
          </Button>
        </>
      )}
    </div>
  );
}
