import { Place, Category, Facility, SearchResult } from "@shared/schema";

export interface MapMarker {
  id: number;
  position: {
    lat: string;
    lng: string;
  };
  place: Place;
  markerRef?: any; // Reference to the Kakao Maps marker object
}

export interface KakaoMapOptions {
  center: {
    lat: string;
    lng: string;
  };
  level: number;
  draggable?: boolean;
  zoomable?: boolean;
  restrictBounds?: boolean;
}

export interface KakaoPlaceSearchResult {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  phone: string;
  category_name: string;
  place_url: string;
  distance: string;
}

export interface CategoryWithActive extends Category {
  active: boolean;
}
