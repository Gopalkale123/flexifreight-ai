import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Check, X, Navigation, Crosshair, Search, Loader2, Layers, ZoomIn } from 'lucide-react';

/**
 * Creates custom SVG glowing pin for the selected map location.
 */
const createPinIcon = (color = '#10b981') => {
  const html = `
    <div style="
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      transform: translate(-19px, -38px);
    ">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="${color}" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6));">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-pin-icon',
    iconSize: [0, 0]
  });
};

export function MapPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
  initialLocation,
  targetType = 'pickup',
  title,
  state = 'Maharashtra',
  district = '',
  taluka = '',
  hierarchy = null,
  t
}) {
  if (!isOpen) return null;

  const isPickup = targetType === 'pickup';
  const pinColor = isPickup ? '#10b981' : '#f59e0b';

  const defaultLat = initialLocation?.lat || 20.5937;
  const defaultLng = initialLocation?.lng || 78.9629;

  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [landmark, setLandmark] = useState(initialLocation?.landmark || initialLocation?.label || "");
  const [detectedPlace, setDetectedPlace] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoadingBoundary, setIsLoadingBoundary] = useState(false);
  const [boundaryInfo, setBoundaryInfo] = useState(null);

  // Region controls inside modal
  const [currState, setCurrState] = useState(state || 'Maharashtra');
  const [currDistrict, setCurrDistrict] = useState(district || '');
  const [currTaluka, setCurrTaluka] = useState(taluka || '');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const boundaryLayerRef = useRef(null);

  // Sync state props
  useEffect(() => {
    if (state) setCurrState(state);
    if (district) setCurrDistrict(district);
    if (taluka) setCurrTaluka(taluka);
  }, [state, district, taluka]);

  // Sync coordinates when initialLocation props change
  useEffect(() => {
    if (initialLocation?.lat && initialLocation?.lng) {
      const nLat = +Number(initialLocation.lat).toFixed(6);
      const nLng = +Number(initialLocation.lng).toFixed(6);
      setLat(nLat);
      setLng(nLng);
      setLandmark(initialLocation.landmark || initialLocation.label || "");
      if (mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.setView([nLat, nLng], 14);
        markerRef.current.setLatLng([nLat, nLng]);
      }
    }
  }, [initialLocation?.lat, initialLocation?.lng, initialLocation?.label, initialLocation?.landmark]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter = [lat || 20.5937, lng || 78.9629];
    const initialZoom = (lat && lng && (lat !== 20.5937 || lng !== 78.9629)) ? 13 : 7;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker(initialCenter, {
      icon: createPinIcon(pinColor),
      draggable: true
    }).addTo(map);

    markerRef.current = marker;
    mapInstanceRef.current = map;

    // Handle marker drag
    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      const nLat = +pos.lat.toFixed(6);
      const nLng = +pos.lng.toFixed(6);
      setLat(nLat);
      setLng(nLng);
      reverseGeocode(nLat, nLng);
    });

    // Handle map click
    map.on('click', (e) => {
      const nLat = +e.latlng.lat.toFixed(6);
      const nLng = +e.latlng.lng.toFixed(6);
      marker.setLatLng([nLat, nLng]);
      setLat(nLat);
      setLng(nLng);
      reverseGeocode(nLat, nLng);
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      boundaryLayerRef.current = null;
    };
  }, []);

  // Fetch and highlight Region Boundary Polygon (State -> District -> Taluka)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    let isMounted = true;
    setIsLoadingBoundary(true);

    const queryParams = new URLSearchParams({
      state: currState || '',
      district: currDistrict || '',
      taluka: (currTaluka && currTaluka !== '__ALL__') ? currTaluka : ''
    });

    fetch(`/api/v1/locations/boundary?${queryParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted || !mapInstanceRef.current) return;

        // Remove old boundary layer
        if (boundaryLayerRef.current) {
          mapInstanceRef.current.removeLayer(boundaryLayerRef.current);
          boundaryLayerRef.current = null;
        }

        if (data && data.found && data.geojson) {
          setBoundaryInfo(data);
          const layer = L.geoJSON(data.geojson, {
            style: {
              color: pinColor,
              weight: 2.5,
              opacity: 0.85,
              fillColor: pinColor,
              fillOpacity: 0.12,
              dashArray: '4, 4'
            }
          }).addTo(mapInstanceRef.current);

          boundaryLayerRef.current = layer;
          const bounds = layer.getBounds();
          if (bounds.isValid()) {
            mapInstanceRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
          }
        } else if (data && data.bbox) {
          setBoundaryInfo(data);
          const [south, west, north, east] = data.bbox;
          mapInstanceRef.current.fitBounds([[south, west], [north, east]], { padding: [35, 35] });
        }
      })
      .catch(err => {
        console.warn("Boundary polygon notice:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingBoundary(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currState, currDistrict, currTaluka]);

  // Reverse Geocoding helper (Calls backend /api/v1/locations/reverse)
  const reverseGeocode = async (rLat, rLng) => {
    try {
      const res = await fetch(`/api/v1/locations/reverse?lat=${rLat}&lng=${rLng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          setDetectedPlace(data);
          const villageName = data.village || data.display_name.split(',')[0];
          const postCode = data.pincode ? ` (${data.pincode})` : '';
          const fullLabel = `${villageName}${postCode}`;
          setLandmark(fullLabel);
          return;
        }
      }
    } catch (e) {
      // Fallback to OSM directly if backend call has glitch
    }

    // Direct fallback
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${rLat}&lon=${rLng}&zoom=18&addressdetails=1`, {
        headers: { 'User-Agent': 'FlexiFreightAI/2.0' }
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const placeName = addr.village || addr.suburb || addr.neighbourhood || addr.road || addr.county || data.display_name.split(',')[0];
        const postCode = addr.postcode ? ` (${addr.postcode})` : '';
        const placeObj = {
          village: placeName,
          pincode: addr.postcode || '',
          state: addr.state,
          district: addr.state_district,
          taluka: addr.county
        };
        setDetectedPlace(placeObj);
        setLandmark(`${placeName}${postCode}`);
      }
    } catch (e) {
      // Non-critical
    }
  };

  // Search Address / Village / Pincode
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    setIsSearching(true);
    try {
      // First try our localized village resolver with taluka scope!
      const params = new URLSearchParams({
        village: searchQuery.trim(),
        taluka: (currTaluka && currTaluka !== '__ALL__') ? currTaluka : '',
        district: currDistrict || '',
        state: currState || ''
      });
      const localRes = await fetch(`/api/v1/locations/resolve-village?${params.toString()}`);
      if (localRes.ok) {
        const localData = await localRes.json();
        if (localData.found && localData.best) {
          const sLat = localData.best.lat;
          const sLng = localData.best.lng;
          setLat(+sLat.toFixed(6));
          setLng(+sLng.toFixed(6));
          setLandmark(localData.best.name);
          setDetectedPlace({
            village: localData.best.name,
            pincode: '',
            state: currState,
            district: currDistrict,
            taluka: currTaluka
          });
          mapInstanceRef.current.setView([sLat, sLng], 15);
          if (markerRef.current) {
            markerRef.current.setLatLng([sLat, sLng]);
          }
          return;
        }
      }

      // Broad OSM search fallback
      const q = encodeURIComponent(`${searchQuery.trim()}, India`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
        headers: { 'User-Agent': 'FlexiFreightAI/2.0' }
      });
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const sLat = parseFloat(results[0].lat);
          const sLng = parseFloat(results[0].lon);
          setLat(+sLat.toFixed(6));
          setLng(+sLng.toFixed(6));
          setLandmark(results[0].display_name.split(',')[0]);
          mapInstanceRef.current.setView([sLat, sLng], 14);
          if (markerRef.current) {
            markerRef.current.setLatLng([sLat, sLng]);
          }
          reverseGeocode(sLat, sLng);
        }
      }
    } catch (err) {
      console.warn("Location search notice:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Locate Current GPS Position
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const cLat = +pos.coords.latitude.toFixed(6);
        const cLng = +pos.coords.longitude.toFixed(6);
        setLat(cLat);
        setLng(cLng);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([cLat, cLng], 15);
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([cLat, cLng]);
        }
        reverseGeocode(cLat, cLng);
      },
      (err) => {
        setIsLocating(false);
        alert(`Location access notice: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Re-fit boundary layer bounds
  const handleFitBoundary = () => {
    if (boundaryLayerRef.current && mapInstanceRef.current) {
      const bounds = boundaryLayerRef.current.getBounds();
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
      }
    }
  };

  const handleApply = () => {
    const chosenVillage = detectedPlace?.village || landmark || `Pin (${lat}, ${lng})`;
    const cleanPin = detectedPlace?.pincode || '';
    const villageFormatted = cleanPin ? `${chosenVillage} (${cleanPin})` : chosenVillage;

    onSelectLocation({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      village: villageFormatted,
      villageRaw: chosenVillage,
      pincode: cleanPin,
      landmark: landmark || villageFormatted,
      isCustomPin: true,
      state: detectedPlace?.state || currState,
      district: detectedPlace?.district || currDistrict,
      taluka: detectedPlace?.taluka || currTaluka
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isPickup ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
                <span>{title || (isPickup ? "Pick Exact Pickup Village / Mandi" : "Pick Exact Dropoff Village / Mandi")}</span>
              </h3>
              <p className="text-xs text-slate-400">
                Click anywhere on the map to extract village name directly into your dropdown with accurate GPS
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Region Scope & Boundary Bar */}
        <div className="px-5 py-2 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Region:</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 font-semibold">
              {currState || 'Maharashtra'}
            </span>
            {currDistrict && (
              <>
                <span className="text-slate-600">›</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 font-semibold">
                  {currDistrict}
                </span>
              </>
            )}
            {currTaluka && currTaluka !== '__ALL__' && (
              <>
                <span className="text-slate-600">›</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                  {currTaluka} Taluka
                </span>
              </>
            )}
            {isLoadingBoundary && (
              <span className="flex items-center gap-1 text-[11px] text-blue-400 animate-pulse ml-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Loading polygon...</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFitBoundary}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 flex items-center gap-1 transition"
            >
              <ZoomIn className="w-3 h-3 text-blue-400" />
              <span>Fit Region Bounds</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Fast Jump */}
        <div className="px-5 py-2.5 bg-slate-800/60 border-b border-slate-800 flex flex-col sm:flex-row gap-2 items-center">
          <form onSubmit={handleSearch} className="relative flex-1 w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search village or wadi in ${currTaluka || currDistrict || currState}...`}
              className="w-full bg-slate-900/90 border border-slate-700 focus:border-blue-500 rounded-xl pl-9 pr-20 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-1.5 top-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
            >
              {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Search"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleCurrentLocation}
            disabled={isLocating}
            className="w-full sm:w-auto px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer flex-shrink-0"
          >
            <Crosshair className={`w-3.5 h-3.5 text-blue-400 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? "Detecting GPS..." : "My GPS"}</span>
          </button>
        </div>

        {/* Leaflet Interactive Map */}
        <div className="relative flex-1 min-h-[340px] sm:min-h-[420px] bg-slate-950">
          <div ref={mapContainerRef} className="w-full h-full min-h-[340px] sm:min-h-[420px]" />
          
          {/* Floating Detected Place Card when user clicks map */}
          {landmark && (
            <div className="absolute top-3 left-3 right-3 sm:right-auto z-[400] max-w-sm bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-emerald-500/40 shadow-2xl animate-fadeIn">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold block">
                    ✓ Clicked Village / Landmark
                  </span>
                  <div className="font-bold text-white text-sm flex items-center gap-1.5 mt-0.5">
                    <span>📍</span>
                    <span className="truncate">{landmark}</span>
                  </div>
                  {detectedPlace && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {detectedPlace.taluka && <span>Taluka: <strong className="text-slate-200">{detectedPlace.taluka}</strong> • </span>}
                      {detectedPlace.district && <span>District: <strong className="text-slate-200">{detectedPlace.district}</strong></span>}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-lg shadow-emerald-950/40 flex-shrink-0 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Select Village</span>
                </button>
              </div>
            </div>
          )}

          {/* Coordinates HUD overlay on map */}
          <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs font-mono text-slate-300 shadow-xl flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pinColor }}></span>
              <span className="text-slate-400">Lat:</span>
              <span className="text-white font-bold">{lat}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Lng:</span>
              <span className="text-white font-bold">{lng}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer with Landmark and Confirm Button */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:flex-1">
            <label className="text-[11px] font-medium text-slate-400 block mb-1">
              Village / Landmark Name (Will be applied to your form):
            </label>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Village name, APMC Mandi, or nearby temple..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition shadow-lg cursor-pointer ${
                isPickup 
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30' 
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Set Village</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
