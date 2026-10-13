import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Truck, MapPin, Mic, MicOff, Sparkles, Calendar, Clock, 
  IndianRupee, CheckCircle2, Lock, Unlock, HelpCircle, AlertCircle, Loader2, ArrowRight,
  Navigation, Search, RefreshCw, Check, Info, Globe, ChevronDown, Key, ExternalLink, Edit3, X,
  PackageCheck, ListOrdered, Bell, ShieldAlert
} from 'lucide-react';
import { MapPickerModal } from './MapPickerModal';
import { RouteMapPreview } from './RouteMapPreview';
import { CustomerOrdersTracker } from './CustomerOrdersTracker';

/**
 * Searchable Village Dropdown Component
 * Allows instant live search across hundreds of villages/APMC mandis in taluka/district
 * with Pincode display and custom village fallback.
 */
function SearchableVillagePicker({
  value,
  onChange,
  villagesList = [],
  isCustom,
  setIsCustom,
  theme = 'emerald',
  label,
  placeholder,
  state = '',
  district = '',
  taluka = '',
  onOpenMapModal,
  onResolvedCoords,
  onSelectAllDistrictVillages,
  t
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [liveSearchResults, setLiveSearchResults] = useState([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [isResolvingCustom, setIsResolvingCustom] = useState(false);
  const [customAgentMatch, setCustomAgentMatch] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced live backend search across 155,570+ Indian villages & pincodes
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setLiveSearchResults([]);
      setIsSearchingDb(false);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearchingDb(true);
      const params = new URLSearchParams({
        query: searchTerm.trim(),
        district: district || '',
        taluka: (taluka && taluka !== '__ALL__') ? taluka : ''
      });
      fetch(`/api/v1/locations/search-villages?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
          setLiveSearchResults(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          setLiveSearchResults([]);
        })
        .finally(() => {
          setIsSearchingDb(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, district, taluka]);

  // When isCustom is active, AI Agent locates this village strictly inside the selected Taluka
  useEffect(() => {
    if (!isCustom || !value || value.trim().length < 2) {
      setCustomAgentMatch(null);
      setIsResolvingCustom(false);
      return;
    }
    const timer = setTimeout(() => {
      setIsResolvingCustom(true);
      const params = new URLSearchParams({
        village: value.trim(),
        taluka: (taluka && taluka !== '__ALL__') ? taluka : '',
        district: district || '',
        state: state || ''
      });
      fetch(`/api/v1/locations/resolve-village?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.found && data.best) {
            setCustomAgentMatch(data.best);
            if (onResolvedCoords) {
              onResolvedCoords({
                lat: data.best.lat,
                lng: data.best.lng,
                label: data.best.name,
                village: value.trim()
              });
            }
          } else {
            setCustomAgentMatch(null);
            // Even if OSM doesn't have exact node, trigger route calculation for custom village
            if (onResolvedCoords) {
              onResolvedCoords({
                lat: null,
                lng: null,
                label: `${value.trim()}, ${taluka || district}`,
                village: value.trim()
              });
            }
          }
        })
        .catch(() => setCustomAgentMatch(null))
        .finally(() => setIsResolvingCustom(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [value, isCustom, taluka, district, state]);

  // Combine local taluka villages with live search results, eliminating duplicates
  const filteredLocal = villagesList.filter(v => 
    v.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );
  const combined = [...filteredLocal];
  liveSearchResults.forEach(item => {
    if (!combined.includes(item)) {
      combined.push(item);
    }
  });

  // Limit rendered items to 300 to maintain silky smooth 60fps rendering even with 1000+ villages
  const displayList = combined.slice(0, 300);

  const themeColors = theme === 'emerald' ? {
    border: 'border-emerald-500',
    focusBorder: 'focus:border-emerald-400',
    btnBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    itemHover: 'hover:bg-emerald-600/20 hover:text-emerald-300',
    activeBadge: 'bg-emerald-500/20 text-emerald-300',
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-500'
  } : {
    border: 'border-amber-500',
    focusBorder: 'focus:border-amber-400',
    btnBg: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    itemHover: 'hover:bg-amber-600/20 hover:text-amber-300',
    activeBadge: 'bg-amber-500/20 text-amber-300',
    accentText: 'text-amber-400',
    accentBg: 'bg-amber-500'
  };

  if (isCustom) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between mb-1">
          <label className="font-medium text-slate-300">{label}</label>
          <div className="flex items-center gap-2">
            {onOpenMapModal && (
              <button
                type="button"
                onClick={onOpenMapModal}
                className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>🗺️ Pick on Map</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => { setIsCustom(false); setSearchTerm(""); setCustomAgentMatch(null); }}
              className={`text-[11px] ${themeColors.accentText} hover:underline transition cursor-pointer`}
            >
              ← Choose from village list
            </button>
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Type custom village or wadi in ${taluka || district || 'region'}...`}
            className={`w-full bg-slate-800/90 border ${themeColors.border} rounded-xl px-3 py-2 text-white font-semibold focus:outline-none ${themeColors.focusBorder}`}
          />
          {isResolvingCustom && (
            <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[11px] text-blue-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Locating...</span>
            </div>
          )}
        </div>
        {customAgentMatch ? (
          <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate">
              <span>🤖</span>
              <span className="truncate"><strong>AI Agent verified in {taluka || district}:</strong> {customAgentMatch.name} ({customAgentMatch.lat.toFixed(4)}, {customAgentMatch.lng.toFixed(4)})</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-bold uppercase flex-shrink-0 ml-2">High Accuracy GPS</span>
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 flex items-center justify-between px-1">
            <span>💡 Agent will automatically locate this village within {taluka || district} boundary for route calculation.</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="font-medium text-slate-300 flex items-center gap-1.5 truncate">
          <span>{label}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-md border border-slate-700 flex-shrink-0">
            {villagesList.length} {t?.all_villages_count || 'villages'}
          </span>
        </label>
        <div className="flex items-center gap-2">
          {onOpenMapModal && (
            <button
              type="button"
              onClick={onOpenMapModal}
              className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline transition cursor-pointer flex items-center gap-0.5"
            >
              <span>🗺️ Pick on Map</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => { setIsCustom(true); onChange(""); }}
            className={`text-[11px] ${themeColors.accentText} hover:underline transition cursor-pointer flex-shrink-0`}
          >
            + Type Custom Village
          </button>
        </div>
      </div>


      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-800/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-2 text-white text-left font-semibold flex items-center justify-between transition cursor-pointer ${
          isOpen ? themeColors.border : ''
        }`}
      >
        <span className="truncate">{value || placeholder || '-- Select Village / Mandi --'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden animate-fadeIn">
          {/* Header Bar with District/Taluka Scope */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 text-[11px] text-slate-400">
            <span className="truncate">
              {taluka === '__ALL__' ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  <span>All {district} Villages ({villagesList.length})</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>📍</span>
                  <strong className="text-white">{taluka} Taluka</strong>
                  <span className="text-emerald-400 font-medium">({villagesList.length} villages)</span>
                </span>
              )}
            </span>
          </div>

          {/* Search Input inside Dropdown */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/80 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search village name or 6-digit Pincode..."
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {isSearchingDb && (
              <span className="text-[10px] text-emerald-400 animate-pulse flex-shrink-0">
                Searching 155k+ DB...
              </span>
            )}
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm("")}
                className="text-[11px] text-slate-400 hover:text-white px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* List items */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/50 text-xs">
            {displayList.length > 0 ? (
              displayList.map((item, idx) => {
                const isSelected = item === value;
                const isTalukaHq = item.includes("(Taluka HQ") || item.includes("Taluka Center");
                const pinMatch = item.match(/\((\d{6})\)/);
                const nameOnly = pinMatch ? item.replace(/\s*\(\d{6}\)/, '') : item;
                const pincode = pinMatch ? pinMatch[1] : null;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onChange(item);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between transition cursor-pointer ${
                      isSelected 
                        ? themeColors.activeBadge 
                        : (isTalukaHq ? 'bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50' : `text-slate-200 ${themeColors.itemHover}`)
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isTalukaHq ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-base flex-shrink-0">🏛️</span>
                          <span className="font-bold text-emerald-300 truncate">{nameOnly}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/40 font-semibold flex-shrink-0">
                            Taluka HQ / Mandi
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium truncate">{nameOnly}</span>
                          {pincode && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-800/90 text-slate-300 rounded border border-slate-700 font-mono flex-shrink-0">
                              {pincode}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 ml-2" />}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-slate-400 text-xs space-y-2">
                <p>No village found matching "{searchTerm}"</p>
                <div className="flex flex-col gap-2 items-center">
                  {searchTerm.trim().length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        onChange(searchTerm.trim());
                        setIsOpen(false);
                      }}
                      className={`text-[11px] ${themeColors.btnBg} px-3 py-1.5 rounded-lg border font-semibold hover:brightness-110 transition`}
                    >
                      + Use "{searchTerm.trim()}" as custom village
                    </button>
                  )}
                  {taluka !== '__ALL__' && onSelectAllDistrictVillages && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAllDistrictVillages();
                      }}
                      className="text-[11px] text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3" />
                      <span>Search across all {district} villages instead</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Option */}
          <div className="p-2 border-t border-slate-800 bg-slate-950/90 text-[11px] flex items-center justify-between text-slate-400">
            <span>
              Showing {displayList.length} of {combined.length}
              {combined.length > 300 && " (type to filter)"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCustom(true);
                onChange(searchTerm || "");
                setIsOpen(false);
              }}
              className={`${themeColors.accentText} hover:underline cursor-pointer`}
            >
              + Other Custom Area
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerPortal({ 
  t, 
  onPostCreated, 
  onNavigateToDriverFeed, 
  hierarchyData, 
  currentUser, 
  onOpenAuth,
  customerViewMode,
  onCustomerViewModeChange
}) {
  // Master location hierarchy fallback if backend not loaded yet
  const defaultHierarchy = {
    "Maharashtra": {
      "Pune": ["Haveli", "Baramati", "Shirur", "Khed (Rajgurunagar)", "Mulshi", "Junnar", "Daund"],
      "Nashik": ["Niphad", "Dindori", "Malegaon", "Sinnar", "Yeola", "Chandwad"],
      "Ahmednagar": ["Rahata (Shirdi)", "Sangamner", "Kopargaon", "Shrirampur", "Nevasa"],
      "Mumbai Suburban": ["Andheri", "Kurla", "Borivali"]
    },
    "Gujarat": {
      "Ahmedabad": ["Daskroi", "Sanand", "Dholka", "Bavla"],
      "Surat": ["Choryasi", "Olpad", "Kamrej", "Bardoli"]
    },
    "Karnataka": {
      "Bengaluru Urban": ["Bengaluru North", "Bengaluru South", "Anekal"],
      "Belagavi": ["Belagavi", "Chikkodi", "Gokak"]
    }
  };

  const hierarchy = hierarchyData || defaultHierarchy;
  const states = Object.keys(hierarchy);

  // Helper to get talukas for any state & district with case-insensitive and alias resolution
  const getTalukasFor = (st, dist) => {
    if (!st || !dist || !hierarchy[st]) return [];
    if (hierarchy[st][dist]) return hierarchy[st][dist];
    const foundKey = Object.keys(hierarchy[st]).find(k => 
      k.toLowerCase() === dist.toLowerCase() ||
      k.toLowerCase().includes(dist.toLowerCase()) ||
      dist.toLowerCase().includes(k.toLowerCase())
    );
    return foundKey ? hierarchy[st][foundKey] : [];
  };

  // Customer Portal Navigation: 'POST' or 'MY_ORDERS'
  const [internalSubTab, setInternalSubTab] = useState('POST');
  const portalSubTab = customerViewMode || internalSubTab;
  const setPortalSubTab = (tab) => {
    setInternalSubTab(tab);
    if (onCustomerViewModeChange) onCustomerViewModeChange(tab);
  };
  const [highlightOrderId, setHighlightOrderId] = useState(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [driverRequestsCount, setDriverRequestsCount] = useState(0);

  // Form State
  const [deliveryScope, setDeliveryScope] = useState("INTRA_CITY"); // "INTRA_CITY" or "INTER_CITY"
  const [customerName, setCustomerName] = useState(currentUser?.full_name || "");
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || "");

  useEffect(() => {
    if (currentUser) {
      setCustomerName(currentUser.full_name || "");
      setCustomerPhone(currentUser.phone || "");
    } else {
      setCustomerName("");
      setCustomerPhone("");
    }
  }, [currentUser]);

  // Track summary of customer loads and pending driver offers
  const checkCustomerOrdersSummary = useCallback(async () => {
    if (!currentUser?.id) {
      setPendingOrdersCount(0);
      setDriverRequestsCount(0);
      return;
    }
    try {
      const params = new URLSearchParams({ 
        customer_view: 'true',
        customer_user_id: currentUser.id
      });
      if (currentUser?.phone) {
        params.set('customer_phone', currentUser.phone);
      }
      const res = await fetch(`/api/v1/posts?${params.toString()}`);
      if (res.ok) {
        const posts = await res.json();
        if (Array.isArray(posts)) {
          setPendingOrdersCount(posts.length);
          let reqCount = 0;
          posts.forEach(p => {
            if (p.status === 'DRIVER_REQUESTED' || (p.offers && p.offers.some(o => o.status === 'PENDING'))) {
              reqCount += 1;
            }
          });
          setDriverRequestsCount(reqCount);
        }
      }
    } catch (e) {
      // Ignore background fetch error
    }
  }, [currentUser?.id, currentUser?.phone]);

  useEffect(() => {
    checkCustomerOrdersSummary();
    const interval = setInterval(checkCustomerOrdersSummary, 12000);
    return () => clearInterval(interval);
  }, [checkCustomerOrdersSummary]);

  // Pickup Location State
  const [pickupState, setPickupState] = useState(currentUser?.state || "Maharashtra");
  const [pickupDistrict, setPickupDistrict] = useState(currentUser?.district || "Pune");
  const [pickupTaluka, setPickupTaluka] = useState(currentUser?.taluka || "Haveli");
  const [isCustomPickupTaluka, setIsCustomPickupTaluka] = useState(false);
  const [pickupVillage, setPickupVillage] = useState(currentUser?.village || "Uruli Kanchan");
  const [pickupStreet, setPickupStreet] = useState(currentUser?.street_address || "Pune-Solapur Highway");
  const [pickupLandmark, setPickupLandmark] = useState("Opposite Kisan Seva Kendra & Hanuman Temple");
  const [pickupCoords, setPickupCoords] = useState({ lat: 18.485, lng: 74.133, label: "Uruli Kanchan" });
  const [isCustomPickupPin, setIsCustomPickupPin] = useState(false);
  const [pickupVillagesList, setPickupVillagesList] = useState([]);
  const [isCustomPickupVillage, setIsCustomPickupVillage] = useState(false);

  // Dropoff Location State
  const [dropState, setDropState] = useState(currentUser?.state || "Maharashtra");
  const [dropDistrict, setDropDistrict] = useState(currentUser?.district || "Pune");
  const [dropTaluka, setDropTaluka] = useState(currentUser?.taluka || "Haveli");
  const [isCustomDropTaluka, setIsCustomDropTaluka] = useState(false);
  const [dropVillage, setDropVillage] = useState("Hadapsar APMC Mandi");
  const [dropStreet, setDropStreet] = useState("Gadital APMC Market Gate 2");
  const [dropLandmark, setDropLandmark] = useState("Behind SBI Mandi Branch");
  const [dropCoords, setDropCoords] = useState({ lat: 18.502, lng: 73.928, label: "Hadapsar APMC Mandi" });
  const [isCustomDropPin, setIsCustomDropPin] = useState(false);
  const [dropVillagesList, setDropVillagesList] = useState([]);
  const [isCustomDropVillage, setIsCustomDropVillage] = useState(false);

  // Google Maps API Key State
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(() => 
    localStorage.getItem('flexi_gmaps_key') || 
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) || 
    ''
  );
  const [serverMapsConfigured, setServerMapsConfigured] = useState(false);
  const [serverMapsPreview, setServerMapsPreview] = useState(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Check maps status from backend on mount
  useEffect(() => {
    fetch('/api/v1/config/maps-status')
      .then(res => res.json())
      .then(data => {
        if (data?.google_maps_configured) {
          setServerMapsConfigured(true);
          setServerMapsPreview(data.key_preview);
        }
      })
      .catch(() => {});
  }, []);

  // Sync when currentUser changes
  useEffect(() => {
    if (currentUser) {
      if (currentUser.full_name) setCustomerName(currentUser.full_name);
      if (currentUser.phone) setCustomerPhone(currentUser.phone);
      if (currentUser.state) setPickupState(currentUser.state);
      if (currentUser.district) setPickupDistrict(currentUser.district);
      if (currentUser.taluka) setPickupTaluka(currentUser.taluka);
      if (currentUser.village) setPickupVillage(currentUser.village);
      if (currentUser.street_address) setPickupStreet(currentUser.street_address);
    }
  }, [currentUser]);

  // Fetch villages for Pickup Taluka / District
  useEffect(() => {
    const tal = pickupTaluka || '__ALL__';
    const queryParams = new URLSearchParams({
      taluka: tal,
      district: pickupDistrict || '',
      state: pickupState || ''
    });
    fetch(`/api/v1/locations/villages?${queryParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        const list = data || [];
        setPickupVillagesList(list);
        if (list.length > 0 && !isCustomPickupVillage) {
          if (!pickupVillage || !list.includes(pickupVillage)) {
            setPickupVillage(list[0]);
          }
        }
      })
      .catch(() => {});
  }, [pickupTaluka, pickupDistrict, pickupState]);

  // Fetch villages for Dropoff Taluka / District
  useEffect(() => {
    const tal = dropTaluka || '__ALL__';
    const queryParams = new URLSearchParams({
      taluka: tal,
      district: dropDistrict || '',
      state: dropState || ''
    });
    fetch(`/api/v1/locations/villages?${queryParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        const list = data || [];
        setDropVillagesList(list);
        if (list.length > 0 && !isCustomDropVillage) {
          if (!dropVillage || !list.includes(dropVillage)) {
            setDropVillage(list[0]);
          }
        }
      })
      .catch(() => {});
  }, [dropTaluka, dropDistrict, dropState]);

  // Cargo & Vehicle State
  const [rawGoodsDescription, setRawGoodsDescription] = useState(
    "35 bori gehu (wheat seed bags) and 5 drum organic liquid fertilizer"
  );
  const [parsedCargo, setParsedCargo] = useState(null);
  const [isParsingCargo, setIsParsingCargo] = useState(false);

  const [vehicleType, setVehicleType] = useState("Mahindra Bolero Pickup");
  const [customVehicleDetails, setCustomVehicleDetails] = useState("");

  // Timing State (Flexible Date Range or Single Day)
  const todayObj = new Date();
  const todayStr = todayObj.toISOString().split('T')[0];
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const defaultDateStr = tomorrowObj.toISOString().split('T')[0];
  const defaultRangeEndObj = new Date();
  defaultRangeEndObj.setDate(defaultRangeEndObj.getDate() + 3);
  const defaultDateToStr = defaultRangeEndObj.toISOString().split('T')[0];

  const [feasibleDate, setFeasibleDate] = useState(defaultDateStr); // From date
  const [feasibleDateTo, setFeasibleDateTo] = useState(defaultDateToStr); // To date (flexible range)
  const [dateMode, setDateMode] = useState("RANGE"); // "RANGE" | "SINGLE"
  const [feasibleTimeWindow, setFeasibleTimeWindow] = useState("Morning (06:00 AM - 10:00 AM)");

  // Distance State (Distance & Geocoding Agent)
  const [distanceKm, setDistanceKm] = useState(24.5);
  const [isAutoDistance, setIsAutoDistance] = useState(true);
  const [distanceDetails, setDistanceDetails] = useState(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

  // Vehicle Recommendation State (Vehicle Recommendation Agent)
  const [vehicleRecommendation, setVehicleRecommendation] = useState(null);
  const [isRecommendingVehicle, setIsRecommendingVehicle] = useState(false);
  const [userHasChosenVehicle, setUserHasChosenVehicle] = useState(false);

  // Price & Budget State (Pricing & Cost Estimation Agent)
  const [predictedPriceData, setPredictedPriceData] = useState(null);
  const [customerBudget, setCustomerBudget] = useState(1400);
  const [isPredictingPrice, setIsPredictingPrice] = useState(false);

  // Map Modal State
  const [mapTarget, setMapTarget] = useState(null); // 'pickup' | 'drop' | null

  // Voice Dictation State
  const [activeVoiceField, setActiveVoiceField] = useState(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  // Cascading drop locks when deliveryScope === "INTRA_CITY"
  useEffect(() => {
    if (deliveryScope === "INTRA_CITY") {
      setDropState(pickupState);
      setDropDistrict(pickupDistrict);
      setDropTaluka(pickupTaluka);
    }
  }, [deliveryScope, pickupState, pickupDistrict, pickupTaluka]);

  // AI Cargo Parser trigger
  const triggerCargoParsing = async (text) => {
    if (!text || text.trim().length < 3) return;
    setIsParsingCargo(true);
    try {
      const res = await fetch('/api/v1/parse-cargo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: text })
      });
      if (res.ok) {
        const data = await res.json();
        setParsedCargo(data);
      }
    } catch (e) {
      console.warn("AI parser service notice:", e);
    } finally {
      setIsParsingCargo(false);
    }
  };

  // Run initial parse on mount
  useEffect(() => {
    triggerCargoParsing(rawGoodsDescription);
  }, []);

  // Real-time Pricing & Cost Estimation Agent (Dynamic XGBoost Fare Engine)
  const fetchFarePrediction = useCallback(async (overrideDist = null, overrideVehicle = null) => {
    setIsPredictingPrice(true);
    const dist = overrideDist !== null 
      ? parseFloat(overrideDist) 
      : (parseFloat(distanceKm) > 0 ? parseFloat(distanceKm) : (deliveryScope === "INTRA_CITY" ? 24.5 : 185.0));
    const weight = parsedCargo?.parsed_cargo_weight_kg || 1200.0;
    const effectiveVehicle = overrideVehicle || (vehicleType === "Custom Vehicle" && customVehicleDetails.trim()
      ? customVehicleDetails.trim()
      : vehicleType);

    try {
      const res = await fetch('/api/v1/predict-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distance_km: dist,
          cargo_weight_kg: weight,
          vehicle_type: effectiveVehicle,
          delivery_scope: deliveryScope,
          pickup_taluka: pickupTaluka,
          drop_taluka: dropTaluka
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPredictedPriceData(data);
        setCustomerBudget(data.predicted_fair_price);
      }
    } catch (e) {
      console.warn("Pricing agent notice:", e);
    } finally {
      setIsPredictingPrice(false);
    }
  }, [distanceKm, vehicleType, customVehicleDetails, parsedCargo?.parsed_cargo_weight_kg, deliveryScope, pickupTaluka, dropTaluka]);

  // Distance & Geocoding Agent Trigger
  const triggerDistanceCalculation = async (force = false, customOverride = null) => {
    if (!isAutoDistance && !force) return;
    setIsCalculatingDistance(true);
    const usePickupPin = customOverride?.pickupPin ?? isCustomPickupPin;
    const useDropPin = customOverride?.dropPin ?? isCustomDropPin;
    const pLat = customOverride?.pickup_lat !== undefined ? customOverride.pickup_lat : (usePickupPin ? pickupCoords?.lat : null);
    const pLng = customOverride?.pickup_lng !== undefined ? customOverride.pickup_lng : (usePickupPin ? pickupCoords?.lng : null);
    const pVillage = customOverride?.pickup_village || pickupVillage;
    const dLat = customOverride?.drop_lat !== undefined ? customOverride.drop_lat : (useDropPin ? dropCoords?.lat : null);
    const dLng = customOverride?.drop_lng !== undefined ? customOverride.drop_lng : (useDropPin ? dropCoords?.lng : null);
    const dVillage = customOverride?.drop_village || dropVillage;

    try {
      const res = await fetch('/api/v1/agent/calculate-distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_state: pickupState,
          pickup_district: pickupDistrict,
          pickup_taluka: pickupTaluka,
          pickup_village: pVillage,
          pickup_lat: pLat,
          pickup_lng: pLng,
          drop_state: dropState,
          drop_district: dropDistrict,
          drop_taluka: dropTaluka,
          drop_village: dVillage,
          drop_lat: dLat,
          drop_lng: dLng,
          is_custom_pickup_pin: usePickupPin,
          is_custom_drop_pin: useDropPin,
          delivery_scope: deliveryScope,
          google_maps_api_key: googleMapsApiKey || undefined,
          user_distance_km: (!isAutoDistance && !force) ? parseFloat(distanceKm) : null
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDistanceDetails(data);
        if (data.distance_km) {
          setDistanceKm(data.distance_km);
          setIsAutoDistance(true);
          // Immediately update pricing based on this exact custom village road distance!
          fetchFarePrediction(data.distance_km);
        }
        if (data.origin_coords && !usePickupPin) {
          setPickupCoords({
            lat: data.origin_coords.lat,
            lng: data.origin_coords.lng,
            label: data.origin_coords.display_name
          });
        }
        if (data.destination_coords && !useDropPin) {
          setDropCoords({
            lat: data.destination_coords.lat,
            lng: data.destination_coords.lng,
            label: data.destination_coords.display_name
          });
        }
      }
    } catch (e) {
      console.warn("Distance agent notice:", e);
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  // Trigger distance recalculation on location changes (with 500ms debounce if typing custom village)
  useEffect(() => {
    const isCustomActive = isCustomPickupVillage || isCustomDropVillage;
    if (isCustomActive) {
      const timer = setTimeout(() => {
        triggerDistanceCalculation();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      triggerDistanceCalculation();
    }
  }, [
    pickupState, pickupDistrict, pickupTaluka, pickupVillage, isCustomPickupPin,
    dropState, dropDistrict, dropTaluka, dropVillage, isCustomDropPin,
    deliveryScope, googleMapsApiKey
  ]);

  // Vehicle Recommendation Agent Trigger
  useEffect(() => {
    const fetchVehicleRecommendation = async () => {
      const weight = parsedCargo?.parsed_cargo_weight_kg || 1200.0;
      const goodsType = parsedCargo?.parsed_goods_type || "General Cargo";
      const notes = parsedCargo?.handling_notes || "";
      setIsRecommendingVehicle(true);
      try {
        const res = await fetch('/api/v1/agent/recommend-vehicle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cargo_weight_kg: weight,
            goods_type: goodsType,
            handling_notes: notes,
            distance_km: parseFloat(distanceKm) || 25.0,
            delivery_scope: deliveryScope,
            raw_goods_description: rawGoodsDescription
          })
        });
        if (res.ok) {
          const data = await res.json();
          setVehicleRecommendation(data);
          // If user hasn't explicitly chosen a vehicle preference yet, auto-select the recommended vehicle
          if (!userHasChosenVehicle && data.recommended_vehicle) {
            setVehicleType(data.recommended_vehicle);
          }
        }
      } catch (e) {
        console.warn("Vehicle recommendation agent notice:", e);
      } finally {
        setIsRecommendingVehicle(false);
      }
    };

    fetchVehicleRecommendation();
  }, [parsedCargo?.parsed_cargo_weight_kg, parsedCargo?.parsed_goods_type, distanceKm, deliveryScope]);

  // Sync pricing prediction on dependency updates
  useEffect(() => {
    fetchFarePrediction();
  }, [fetchFarePrediction]);

  // Web Speech API Voice-to-Text Dictation
  const handleVoiceInput = (targetField) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Please type directly.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN'; // Multi-lingual recognition
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setActiveVoiceField(targetField);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (targetField === 'goods') {
        const updated = rawGoodsDescription ? `${rawGoodsDescription} ${transcript}` : transcript;
        setRawGoodsDescription(updated);
        triggerCargoParsing(updated);
      } else if (targetField === 'pickup_landmark') {
        setPickupLandmark(transcript);
      } else if (targetField === 'drop_landmark') {
        setDropLandmark(transcript);
      }
      setActiveVoiceField(null);
    };

    recognition.onerror = () => setActiveVoiceField(null);
    recognition.onend = () => setActiveVoiceField(null);

    recognition.start();
  };

  // Submit Freight Post
  const handlePublishPost = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) {
      setSubmitError("Authentication required: Please sign in or register before posting freight.");
      if (onOpenAuth) onOpenAuth('LOGIN');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setPostSuccess(null);

    const payload = {
      customer_user_id: currentUser.id,
      customer_name: customerName || currentUser.full_name || "Valued Shipper",
      customer_phone: customerPhone || currentUser.phone || "",
      delivery_scope: deliveryScope,
      pickup_state: pickupState,
      pickup_district: pickupDistrict,
      pickup_taluka: pickupTaluka,
      pickup_village: pickupVillage,
      pickup_street: pickupStreet,
      pickup_landmark: pickupLandmark,
      pickup_lat: pickupCoords.lat,
      pickup_lng: pickupCoords.lng,
      drop_state: dropState,
      drop_district: dropDistrict,
      drop_taluka: dropTaluka,
      drop_village: dropVillage,
      drop_street: dropStreet,
      drop_landmark: dropLandmark,
      drop_lat: dropCoords.lat,
      drop_lng: dropCoords.lng,
      raw_goods_description: rawGoodsDescription,
      parsed_goods_type: parsedCargo?.parsed_goods_type || "General Cargo",
      parsed_cargo_weight_kg: parsedCargo?.parsed_cargo_weight_kg || 500.0,
      handling_notes: parsedCargo?.handling_notes || "Handle carefully",
      vehicle_type: vehicleType,
      custom_vehicle_details: customVehicleDetails || null,
      feasible_date: (dateMode === "RANGE" && feasibleDateTo && feasibleDateTo !== feasibleDate)
        ? `${feasibleDate} to ${feasibleDateTo}`
        : feasibleDate,
      feasible_time_window: feasibleTimeWindow,
      estimated_distance_km: parseFloat(distanceKm) || predictedPriceData?.distance_km || (deliveryScope === "INTRA_CITY" ? 22.0 : 160.0),
      customer_budget: parseFloat(customerBudget) || 1200.0
    };

    try {
      const res = await fetch('/api/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setPostSuccess(data);
        if (onPostCreated) onPostCreated(data);
        setTimeout(() => {
          const el = document.getElementById('post-success-banner-bottom') || document.getElementById('post-success-banner-top');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        setSubmitError(data.detail || "Failed to post freight load request");
      }
    } catch (err) {
      setSubmitError("Network connection error. Ensure the FastAPI backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Customer Mode Tabs: Post Load vs My Orders & Driver Tracker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setPortalSubTab('POST')}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              portalSubTab === 'POST'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Post New Freight Load</span>
          </button>

          <button
            type="button"
            onClick={() => setPortalSubTab('MY_ORDERS')}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer relative ${
              portalSubTab === 'MY_ORDERS'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>My Posted Shipments & Tracker</span>
            {pendingOrdersCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-slate-800 border border-slate-700 text-slate-200 rounded-full font-mono">
                {pendingOrdersCount}
              </span>
            )}
            {driverRequestsCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full font-bold animate-pulse">
                <Bell className="w-2.5 h-2.5" />
                <span>{driverRequestsCount} Action</span>
              </span>
            )}
          </button>
        </div>

        {portalSubTab === 'POST' && currentUser && (
          <div className="text-right text-[11px] text-slate-400 hidden sm:block pr-2">
            Posting as: <strong className="text-emerald-300">{customerName || currentUser.full_name}</strong> {customerPhone ? `(${customerPhone})` : ''}
          </div>
        )}
      </div>

      {/* Success Notification (Top) */}
      {postSuccess && (
        <div id="post-success-banner-top" className="p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-base">Freight Load #{postSuccess.id} Published Successfully!</h4>
              <p className="text-xs text-emerald-300">
                Visible to drivers in <span className="font-semibold">{postSuccess.pickup_taluka}, {postSuccess.pickup_district}</span>. Drivers can view and submit counter-offers.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              type="button"
              onClick={() => {
                setHighlightOrderId(postSuccess.id);
                setPortalSubTab('MY_ORDERS');
              }}
              className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Track in My Orders & Driver Decisions →</span>
            </button>
            <button 
              type="button"
              onClick={() => onNavigateToDriverFeed && onNavigateToDriverFeed(postSuccess)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 shadow flex items-center gap-1.5 transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span>Driver Feed</span>
            </button>
            <button 
              type="button"
              onClick={() => setPostSuccess(null)}
              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 text-xs rounded-xl border border-slate-700/60 shadow transition cursor-pointer"
            >
              Post Another
            </button>
          </div>
        </div>
      )}

      {/* Conditional: Tracker View vs Post Form */}
      {portalSubTab === 'MY_ORDERS' ? (
        <CustomerOrdersTracker
          currentUser={currentUser}
          highlightPostId={highlightOrderId}
          onSwitchToPostForm={() => {
            setHighlightOrderId(null);
            setPortalSubTab('POST');
          }}
          onNavigateToPostNew={() => {
            setHighlightOrderId(null);
            setPortalSubTab('POST');
          }}
          onOpenAuth={onOpenAuth}
          t={t}
        />
      ) : !currentUser ? (
        <div className="glass-card p-10 rounded-2xl border border-slate-800 text-center max-w-xl mx-auto my-12 shadow-2xl space-y-6 animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
            <Truck className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white font-heading">
              Sign In Required to Post Freight
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              Please sign in or create a customer account before posting freight cargo. This securely links your shipment to your account, protects your personal contact details, and allows commercial drivers to send verified offers.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenAuth && onOpenAuth('LOGIN')}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In to Post Freight</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth && onOpenAuth('REGISTER')}
              className="w-full sm:w-auto px-6 py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <span>Register as Shipper / Farmer</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Customer Header & Basic Identity */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-emerald-400" />
              <span>{t.role_customer}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Publish intra-taluka or inter-city freight loads with AI auto-extraction & instant fair pricing.
            </p>
          </div>

          {/* Delivery Scope Selector */}
          <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/80">
            <button
              type="button"
              onClick={() => setDeliveryScope("INTRA_CITY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                deliveryScope === "INTRA_CITY" 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{t.scope_intra}</span>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryScope("INTER_CITY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                deliveryScope === "INTER_CITY" 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{t.scope_inter}</span>
            </button>
          </div>
        </div>

        {/* Customer Contact Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Your Name / Business Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              placeholder="e.g. Vitthalrao Patil / Shri Krishna Agro"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-300 mb-1">Your Contact Phone (Confidential till deal agreement)</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              placeholder="10-digit mobile number"
            />
          </div>
        </div>

        {deliveryScope === "INTRA_CITY" && (
          <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
            <Lock className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{t.scope_intra_notice}</span>
          </div>
        )}
      </div>

      <form onSubmit={handlePublishPost} className="space-y-6">
        {/* ===================== LOCATION DETAILS (CASCADING + LOCAL LANDMARKS) ===================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PICKUP LOCATION CARD */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <MapPin className="w-4 h-4" />
                <span>{t.pickup_location}</span>
              </div>
              <button
                type="button"
                onClick={() => setMapTarget('pickup')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.pick_on_map}</span>
              </button>
            </div>

            {/* Cascading State -> District -> Taluka */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{t.state}</label>
                <select
                  value={pickupState}
                  onChange={(e) => {
                    const st = e.target.value;
                    setPickupState(st);
                    setIsCustomPickupPin(false);
                    const firstDist = Object.keys(hierarchy[st] || {})[0] || "";
                    setPickupDistrict(firstDist);
                    const tList = getTalukasFor(st, firstDist);
                    setPickupTaluka(tList[0] || "__ALL__");
                  }}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t.district}</label>
                <select
                  value={pickupDistrict}
                  onChange={(e) => {
                    const dist = e.target.value;
                    setPickupDistrict(dist);
                    setIsCustomPickupPin(false);
                    const tList = getTalukasFor(pickupState, dist);
                    setPickupTaluka(tList[0] || "__ALL__");
                  }}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {Object.keys(hierarchy[pickupState] || {}).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">{t.taluka}</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomPickupTaluka(!isCustomPickupTaluka);
                      if (!isCustomPickupTaluka) setPickupTaluka("");
                    }}
                    className="text-[10px] text-emerald-400 hover:underline cursor-pointer font-medium"
                  >
                    {isCustomPickupTaluka ? '← List' : '+ Custom'}
                  </button>
                </div>
                {isCustomPickupTaluka ? (
                  <input
                    type="text"
                    value={pickupTaluka === '__ALL__' ? '' : pickupTaluka}
                    onChange={(e) => {
                      setPickupTaluka(e.target.value);
                      setIsCustomPickupPin(false);
                    }}
                    placeholder="Type taluka name..."
                    className="w-full bg-slate-800/90 border border-emerald-500 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-400 font-semibold"
                  />
                ) : (
                  <select
                    value={pickupTaluka}
                    onChange={(e) => {
                      setPickupTaluka(e.target.value);
                      setIsCustomPickupPin(false);
                    }}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    <option value="__ALL__">-- 🌐 All Talukas / Entire District ({pickupDistrict}) --</option>
                    {getTalukasFor(pickupState, pickupDistrict).map(tal => (
                      <option key={tal} value={tal}>{tal}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Local Detail Inputs */}
            <div className="space-y-3 text-xs">
              <SearchableVillagePicker
                value={pickupVillage}
                onChange={(val) => {
                  setPickupVillage(val);
                  setIsCustomPickupPin(false);
                }}
                villagesList={pickupVillagesList}
                isCustom={isCustomPickupVillage}
                setIsCustom={setIsCustomPickupVillage}
                theme="emerald"
                label={t.village}
                placeholder={t.village_placeholder}
                state={pickupState}
                district={pickupDistrict}
                taluka={pickupTaluka}
                onOpenMapModal={() => setMapTarget('pickup')}
                onResolvedCoords={(coords) => {
                  if (coords.lat && coords.lng) {
                    setPickupCoords({ lat: coords.lat, lng: coords.lng, label: coords.label });
                    setIsCustomPickupPin(true);
                  }
                  triggerDistanceCalculation(true, {
                    pickupPin: Boolean(coords.lat && coords.lng),
                    pickup_lat: coords.lat,
                    pickup_lng: coords.lng,
                    pickup_village: coords.village || pickupVillage
                  });
                }}
                onSelectAllDistrictVillages={() => setPickupTaluka("__ALL__")}
                t={t}
              />

              <div>
                <label className="block font-medium text-slate-300 mb-1">{t.street}</label>
                <input
                  type="text"
                  value={pickupStreet}
                  onChange={(e) => setPickupStreet(e.target.value)}
                  placeholder={t.street_placeholder}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-300">{t.landmark}</label>
                  <button
                    type="button"
                    onClick={() => handleVoiceInput('pickup_landmark')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      activeVoiceField === 'pickup_landmark' ? 'bg-rose-500 text-white animate-pulse' : 'text-emerald-400 hover:text-emerald-300'
                    }`}
                  >
                    {activeVoiceField === 'pickup_landmark' ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    <span>{activeVoiceField === 'pickup_landmark' ? t.voice_listening : t.voice_input}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={pickupLandmark}
                  onChange={(e) => setPickupLandmark(e.target.value)}
                  placeholder={t.landmark_placeholder}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* DROPOFF DESTINATION CARD */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <MapPin className="w-4 h-4" />
                <span>{t.drop_location}</span>
                {deliveryScope === "INTRA_CITY" ? (
                  <button
                    type="button"
                    onClick={() => setDeliveryScope("INTER_CITY")}
                    className="text-[11px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/40 flex items-center gap-1 transition cursor-pointer hover:scale-105"
                    title="Click to unlock State, District & Taluka for Inter-City delivery"
                  >
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Locked to Pickup (Click to Unlock)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeliveryScope("INTRA_CITY")}
                    className="text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/40 flex items-center gap-1 transition cursor-pointer"
                    title="Click to lock back to Same City (Intra-City)"
                  >
                    <Unlock className="w-3 h-3 text-emerald-400" />
                    <span>Inter-City Unlocked</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMapTarget('drop')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.pick_on_map}</span>
              </button>
            </div>

            {/* Cascading Drop State -> District -> Taluka */}
            <div className="space-y-2">
              <div 
                className="grid grid-cols-3 gap-2 text-xs"
                onClick={() => {
                  if (deliveryScope === "INTRA_CITY") {
                    setDeliveryScope("INTER_CITY");
                  }
                }}
                title={deliveryScope === "INTRA_CITY" ? "Click to unlock State, District & Taluka for Inter-City delivery" : ""}
              >
                <div>
                  <label className="block text-slate-400 mb-1">{t.state}</label>
                  <select
                    disabled={deliveryScope === "INTRA_CITY"}
                    value={dropState}
                    onChange={(e) => {
                      const st = e.target.value;
                      setDropState(st);
                      setIsCustomDropPin(false);
                      const firstDist = Object.keys(hierarchy[st] || {})[0] || "";
                      setDropDistrict(firstDist);
                      const tList = getTalukasFor(st, firstDist);
                      setDropTaluka(tList[0] || "__ALL__");
                    }}
                    className={`w-full bg-slate-800/90 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 ${
                      deliveryScope === "INTRA_CITY" ? 'opacity-60 cursor-pointer' : ''
                    }`}
                  >
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{t.district}</label>
                  <select
                    disabled={deliveryScope === "INTRA_CITY"}
                    value={dropDistrict}
                    onChange={(e) => {
                      const dist = e.target.value;
                      setDropDistrict(dist);
                      setIsCustomDropPin(false);
                      const tList = getTalukasFor(dropState, dist);
                      setDropTaluka(tList[0] || "__ALL__");
                    }}
                    className={`w-full bg-slate-800/90 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 ${
                      deliveryScope === "INTRA_CITY" ? 'opacity-60 cursor-pointer' : ''
                    }`}
                  >
                    {Object.keys(hierarchy[dropState] || {}).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400">{t.taluka}</label>
                    {deliveryScope !== "INTRA_CITY" && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomDropTaluka(!isCustomDropTaluka);
                          if (!isCustomDropTaluka) setDropTaluka("");
                        }}
                        className="text-[10px] text-amber-400 hover:underline cursor-pointer font-medium"
                      >
                        {isCustomDropTaluka ? '← List' : '+ Custom'}
                      </button>
                    )}
                  </div>
                  {isCustomDropTaluka && deliveryScope !== "INTRA_CITY" ? (
                    <input
                      type="text"
                      value={dropTaluka === '__ALL__' ? '' : dropTaluka}
                      onChange={(e) => {
                        setDropTaluka(e.target.value);
                        setIsCustomDropPin(false);
                      }}
                      placeholder="Type taluka name..."
                      className="w-full bg-slate-800/90 border border-amber-500 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400 font-semibold"
                    />
                  ) : (
                    <select
                      disabled={deliveryScope === "INTRA_CITY"}
                      value={dropTaluka}
                      onChange={(e) => {
                        setDropTaluka(e.target.value);
                        setIsCustomDropPin(false);
                      }}
                      className={`w-full bg-slate-800/90 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-semibold ${
                        deliveryScope === "INTRA_CITY" ? 'opacity-60 cursor-pointer' : ''
                      }`}
                    >
                      <option value="__ALL__">-- 🌐 All Talukas / Entire District ({dropDistrict}) --</option>
                      {getTalukasFor(dropState, dropDistrict).map(tal => (
                        <option key={tal} value={tal}>{tal}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {deliveryScope === "INTRA_CITY" && (
                <div className="p-2.5 bg-amber-950/25 border border-amber-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                    <span>Locked to pickup location because <strong>Same City / Intra-Taluka</strong> mode is selected.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeliveryScope("INTER_CITY")}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] flex-shrink-0 transition flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Unlock className="w-3 h-3" />
                    <span>Unlock for Inter-City</span>
                  </button>
                </div>
              )}
            </div>

            {/* Local Detail Inputs for Dropoff */}
            <div className="space-y-3 text-xs">
              <SearchableVillagePicker
                value={dropVillage}
                onChange={(val) => {
                  setDropVillage(val);
                  setIsCustomDropPin(false);
                }}
                villagesList={dropVillagesList}
                isCustom={isCustomDropVillage}
                setIsCustom={setIsCustomDropVillage}
                theme="amber"
                label={t.village}
                placeholder={t.village_placeholder}
                state={dropState}
                district={dropDistrict}
                taluka={dropTaluka}
                onOpenMapModal={() => setMapTarget('drop')}
                onResolvedCoords={(coords) => {
                  if (coords.lat && coords.lng) {
                    setDropCoords({ lat: coords.lat, lng: coords.lng, label: coords.label });
                    setIsCustomDropPin(true);
                  }
                  triggerDistanceCalculation(true, {
                    dropPin: Boolean(coords.lat && coords.lng),
                    drop_lat: coords.lat,
                    drop_lng: coords.lng,
                    drop_village: coords.village || dropVillage
                  });
                }}
                onSelectAllDistrictVillages={() => setDropTaluka("__ALL__")}
                t={t}
              />

              <div>
                <label className="block font-medium text-slate-300 mb-1">{t.street}</label>
                <input
                  type="text"
                  value={dropStreet}
                  onChange={(e) => setDropStreet(e.target.value)}
                  placeholder="e.g. Market Gate 2, Bypass Road"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-300">{t.landmark}</label>
                  <button
                    type="button"
                    onClick={() => handleVoiceInput('drop_landmark')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      activeVoiceField === 'drop_landmark' ? 'bg-rose-500 text-white animate-pulse' : 'text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    {activeVoiceField === 'drop_landmark' ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    <span>{activeVoiceField === 'drop_landmark' ? t.voice_listening : t.voice_input}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={dropLandmark}
                  onChange={(e) => setDropLandmark(e.target.value)}
                  placeholder="e.g. Near Shani Mandir Chowk"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===================== DISTANCE & GEOCODING AGENT CARD ===================== */}
        <div className="glass-card p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/15 text-blue-400 rounded-xl border border-blue-500/30">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
                  <span>Distance & Geocoding Agent</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                    Agent 1/4
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Calculates real-world road transit distance & transit duration via Google Maps API or Geodesic Road Engine.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              {(serverMapsConfigured || googleMapsApiKey) ? (
                <button
                  type="button"
                  onClick={() => {
                    setTempApiKey(googleMapsApiKey || '');
                    setShowApiKeyModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  title="Click to manage Google Maps API Key"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Google Maps Active {serverMapsPreview ? `(${serverMapsPreview})` : ''}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTempApiKey('');
                    setShowApiKeyModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  title="Click to enter Google Maps API Key or save in .env"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Set Google Maps Key</span>
                </button>
              )}

              {/* Recalculate / Sync with Map button */}
              <button
                type="button"
                disabled={isCalculatingDistance}
                onClick={() => {
                  setIsCustomPickupPin(false);
                  setIsCustomDropPin(false);
                  triggerDistanceCalculation(true, { pickupPin: false, dropPin: false });
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isCalculatingDistance ? 'animate-spin' : ''}`} />
                <span>{isCalculatingDistance ? "Calculating..." : t.recalculate_distance_btn}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Editable Distance Input */}
            <div className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t.distance_field_label}</span>
                </label>
                {isAutoDistance ? (
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    <span>Auto-Calculated</span>
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                    Manual Override
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={distanceKm}
                  onChange={(e) => {
                    setDistanceKm(e.target.value);
                    setIsAutoDistance(false);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-white font-bold text-lg focus:outline-none"
                  placeholder={t.distance_placeholder}
                />
                <span className="text-sm font-semibold text-slate-400">km</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isAutoDistance 
                  ? "Calculated from pickup to drop coordinates. You can type to edit if you know the exact route."
                  : "Using your custom distance. Click Recalculate to revert to map calculation."}
              </p>
            </div>

            {/* Estimated Transit Duration & Engine */}
            <div className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-xl space-y-2">
              <span className="text-xs font-medium text-slate-400 block">{t.transit_duration}</span>
              <div className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span>
                  {distanceDetails?.estimated_duration_text || (
                    distanceKm 
                      ? `${Math.max(15, Math.round(parseFloat(distanceKm) / 35 * 60))} mins`
                      : "Calculating..."
                  )}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <span>Engine:</span>
                <span className="text-blue-300 font-medium">
                  {distanceDetails?.calculation_source === 'google_maps_distance_matrix' 
                    ? 'Google Maps API' 
                    : (distanceDetails?.calculation_source === 'osrm_road_network'
                        ? 'OSRM Road Engine'
                        : 'Indian Geodesic Road Engine (Haversine × 1.28x)')}
                </span>
              </div>
            </div>

            {/* Route Waypoints & Coordinates */}
            <div className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 block">GPS Coordinates & Pins</span>
                <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                  <Navigation className="w-3 h-3 text-emerald-400" />
                  <span>Distance: {distanceKm ? `${distanceKm} km` : '0.0 km'}</span>
                </span>
              </div>
              <div className="text-xs space-y-1 font-mono text-slate-300">
                <div className="flex items-center justify-between gap-1">
                  <div className="truncate flex items-center gap-1.5 flex-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                    <span className="text-slate-400 font-semibold">P:</span>
                    <span className="truncate">{pickupVillage || pickupTaluka}</span>
                    <span className="text-emerald-400 text-[11px] font-mono">({pickupCoords?.lat?.toFixed(3)}, {pickupCoords?.lng?.toFixed(3)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMapTarget('pickup')}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline flex-shrink-0 cursor-pointer"
                    title="Change pin on map"
                  >
                    {isCustomPickupPin ? 'Custom Pin 📍' : 'Edit Pin 📍'}
                  </button>
                </div>

                {/* Distance Connector between P and D */}
                <div className="flex items-center gap-2 pl-3 py-0.5 my-0.5 text-[11px]">
                  <div className="w-0.5 h-3.5 bg-slate-700/80 rounded"></div>
                  <div className="bg-slate-900/90 border border-slate-700/70 rounded-md px-2 py-0.5 text-slate-300 flex items-center gap-1.5 shadow-inner">
                    <span className="text-slate-400">Road Transit Distance:</span>
                    <strong className="text-emerald-400 font-bold">{distanceKm ? `${distanceKm} km` : '0 km'}</strong>
                    {distanceDetails?.estimated_duration_text && (
                      <span className="text-slate-400">({distanceDetails.estimated_duration_text})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1">
                  <div className="truncate flex items-center gap-1.5 flex-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0"></span>
                    <span className="text-slate-400 font-semibold">D:</span>
                    <span className="truncate">{dropVillage || dropTaluka}</span>
                    <span className="text-amber-400 text-[11px] font-mono">({dropCoords?.lat?.toFixed(3)}, {dropCoords?.lng?.toFixed(3)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMapTarget('drop')}
                    className="text-[10px] text-amber-400 hover:text-amber-300 hover:underline flex-shrink-0 cursor-pointer"
                    title="Change pin on map"
                  >
                    {isCustomDropPin ? 'Custom Pin 📍' : 'Edit Pin 📍'}
                  </button>
                </div>
              </div>

              {/* Google Maps API Key status and configuration trigger */}
              <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1 text-slate-400">
                  <Key className="w-3 h-3 text-blue-400" />
                  <span>Google Maps:</span>
                  <span className={googleMapsApiKey ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                    {googleMapsApiKey ? "Active" : "Optional"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTempApiKey(googleMapsApiKey);
                    setShowApiKeyModal(true);
                  }}
                  className="text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                >
                  {googleMapsApiKey ? "Manage Key" : "Add Key"}
                </button>
              </div>
            </div>
          </div>

          {/* Google Maps Live Route Full Screen Option Bar (Placed Just Above Map) */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-blue-500/30 rounded-xl p-3 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0 shadow-inner">
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs tracking-wide">Google Maps Live Route & Navigation</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded font-semibold border border-blue-500/30">
                    Full Screen ↗
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate">
                  <strong className="text-emerald-400">{pickupVillage || pickupTaluka || 'Pickup'}</strong> ➔ <strong className="text-amber-400">{dropVillage || dropTaluka || 'Drop'}</strong>
                  {distanceKm ? ` (${distanceKm} km${(distanceDetails?.duration_text || distanceDetails?.estimated_duration_text) ? ` • ${distanceDetails?.duration_text || distanceDetails?.estimated_duration_text}` : ''})` : ''}
                </p>
              </div>
            </div>

            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${pickupCoords?.lat || 18.485},${pickupCoords?.lng || 74.133}&destination=${dropCoords?.lat || 18.502},${dropCoords?.lng || 73.928}&travelmode=driving`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/40 hover:shadow-blue-800/60 transition flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer group"
              title="Open full interactive directions in Google Maps"
            >
              <span>Open Google Maps Full Screen</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>

          {/* Interactive Live Route Map Preview */}
          <RouteMapPreview
            pickupCoords={pickupCoords}
            dropCoords={dropCoords}
            routePolyline={distanceDetails?.route_polyline || []}
            distanceKm={distanceKm}
            durationText={distanceDetails?.estimated_duration_text}
            calculationSource={
              distanceDetails?.calculation_source === 'google_maps_distance_matrix'
                ? 'Google Maps Matrix API'
                : (distanceDetails?.calculation_source === 'osrm_road_network'
                    ? 'OSRM Road Engine'
                    : 'Indian Geodesic Road Engine (Haversine × 1.28x)')
            }
            pickupLabel={pickupVillage || pickupTaluka || pickupDistrict}
            dropLabel={dropVillage || dropTaluka || dropDistrict}
          />
        </div>

        {/* ===================== MANUALLY ENTERED GOODS & AI PARSING ===================== */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-semibold text-white text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>{t.goods_description_label}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{t.goods_description_hint}</p>
            </div>

            {/* Web Speech API Voice Button */}
            <button
              type="button"
              onClick={() => handleVoiceInput('goods')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
                activeVoiceField === 'goods'
                  ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
              }`}
            >
              {activeVoiceField === 'goods' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{activeVoiceField === 'goods' ? t.voice_listening : t.voice_input}</span>
            </button>
          </div>

          <div className="relative">
            <textarea
              required
              rows={3}
              value={rawGoodsDescription}
              onChange={(e) => {
                setRawGoodsDescription(e.target.value);
              }}
              onBlur={() => triggerCargoParsing(rawGoodsDescription)}
              placeholder={t.goods_description_placeholder}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* AI Extraction Preview Card */}
          {parsedCargo && (
            <div className="p-4 bg-slate-800/50 border border-emerald-500/30 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t.ai_parsed_summary} ({parsedCargo.engine_used})
                </span>
                <span className="text-[11px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20">
                  Confidence: {Math.round((parsedCargo.confidence_score || 0.9) * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-slate-400 block">{t.parsed_category}:</span>
                  <span className="font-bold text-white text-sm">{parsedCargo.parsed_goods_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t.parsed_weight}:</span>
                  <span className="font-bold text-emerald-400 text-sm">{parsedCargo.parsed_cargo_weight_kg} kg</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t.handling_notes}:</span>
                  <span className="font-medium text-slate-300 text-xs">{parsedCargo.handling_notes}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===================== VEHICLE & FEASIBLE TIMING ===================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* VEHICLE PICKER (AI RECOMMENDATION AGENT + USER PREFERENCE SELECTOR) */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading font-semibold text-white text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Vehicle Fleet & Preference</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                Agent 2/4
              </span>
            </div>

            {/* 1. ABOVE: AI VEHICLE RECOMMENDATION AGENT CARD */}
            {vehicleRecommendation ? (
              <div className="p-3.5 bg-purple-950/40 border border-purple-500/30 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>{t.ai_vehicle_recommended_title}</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-200 rounded border border-purple-500/30 font-medium">
                    {t.ai_recommended_badge}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-purple-500/20">
                  <div>
                    <div className="font-bold text-white text-sm flex items-center gap-2">
                      <span>{vehicleRecommendation.recommended_vehicle}</span>
                      <span className="text-[11px] font-normal text-purple-300">
                        ({vehicleRecommendation.capacity_kg || vehicleRecommendation.vehicle_capacity_kg || '1,750'} kg payload capacity)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {vehicleRecommendation.suitability_reason || vehicleRecommendation.recommendation_reason || "Calibrated based on cargo weight and route constraints."}
                    </p>
                    {vehicleRecommendation.payload_utilization_pct && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span>Payload utilization:</span>
                        <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              vehicleRecommendation.payload_utilization_pct > 90 ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.min(100, vehicleRecommendation.payload_utilization_pct)}%` }}
                          />
                        </div>
                        <span className="font-mono text-purple-300">{vehicleRecommendation.payload_utilization_pct}%</span>
                      </div>
                    )}
                  </div>

                  {vehicleType === vehicleRecommendation.recommended_vehicle ? (
                    <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30 flex items-center gap-1 self-start sm:self-center">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.matches_recommendation}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleType(vehicleRecommendation.recommended_vehicle);
                        setUserHasChosenVehicle(false);
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{t.apply_recommendation_btn}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : isRecommendingVehicle ? (
              <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                <span>AI Agent is analyzing cargo weight and distance to find the best vehicle...</span>
              </div>
            ) : null}

            {/* 2. BELOW: USER VEHICLE PREFERENCE SELECTOR (CAN FREELY CHOOSE OR OVERRIDE) */}
            <div className="space-y-3 text-xs pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-medium">
                    {t.selected_preference_label}
                  </label>
                  {vehicleType === vehicleRecommendation?.recommended_vehicle ? (
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>AI Recommended Selection</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-medium">
                      User Custom Preference
                    </span>
                  )}
                </div>

                <select
                  value={vehicleType}
                  onChange={(e) => {
                    const newV = e.target.value;
                    setVehicleType(newV);
                    setUserHasChosenVehicle(true);
                    fetchFarePrediction(null, newV);
                  }}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {/* Prioritized: Most used & available vehicles first */}
                  <option value="Mahindra Bolero Pickup">Mahindra Bolero Pickup (1.5 - 2.0 Ton) — Most Used Rural Workhorse</option>
                  <option value="3-Wheeler Auto">3-Wheeler Auto / Ape (500 kg) — Most Available Local & City</option>
                  <option value="Tata Ace / Chhota Hathi">Tata Ace / Chhota Hathi (Mini Truck 750 - 850 kg) — Universal Mini Truck</option>
                  <option value="Tata Intra / Ashok Leyland Dost">Tata Intra / Ashok Leyland Dost (1.2 - 1.5 Ton) — High-Deck Mid Pickup</option>
                  <option value="Open Tractor & Trolley">Open Tractor & Trolley (Agri / Construction 3-5 Ton) — Farm Harvest & Sand</option>
                  <option value="14ft Eicher">14ft Eicher (Light Truck 4-5 Ton) — Inter-Mandi Wholesale</option>
                  <option value="17ft / 19ft Eicher">17ft / 19ft Eicher (Medium Truck 7-10 Ton) — Inter-City Freight</option>
                  <option value="Tata / Ashok Leyland 6/10-Wheeler">Tata / Ashok Leyland 6/10-Wheeler (Heavy Truck 10-16 Ton)</option>
                  <option value="Container Truck">Container Truck (Multi-Axle Heavy 20-32 Ton) — Long-Haul Logistics</option>
                  <option value="2-Wheeler / Bike Cargo">2-Wheeler / Bike Cargo (Delivery up to 25 kg) — Express Small Parcel</option>
                  <option value="Custom Vehicle">Custom Vehicle Type (Enter Below)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t.custom_vehicle}</label>
                <input
                  type="text"
                  value={customVehicleDetails}
                  onChange={(e) => {
                    setCustomVehicleDetails(e.target.value);
                    if (vehicleType === "Custom Vehicle" && e.target.value.trim().length >= 2) {
                      fetchFarePrediction(null, e.target.value.trim());
                    }
                  }}
                  placeholder="e.g. auto, pickup, eicher 19ft, hydraulic tipper..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* TIMING SELECTION (FLEXIBLE DATE RANGE & SPECIFIC DATE MODES) */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-heading font-semibold text-white text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{t.timing_heading}</span>
              </h3>

              {/* Mode Toggle: Flexible Range vs Specific Single Date */}
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDateMode("RANGE")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                    dateMode === "RANGE"
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.date_mode_range || "Flexible Range"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDateMode("SINGLE");
                    setFeasibleDateTo(feasibleDate);
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                    dateMode === "SINGLE"
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.date_mode_single || "Single Date"}
                </button>
              </div>
            </div>

            {dateMode === "RANGE" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">
                      {t.feasible_date_from || "Pickup From (Start Date)"}
                    </label>
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={feasibleDate}
                      onChange={(e) => {
                        const newFrom = e.target.value;
                        setFeasibleDate(newFrom);
                        if (newFrom > feasibleDateTo) {
                          const d = new Date(newFrom);
                          d.setDate(d.getDate() + 2);
                          setFeasibleDateTo(d.toISOString().split('T')[0]);
                        }
                      }}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">
                      {t.feasible_date_to || "Flexible Till (End Date)"}
                    </label>
                    <input
                      type="date"
                      required
                      min={feasibleDate || todayStr}
                      value={feasibleDateTo}
                      onChange={(e) => setFeasibleDateTo(e.target.value)}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Quick Presets (+1 Day, +2 Days, +4 Days, +7 Days) */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="text-slate-400 mr-1">Quick Range:</span>
                  {[
                    { label: "+1 Day (2 Days)", days: 1 },
                    { label: "+2 Days (3 Days)", days: 2 },
                    { label: "+4 Days (5 Days)", days: 4 },
                    { label: "+7 Days (1 Week)", days: 7 }
                  ].map((preset) => {
                    const start = new Date(feasibleDate || todayStr);
                    const end = new Date(start);
                    end.setDate(end.getDate() + preset.days);
                    const targetStr = end.toISOString().split('T')[0];
                    const isSelected = feasibleDateTo === targetStr;

                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setFeasibleDateTo(targetStr)}
                        className={`px-2 py-0.5 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                            : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Live Window Summary Banner */}
                <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>
                      <strong>{t.date_range_summary || "Flexible Pickup Window"}:</strong>{" "}
                      {feasibleDate} ➔ {feasibleDateTo}
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-md font-mono font-bold text-emerald-300">
                    {Math.max(1, Math.round((new Date(feasibleDateTo) - new Date(feasibleDate)) / (1000 * 60 * 60 * 24)) + 1)} Days Window
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-slate-400 mb-1 text-xs">{t.feasible_date}</label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={feasibleDate}
                  onChange={(e) => {
                    setFeasibleDate(e.target.value);
                    setFeasibleDateTo(e.target.value);
                  }}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-400 mb-1 text-xs">{t.feasible_time_window}</label>
              <select
                value={feasibleTimeWindow}
                onChange={(e) => setFeasibleTimeWindow(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="Morning (06:00 AM - 10:00 AM)">{t.time_morning}</option>
                <option value="Afternoon (12:00 PM - 04:00 PM)">{t.time_afternoon}</option>
                <option value="Evening (04:00 PM - 08:00 PM)">{t.time_evening}</option>
                <option value="Flexible / Any Time">{t.time_anytime}</option>
              </select>
            </div>
          </div>
        </div>

        {/* ===================== PRICING & COST ESTIMATION AGENT & BUDGET ===================== */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-emerald-400" />
                  <span>Pricing & Cost Estimation Agent</span>
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  Agent 3/4
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Calculates fair freight tariffs from your vehicle preference (<span className="text-white font-semibold">{vehicleType === "Custom Vehicle" && customVehicleDetails ? customVehicleDetails : vehicleType}</span>) & distance (<span className="text-white font-semibold">{distanceKm} km</span>).
                {(isCustomPickupVillage || isCustomDropVillage) && (
                  <span className="block text-emerald-400 font-medium text-[11px] mt-0.5">
                    ✓ Custom Village Route Applied: {pickupVillage || pickupTaluka} ➔ {dropVillage || dropTaluka} ({distanceKm} km)
                  </span>
                )}
              </p>
            </div>

            {predictedPriceData && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  ⚡ Inference: {predictedPriceData.inference_time_ms} ms
                </span>
                <span className="text-[11px] font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
                  {predictedPriceData.model_version}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">XGBoost Fair Market Fare</span>
              <div className="text-2xl font-black text-emerald-400">
                ₹{predictedPriceData?.predicted_fair_price || "..."}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                ≈ ₹{predictedPriceData?.rate_per_km}/km ({predictedPriceData?.distance_km} km)
              </span>
            </div>

            <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Fair Negotiation Boundary</span>
              <div className="text-lg font-bold text-slate-200">
                ₹{predictedPriceData?.min_recommended_fare} - ₹{predictedPriceData?.max_recommended_fare}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Recommended corridor fair price range
              </span>
            </div>

            <div className="p-4 bg-emerald-950/20 border border-emerald-500/40 rounded-xl">
              <label className="text-xs font-semibold text-emerald-400 block mb-1">
                {t.budget_label}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  required
                  value={customerBudget}
                  onChange={(e) => setCustomerBudget(e.target.value)}
                  className="w-full bg-slate-800 border border-emerald-500/50 rounded-lg pl-7 pr-3 py-1.5 text-white font-bold text-lg focus:outline-none focus:border-emerald-400"
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Drivers can accept this rate directly or place counter-offers.
              </span>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {postSuccess && (
          <div id="post-success-banner-bottom" className="p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500 rounded-2xl shadow-2xl space-y-3 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white text-base">
                  Freight Load #{postSuccess.id} Published Successfully!
                </h4>
                <p className="text-xs text-emerald-300">
                  Visible to drivers in <span className="font-semibold">{postSuccess.pickup_taluka}, {postSuccess.pickup_district}</span>.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setHighlightOrderId(postSuccess.id);
                  setPortalSubTab('MY_ORDERS');
                }}
                className="w-full sm:w-auto flex-1 py-3 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Track Load #{postSuccess.id} & Driver Decisions →</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateToDriverFeed && onNavigateToDriverFeed(postSuccess)}
                className="w-full sm:w-auto py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>Driver Feed</span>
              </button>
              <button
                type="button"
                onClick={() => setPostSuccess(null)}
                className="w-full sm:w-auto py-3 px-4 bg-slate-800/80 hover:bg-slate-700 text-slate-400 text-xs rounded-xl border border-slate-700/60 transition cursor-pointer"
              >
                Post Another Load
              </button>
            </div>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t.submitting}</span>
            </>
          ) : (
            <>
              <Truck className="w-5 h-5" />
              <span>{t.post_load_button}</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </>
  )}

      {/* ===================== MAP PICKER MODAL ===================== */}
      <MapPickerModal
        isOpen={mapTarget !== null}
        onClose={() => setMapTarget(null)}
        targetType={mapTarget}
        initialLocation={mapTarget === 'pickup' ? pickupCoords : dropCoords}
        title={mapTarget === 'pickup' ? `${t.pick_on_map} (Pickup Location)` : `${t.pick_on_map} (Dropoff Destination)`}
        state={mapTarget === 'pickup' ? pickupState : dropState}
        district={mapTarget === 'pickup' ? pickupDistrict : dropDistrict}
        taluka={mapTarget === 'pickup' ? pickupTaluka : dropTaluka}
        hierarchy={hierarchy}
        t={t}
        onSelectLocation={(selected) => {
          if (mapTarget === 'pickup') {
            const chosenVillage = selected.village || selected.landmark;
            setPickupCoords({ lat: selected.lat, lng: selected.lng, label: chosenVillage });
            setIsCustomPickupPin(true);
            if (chosenVillage) {
              setPickupVillage(chosenVillage);
              setIsCustomPickupVillage(false);
              setPickupVillagesList(prev => {
                if (!prev.includes(chosenVillage)) return [chosenVillage, ...prev];
                return prev;
              });
            }
            if (selected.landmark) setPickupLandmark(selected.landmark);
            setTimeout(() => triggerDistanceCalculation(true, { pickupPin: true }), 100);
          } else if (mapTarget === 'drop') {
            const chosenVillage = selected.village || selected.landmark;
            setDropCoords({ lat: selected.lat, lng: selected.lng, label: chosenVillage });
            setIsCustomDropPin(true);
            if (chosenVillage) {
              setDropVillage(chosenVillage);
              setIsCustomDropVillage(false);
              setDropVillagesList(prev => {
                if (!prev.includes(chosenVillage)) return [chosenVillage, ...prev];
                return prev;
              });
            }
            if (selected.landmark) setDropLandmark(selected.landmark);
            setTimeout(() => triggerDistanceCalculation(true, { dropPin: true }), 100);
          }
          setMapTarget(null);
        }}
      />

      {/* ===================== GOOGLE MAPS API KEY MODAL ===================== */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold">
                <Key className="w-5 h-5 text-blue-400" />
                <span>Configure Google Maps API</span>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                FlexiFreight AI supports official <strong>Google Maps Distance Matrix & Geocoding APIs</strong>.
              </p>
              <p className="text-slate-400">
                When an API key is provided, transit distance and durations are queried directly from Google Maps. Without a key, the platform automatically uses <strong>OSRM real road network routing</strong> and <strong>OpenStreetMap</strong> with zero setup required.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Google Maps API Key:
              </label>
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
              <p className="text-[11px] text-slate-500">
                Key is stored in your local browser session or can be placed in <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">.env</code> as <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">GOOGLE_MAPS_API_KEY</code>.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              {googleMapsApiKey ? (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('flexi_gmaps_key');
                    setGoogleMapsApiKey('');
                    setTempApiKey('');
                    setShowApiKeyModal(false);
                    triggerDistanceCalculation(true);
                  }}
                  className="text-rose-400 hover:text-rose-300 text-xs font-medium cursor-pointer"
                >
                  Clear Key
                </button>
              ) : <div></div>}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingKey}
                  onClick={async () => {
                    const cleanKey = tempApiKey.trim();
                    if (cleanKey) {
                      localStorage.setItem('flexi_gmaps_key', cleanKey);
                      setIsSavingKey(true);
                      try {
                        const res = await fetch('/api/v1/config/maps-key', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ api_key: cleanKey })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setServerMapsConfigured(true);
                          setServerMapsPreview(data.key_preview);
                        }
                      } catch (e) {
                        console.warn("Notice saving maps key to backend:", e);
                      } finally {
                        setIsSavingKey(false);
                      }
                    } else {
                      localStorage.removeItem('flexi_gmaps_key');
                      setServerMapsConfigured(false);
                      setServerMapsPreview(null);
                    }
                    setGoogleMapsApiKey(cleanKey);
                    setShowApiKeyModal(false);
                    triggerDistanceCalculation(true);
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {isSavingKey ? "Saving & Verifying..." : "Save & Activate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
