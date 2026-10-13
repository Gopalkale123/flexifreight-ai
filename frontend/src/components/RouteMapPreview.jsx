import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, Maximize2, Minimize2, MapPin, Navigation } from 'lucide-react';

/**
 * Creates custom SVG glowing markers for Pickup (emerald) and Dropoff (amber).
 */
const createCustomMarker = (type = 'pickup', label = 'P') => {
  const isPickup = type === 'pickup';
  const color = isPickup ? '#10b981' : '#f59e0b';
  const bgGlow = isPickup ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)';

  const html = `
    <div style="
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    ">
      <div style="
        position: absolute;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${bgGlow};
        animation: pulse 2s infinite;
      "></div>
      <div style="
        position: relative;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #0f172a;
        border: 2px solid ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${color};
        font-weight: 800;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      ">
        ${label}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-map-pin',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
};

export function RouteMapPreview({
  pickupCoords,
  dropCoords,
  routePolyline = [],
  distanceKm,
  durationText,
  calculationSource,
  pickupLabel,
  dropLabel
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const pLat = pickupCoords?.lat;
  const pLng = pickupCoords?.lng;
  const dLat = dropCoords?.lat;
  const dLng = dropCoords?.lng;

  const hasValidCoords = pLat != null && pLng != null && dLat != null && dLng != null &&
    !isNaN(pLat) && !isNaN(pLng) && !isNaN(dLat) && !isNaN(dLng);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center on coordinates or fallback to Maharashtra
    const defaultCenter = [pLat || 19.7515, pLng || 75.7139];

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 7,
        zoomControl: false,
        attributionControl: false
      });
      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      // OpenStreetMap public tiles
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing layers (except base tile layer)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    if (hasValidCoords) {
      L.marker([pLat, pLng], { icon: createCustomMarker('pickup', 'P') })
        .addTo(map)
        .bindPopup(`<b>Pickup:</b> ${pickupLabel || 'Origin'}<br><span style="font-size:11px;color:#64748b">(${pLat.toFixed(4)}, ${pLng.toFixed(4)})</span>`);

      L.marker([dLat, dLng], { icon: createCustomMarker('drop', 'D') })
        .addTo(map)
        .bindPopup(`<b>Drop:</b> ${dropLabel || 'Destination'}<br><span style="font-size:11px;color:#64748b">(${dLat.toFixed(4)}, ${dLng.toFixed(4)})</span>`);

      // Determine polyline coordinates
      let polylinePoints = [];
      if (routePolyline && routePolyline.length > 1) {
        polylinePoints = routePolyline;
      } else {
        polylinePoints = [[pLat, pLng], [dLat, dLng]];
      }

      // Draw road route line
      L.polyline(polylinePoints, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: (routePolyline && routePolyline.length > 2) ? null : '6, 8'
      }).addTo(map);

      // Fit bounds to show both points with comfortable padding
      try {
        const bounds = L.latLngBounds([[pLat, pLng], [dLat, dLng]]);
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
      } catch (e) {
        console.warn("Bounds fitting error:", e);
      }
    }

    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => clearTimeout(timeout);
  }, [pLat, pLng, dLat, dLng, routePolyline, pickupLabel, dropLabel, hasValidCoords, isExpanded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const googleMapsUrl = hasValidCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=${pLat},${pLng}&destination=${dLat},${dLng}&travelmode=driving`
    : '#';

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-inner group">
      {/* Top Map HUD Bar */}
      <div className="absolute top-2 left-2 right-2 z-[1005] flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/80 text-[11px] font-mono text-slate-300 shadow-lg pointer-events-auto flex items-center gap-2">
          <Navigation className="w-3 h-3 text-blue-400" />
          <span className="font-semibold text-white">{distanceKm ? `${distanceKm} km` : 'Route Map'}</span>
          {durationText && <span className="text-slate-400">• {durationText}</span>}
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          {hasValidCoords && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 backdrop-blur-md border border-blue-400/50 text-white text-[11px] font-bold rounded-lg shadow-lg flex items-center gap-1.5 transition group"
              title="Open full interactive directions in Google Maps"
            >
              <svg className="w-3.5 h-3.5 text-white flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/>
              </svg>
              <span>Google Maps Full Screen</span>
              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-white rounded-lg shadow-lg transition cursor-pointer"
            title={isExpanded ? "Collapse Map" : "Expand Map (460px)"}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Leaflet Map DOM Element */}
      <div
        ref={mapContainerRef}
        style={{ height: isExpanded ? '460px' : '230px' }}
        className="w-full transition-all duration-300"
      />

      {/* Bottom Route Legend */}
      <div className="px-3 py-1.5 bg-slate-900/95 border-t border-slate-800 text-[11px] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-medium truncate max-w-[150px]">{pickupLabel || 'Pickup'}</span>
          </div>
          <span className="text-slate-600">➔</span>
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="font-medium truncate max-w-[150px]">{dropLabel || 'Drop'}</span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400">
          Engine: <span className="text-blue-300 font-semibold">{calculationSource || 'OSRM Road Network'}</span>
        </div>
      </div>
    </div>
  );
}
