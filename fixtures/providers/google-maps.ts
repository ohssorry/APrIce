// 탐지되어야 할 유료 API 호출: 1개
import { Client } from '@googlemaps/google-maps-services-js';

const googleMaps = new Client({});

export async function geocodeAddress() {
  return googleMaps.geocode({
    params: {
      address: '서울특별시 중구 세종대로',
      key: process.env.GOOGLE_MAPS_API_KEY ?? '',
    },
  });
}
