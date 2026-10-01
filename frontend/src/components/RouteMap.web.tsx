import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors, radii } from '@/constants/theme';
import type { RouteMapProps } from './RouteMap';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** The route on an OpenStreetMap map (Leaflet). Fits the whole route, or follows the latest point while recording. */
export function RouteMap({ segments, height, follow = false }: RouteMapProps) {
  const containerRef = useRef<View>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    // On the web, a View's ref is its DOM element.
    const element = containerRef.current as unknown as HTMLElement | null;
    if (!element || mapRef.current) return;
    const map = L.map(element, { zoomControl: true, attributionControl: true });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.setView([20, 0], 2);
    mapRef.current = map;
    // The container may have been sized after Leaflet measured it.
    const resize = setTimeout(() => map.invalidateSize(), 50);
    return () => {
      clearTimeout(resize);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const lines = segments.filter((s) => s.length).map((s) => s.map(([lat, lng]) => L.latLng(lat, lng)));
    if (!lines.length) return;
    for (const line of lines) {
      L.polyline(line, { color: colors.primary, weight: 5, opacity: 0.9, lineJoin: 'round' }).addTo(layer);
    }
    const first = lines[0][0];
    const lastLine = lines[lines.length - 1];
    const last = lastLine[lastLine.length - 1];
    L.circleMarker(first, { radius: 7, color: '#fff', weight: 2, fillColor: colors.success, fillOpacity: 1 }).addTo(layer);
    L.circleMarker(last, {
      radius: follow ? 8 : 7,
      color: '#fff',
      weight: 2,
      fillColor: follow ? colors.primary : colors.text,
      fillOpacity: 1,
    }).addTo(layer);
    if (follow) map.setView(last, Math.max(map.getZoom(), 16));
    else map.fitBounds(L.latLngBounds(lines.flat()), { padding: [24, 24], maxZoom: 17 });
  }, [segments, follow]);

  return (
    <View
      ref={containerRef}
      style={{ height, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}
      accessibilityLabel="Route map"
    />
  );
}
