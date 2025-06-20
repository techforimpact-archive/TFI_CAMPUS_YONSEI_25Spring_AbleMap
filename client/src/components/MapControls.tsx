import { Button } from "@/components/ui/button";
import { Plus, Minus, MapPin, Layers, RefreshCw } from "lucide-react";

interface MapControlsProps {
  zoomIn: () => void;
  zoomOut: () => void;
  moveToCurrentLocation: () => void;
  toggleMapType: () => void;
  searchCurrentLocation: () => void;
}

export default function MapControls({
  zoomIn,
  zoomOut,
  moveToCurrentLocation,
  toggleMapType,
  searchCurrentLocation,
}: MapControlsProps) {
  return (
    <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <Button
          variant="ghost"
          className="p-2 hover:bg-gray-100 block w-full text-center"
          onClick={zoomIn}
        >
          <Plus className="h-5 w-5 mx-auto" />
        </Button>
        <hr className="border-gray-200" />
        <Button
          variant="ghost"
          className="p-2 hover:bg-gray-100 block w-full text-center"
          onClick={zoomOut}
        >
          <Minus className="h-5 w-5 mx-auto" />
        </Button>
      </div>

      <Button
        variant="outline"
        className="bg-white p-2.5 rounded-lg shadow-md hover:bg-gray-100"
        title="현재 위치"
        onClick={moveToCurrentLocation}
      >
        <MapPin className="h-5 w-5 text-gray-700" />
      </Button>

      <Button
        variant="outline"
        className="bg-white p-2.5 rounded-lg shadow-md hover:bg-gray-100"
        title="지도 종류"
        onClick={toggleMapType}
      >
        <Layers className="h-5 w-5 text-gray-700" />
      </Button>
      
      <Button
        variant="outline"
        className="bg-white/95 py-2 px-3 rounded-full shadow-md hover:bg-blue-50 flex items-center gap-1.5 text-blue-600 border-blue-100"
        title="현 위치에서 검색"
        onClick={searchCurrentLocation}
      >
        <RefreshCw className="h-4 w-4" />
        <span className="text-sm font-medium">현 위치에서 검색</span>
      </Button>
    </div>
  );
}
