import React, { useState, useEffect } from 'react';
import { 
  Truck, ShieldCheck, ShieldAlert, Search, MapPin, 
  IndianRupee, MessageSquare, CheckCircle2, XCircle, 
  ArrowRight, Filter, RefreshCw, Compass, AlertCircle, Clock,
  Globe, Sparkles, X, Edit3, Check, Phone, ExternalLink, Package
} from 'lucide-react';
import { NegotiationRoom } from './NegotiationRoom';
import { KycModal } from './KycModal';

export function DriverFeed({ t, hierarchyData, currentUser, onOpenProfile, targetPost, onClearTargetPost }) {
  // Current logged in driver or simulated active driver state with persisted custom base
  const [driverProfile, setDriverProfile] = useState(() => {
    let savedBase = null;
    try {
      savedBase = JSON.parse(localStorage.getItem('flexifreight_driver_base') || 'null');
    } catch (e) {}

    return {
      id: 1, // Default to a valid driver ID
      full_name: currentUser?.full_name || savedBase?.full_name || "Sachin Bhausaheb Shinde",
      phone: currentUser?.phone || savedBase?.phone || "9890198765",
      vehicle_type: currentUser?.vehicle_type || savedBase?.vehicle_type || "14ft Eicher",
      registered_state: currentUser?.state || savedBase?.state || "Maharashtra",
      registered_district: currentUser?.district || savedBase?.district || "Pune",
      registered_taluka: currentUser?.taluka || savedBase?.taluka || "Haveli",
      registered_village: currentUser?.village || savedBase?.village || "Uruli Kanchan",
      kyc_verified: currentUser?.kyc_verified ?? true,
      certificate_id: "PRV-VAHAN-2026-948102",
      vehicle_photo_url: currentUser?.vehicle_photo_url
    };
  });

  // Dedicated "Set Operating Base Location" Modal State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locState, setLocState] = useState(driverProfile.registered_state || 'Maharashtra');
  const [locDistrict, setLocDistrict] = useState(driverProfile.registered_district || 'Pune');
  const [locTaluka, setLocTaluka] = useState(driverProfile.registered_taluka || 'Haveli');
  const [locVillage, setLocVillage] = useState(driverProfile.registered_village || '');
  const [locPincode, setLocPincode] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState(null);
  const [prioritizeLocation, setPrioritizeLocation] = useState(true);

  // If a newly published post was just targeted, default to ALL loads so it's guaranteed visible
  const [feedMode, setFeedMode] = useState(targetPost ? "ALL" : "LOCAL"); // "LOCAL", "ALL", "RETURN_CORRIDOR", or "ACCEPTED_TRIPS"
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptedTripsCount, setAcceptedTripsCount] = useState(0);

  // Helper to fetch count of accepted trips for current driver
  const refreshAcceptedTripsCount = async (driverId) => {
    if (!driverId) return;
    try {
      const res = await fetch(`/api/v1/posts?accepted_driver_id=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setAcceptedTripsCount(Array.isArray(data) ? data.length : 0);
      }
    } catch (e) {
      console.warn("Could not fetch accepted trips count:", e);
    }
  };

  // All-India Browse Filters
  const [browseState, setBrowseState] = useState(targetPost?.pickup_state || "ALL");
  const [browseDistrict, setBrowseDistrict] = useState(targetPost?.pickup_district || "ALL");
  const [browseTaluka, setBrowseTaluka] = useState(targetPost?.pickup_taluka || "ALL");

  // Driver Route & Village Preference Filter
  const [preferredLocation, setPreferredLocation] = useState("");

  // Return Corridor Search Filters
  const [corridorState, setCorridorState] = useState("Maharashtra");
  const [corridorDistrict, setCorridorDistrict] = useState("Pune");
  const [corridorTaluka, setCorridorTaluka] = useState("Haveli");

  // Modal States
  const [activeNegotiationPost, setActiveNegotiationPost] = useState(null);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [acceptingPostId, setAcceptingPostId] = useState(null);

  // Location Hierarchy lists for the Location Setting Modal
  const modalStates = hierarchyData ? Object.keys(hierarchyData) : ['Maharashtra', 'Gujarat', 'Karnataka', 'Madhya Pradesh'];
  const modalDistricts = hierarchyData?.[locState] ? Object.keys(hierarchyData[locState]) : [];

  const getTalukasForModal = (st, dist) => {
    if (!st || !dist || !hierarchyData?.[st]) return [];
    if (hierarchyData[st][dist]) {
      return Array.isArray(hierarchyData[st][dist])
        ? hierarchyData[st][dist]
        : Object.keys(hierarchyData[st][dist]);
    }
    const foundKey = Object.keys(hierarchyData[st]).find(k =>
      k.toLowerCase() === dist.toLowerCase() ||
      k.toLowerCase().includes(dist.toLowerCase()) ||
      dist.toLowerCase().includes(k.toLowerCase())
    );
    if (!foundKey) return [];
    return Array.isArray(hierarchyData[st][foundKey])
      ? hierarchyData[st][foundKey]
      : Object.keys(hierarchyData[st][foundKey]);
  };
  const modalTalukas = getTalukasForModal(locState, locDistrict);

  const handleModalStateChange = (newSt) => {
    setLocState(newSt);
    const newDistricts = hierarchyData?.[newSt] ? Object.keys(hierarchyData[newSt]) : [];
    const firstDist = newDistricts[0] || '';
    setLocDistrict(firstDist);
    const newTalukas = getTalukasForModal(newSt, firstDist);
    setLocTaluka(newTalukas[0] || '');
  };

  const handleModalDistrictChange = (newDist) => {
    setLocDistrict(newDist);
    const newTalukas = getTalukasForModal(locState, newDist);
    setLocTaluka(newTalukas[0] || '');
  };

  const handleModalPincodeLookup = async (pin) => {
    const clean = pin.trim();
    if (clean.length !== 6) return;
    setPincodeLoading(true);
    try {
      const res = await fetch(`/api/v1/locations/pincode/${clean}`);
      const data = await res.json();
      if (res.ok && data.found) {
        if (data.state) setLocState(data.state);
        if (data.district) setLocDistrict(data.district);
        if (data.taluka) setLocTaluka(data.taluka);
        if (data.village && !locVillage) setLocVillage(data.village);
      }
    } catch (e) {
      console.warn("Pincode lookup error:", e);
    } finally {
      setPincodeLoading(false);
    }
  };

  const handleSaveDriverLocation = async (st = locState, dist = locDistrict, tal = locTaluka, vill = locVillage) => {
    setIsSavingLocation(true);
    try {
      const updated = {
        ...driverProfile,
        registered_state: st,
        registered_district: dist,
        registered_taluka: tal,
        registered_village: vill
      };
      setDriverProfile(updated);

      localStorage.setItem('flexifreight_driver_base', JSON.stringify({
        state: st,
        district: dist,
        taluka: tal,
        village: vill
      }));

      // Update backend driver location
      if (driverProfile.id) {
        fetch(`/api/v1/drivers/${driverProfile.id}/location`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registered_state: st,
            registered_district: dist,
            registered_taluka: tal,
            registered_village: vill
          })
        }).catch(err => console.warn("Driver location sync notice:", err));
      }

      // If user is authenticated, also sync user profile
      const token = localStorage.getItem('flexifreight_token');
      if (token && currentUser) {
        fetch('/api/v1/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            state: st,
            district: dist,
            taluka: tal,
            village: vill
          })
        }).catch(err => console.warn("User profile sync notice:", err));
      }

      setLocationSuccessMsg(`Operating base updated to ${tal}, ${dist}! Trip posts for your area are prioritized first.`);
      setTimeout(() => setLocationSuccessMsg(null), 5000);
      setIsLocationModalOpen(false);
    } catch (err) {
      console.error("Error updating location:", err);
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Sync with real driver ID in DB while preserving user's chosen location
  useEffect(() => {
    let savedBase = null;
    try {
      savedBase = JSON.parse(localStorage.getItem('flexifreight_driver_base') || 'null');
    } catch (e) {}

    fetch('/api/v1/drivers')
      .then(res => res.json())
      .then(drivers => {
        if (Array.isArray(drivers) && drivers.length > 0) {
          let matched = null;
          if (currentUser) {
            matched = drivers.find(d => 
              (currentUser.phone && d.phone === currentUser.phone) ||
              (currentUser.full_name && d.full_name.toLowerCase() === currentUser.full_name.toLowerCase())
            );
          }
          if (!matched) {
            if (savedBase?.district) {
              matched = drivers.find(d => d.registered_district.toLowerCase() === savedBase.district.toLowerCase()) || drivers[0];
            } else {
              matched = drivers[0];
            }
          }
          if (matched) {
            setDriverProfile(prev => ({
              ...prev,
              id: matched.id,
              full_name: currentUser?.full_name || matched.full_name,
              phone: currentUser?.phone || matched.phone,
              vehicle_type: currentUser?.vehicle_type || matched.vehicle_type || prev.vehicle_type,
              registered_state: currentUser?.state || savedBase?.state || matched.registered_state || prev.registered_state,
              registered_district: currentUser?.district || savedBase?.district || matched.registered_district || prev.registered_district,
              registered_taluka: currentUser?.taluka || savedBase?.taluka || matched.registered_taluka || prev.registered_taluka,
              registered_village: currentUser?.village || savedBase?.village || prev.registered_village,
              kyc_verified: matched.kyc_verified,
              certificate_id: matched.parivahan_details?.certificate_id || prev.certificate_id
            }));
            refreshAcceptedTripsCount(matched.id);
          }
        }
      })
      .catch(err => console.warn("Notice: driver lookup:", err));
  }, [currentUser]);

  // Keep accepted trips count fresh whenever driver ID is available
  useEffect(() => {
    if (driverProfile.id) {
      refreshAcceptedTripsCount(driverProfile.id);
    }
  }, [driverProfile.id]);

  // When targetPost changes, adjust mode and filters to show it
  useEffect(() => {
    if (targetPost) {
      setFeedMode("ALL");
      setBrowseState(targetPost.pickup_state || "ALL");
      setBrowseDistrict(targetPost.pickup_district || "ALL");
      setBrowseTaluka(targetPost.pickup_taluka || "ALL");
    }
  }, [targetPost]);

  // Fetch posts according to Geofencing, All-India, Return Corridor, or Accepted Trips
  const fetchPosts = async () => {
    setLoading(true);
    try {
      let url = `/api/v1/posts?`;
      if (feedMode === "ACCEPTED_TRIPS") {
        url += `accepted_driver_id=${driverProfile.id || 1}`;
      } else {
        url += `driver_id=${driverProfile.id || 1}&`;
        if (feedMode === "LOCAL") {
          url += `driver_taluka=${encodeURIComponent(driverProfile.registered_taluka)}&driver_district=${encodeURIComponent(driverProfile.registered_district)}`;
        } else if (feedMode === "ALL") {
          url += `all_loads=true`;
          if (browseState && browseState !== "ALL") url += `&pickup_state=${encodeURIComponent(browseState)}`;
          if (browseDistrict && browseDistrict !== "ALL") url += `&pickup_district=${encodeURIComponent(browseDistrict)}`;
          if (browseTaluka && browseTaluka !== "ALL") url += `&pickup_taluka=${encodeURIComponent(browseTaluka)}`;
        } else {
          url += `corridor_dest_state=${encodeURIComponent(corridorState)}&corridor_dest_district=${encodeURIComponent(corridorDistrict)}&corridor_dest_taluka=${encodeURIComponent(corridorTaluka)}`;
        }
      }

      const res = await fetch(url);
      const data = await res.json();
      setPosts(data || []);
      if (feedMode === "ACCEPTED_TRIPS") {
        setAcceptedTripsCount(Array.isArray(data) ? data.length : 0);
      } else if (driverProfile.id) {
        refreshAcceptedTripsCount(driverProfile.id);
      }
    } catch (e) {
      console.error("Error fetching freight loads", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [
    feedMode, 
    driverProfile.registered_taluka, 
    driverProfile.registered_district, 
    driverProfile.registered_state,
    corridorTaluka, 
    corridorDistrict, 
    browseState, 
    browseDistrict, 
    browseTaluka, 
    driverProfile.id
  ]);

  // Direct Accept Order (Notifies Customer and requests approval)
  const handleDirectAccept = async (post) => {
    setAcceptingPostId(post.id);
    try {
      const res = await fetch(`/api/v1/posts/${post.id}/driver-accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverProfile.id || 1,
          offered_price: post.customer_budget,
          message: `Transporter ${driverProfile.full_name} accepted this load at listed budget rate of ₹${post.customer_budget}. Ready for pickup.`
        })
      });
      const offer = await res.json();
      if (!res.ok) throw new Error(offer.detail || "Could not accept order");

      alert(`✅ Acceptance Sent to Customer (${post.customer_name})!\n\nThe customer has been notified and will review your profile to approve and choose contact number sharing.`);
      fetchPosts();
    } catch (e) {
      alert("Notice: " + e.message);
    } finally {
      setAcceptingPostId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* KYC Modal */}
      <KycModal
        isOpen={isKycModalOpen}
        onClose={() => setIsKycModalOpen(false)}
        t={t}
        onVerificationComplete={(data) => {
          setDriverProfile(prev => ({
            ...prev,
            full_name: data.full_name,
            kyc_verified: true,
            certificate_id: data.certificate_id
          }));
        }}
      />

      {/* Negotiation Room Modal */}
      {activeNegotiationPost && (
        <NegotiationRoom
          isOpen={!!activeNegotiationPost}
          onClose={() => {
            setActiveNegotiationPost(null);
            fetchPosts();
          }}
          post={activeNegotiationPost}
          currentRole="DRIVER"
          driverProfile={driverProfile}
          t={t}
          onDealFinalized={() => {
            fetchPosts();
          }}
        />
      )}

      {/* SET OPERATING BASE LOCATION MODAL */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto scrollbar-thin">
            {/* Close button */}
            <button
              onClick={() => setIsLocationModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl text-slate-950 shadow-lg shadow-emerald-500/20">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-white text-base">Set Transporter Operating Base</h3>
                <p className="text-xs text-slate-400">
                  Select your vehicle's station/base. Loads from your location are recommended & shown first!
                </p>
              </div>
            </div>

            {/* 1-Click Fast Corridors */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 block">Popular Maharashtra Mandi Hubs:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: "Pune (Haveli Hub)", state: "Maharashtra", district: "Pune", taluka: "Haveli", pin: "411001" },
                  { name: "Nashik (Niphad Mandi)", state: "Maharashtra", district: "Nashik", taluka: "Niphad", pin: "422209" },
                  { name: "Amravati (Anjangaon Surji)", state: "Maharashtra", district: "Amravati", taluka: "Anjangaon Surji", pin: "444705" },
                  { name: "Nagpur (Nagpur Urban)", state: "Maharashtra", district: "Nagpur", taluka: "Nagpur Urban", pin: "440001" },
                  { name: "Chhatrapati Sambhajinagar", state: "Maharashtra", district: "Chhatrapati Sambhajinagar (Aurangabad)", taluka: "Aurangabad", pin: "431001" }
                ].map(item => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setLocState(item.state);
                      setLocDistrict(item.district);
                      setLocTaluka(item.taluka);
                      setLocPincode(item.pin);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition border cursor-pointer ${
                      locDistrict.toLowerCase() === item.district.toLowerCase() && locTaluka.toLowerCase() === item.taluka.toLowerCase()
                        ? 'bg-emerald-600 border-emerald-500 text-white font-bold shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    📍 {item.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Cascading Dropdowns */}
            <div className="space-y-3 text-xs">
              {/* 1. State */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">1. State / UT</label>
                <select
                  value={locState}
                  onChange={(e) => handleModalStateChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {modalStates.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* 2. District */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">2. District / City</label>
                <select
                  value={locDistrict}
                  onChange={(e) => handleModalDistrictChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
                >
                  {modalDistricts.map(dist => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
              </div>

              {/* 3. Taluka / Tehsil Hub */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">3. Taluka / Tehsil / Mandi Hub</label>
                <select
                  value={locTaluka}
                  onChange={(e) => setLocTaluka(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer font-bold text-emerald-400"
                >
                  {modalTalukas.map(tal => (
                    <option key={tal} value={tal}>{tal}</option>
                  ))}
                </select>
              </div>

              {/* 4. Village / Town */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">4. Village / Town / Station Area (Optional)</label>
                <input
                  type="text"
                  value={locVillage}
                  onChange={(e) => setLocVillage(e.target.value)}
                  placeholder="e.g. Uruli Kanchan, Hadapsar, Pimpalgaon Baswant"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* 5. Quick Pincode */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-400 flex-shrink-0">Auto-Fill via PIN:</span>
                <input
                  type="text"
                  maxLength={6}
                  value={locPincode}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setLocPincode(clean);
                    if (clean.length === 6) handleModalPincodeLookup(clean);
                  }}
                  placeholder="6-digit PIN (e.g. 412201)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
                {pincodeLoading && <span className="text-[11px] text-emerald-400 animate-pulse">Resolving...</span>}
              </div>
            </div>

            {/* Save & Confirm Button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingLocation}
                onClick={() => handleSaveDriverLocation(locState, locDistrict, locTaluka, locVillage)}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingLocation ? 'Updating Base...' : 'Save & Prioritize Base'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRIVER PROFILE & KYC STATUS BAR */}
      <div className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 rounded-2xl flex items-center justify-center font-bold text-lg shadow-lg shadow-amber-500/20">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-white text-base">{driverProfile.full_name}</h3>
              {driverProfile.kyc_verified ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t.verified_badge}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold bg-rose-500/10 text-rose-400 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{t.unverified_badge}</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Vehicle: <b className="text-slate-200 font-medium">{driverProfile.vehicle_type}</b></span>
              <span>•</span>
              <div className="inline-flex items-center gap-1.5 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800">
                <MapPin className="w-3 h-3 text-emerald-400" />
                <span>Base: <b className="text-emerald-400">{driverProfile.registered_taluka}, {driverProfile.registered_district}</b></span>
                <button
                  type="button"
                  onClick={() => {
                    setLocState(driverProfile.registered_state || 'Maharashtra');
                    setLocDistrict(driverProfile.registered_district || 'Pune');
                    setLocTaluka(driverProfile.registered_taluka || 'Haveli');
                    setLocVillage(driverProfile.registered_village || '');
                    setIsLocationModalOpen(true);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 underline font-semibold ml-1 cursor-pointer"
                  title="Change your operating location"
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Direct Set Location Button */}
          <button
            type="button"
            onClick={() => {
              setLocState(driverProfile.registered_state || 'Maharashtra');
              setLocDistrict(driverProfile.registered_district || 'Pune');
              setLocTaluka(driverProfile.registered_taluka || 'Haveli');
              setLocVillage(driverProfile.registered_village || '');
              setIsLocationModalOpen(true);
            }}
            className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-slate-950" />
            <span>Set Location</span>
          </button>

          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span>Edit Profile & Vehicle</span>
            </button>
          )}

          {!driverProfile.kyc_verified ? (
            <button
              onClick={() => setIsKycModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{t.verify_now_btn}</span>
            </button>
          ) : (
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-slate-400 block">Govt Registry ID</span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">{driverProfile.certificate_id}</span>
            </div>
          )}
        </div>
      </div>

      {/* Location Success Toast */}
      {locationSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 shadow-lg animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{locationSuccessMsg}</span>
        </div>
      )}

      {/* QUICK OPERATING BASE & PRIORITY CORRIDOR BAR */}
      <div className="glass-card p-3 sm:p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-medium">Active Operating Base:</span>
              <span className="text-white font-bold">{driverProfile.registered_taluka}, {driverProfile.registered_district}</span>
              <span className="text-[10px] text-slate-500 font-mono">({driverProfile.registered_state})</span>
            </div>
            <p className="text-[11px] text-emerald-400 font-medium">
              ⚡ Trip posts in your area are automatically recommended and shown first!
            </p>
          </div>
        </div>

        {/* 1-Click Quick Base Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-500 mr-1 font-medium">Quick Switch:</span>
          {[
            { name: "Pune (Haveli)", state: "Maharashtra", district: "Pune", taluka: "Haveli" },
            { name: "Nashik (Niphad)", state: "Maharashtra", district: "Nashik", taluka: "Niphad" },
            { name: "Amravati (Anjangaon)", state: "Maharashtra", district: "Amravati", taluka: "Anjangaon Surji" },
            { name: "Nagpur Urban", state: "Maharashtra", district: "Nagpur", taluka: "Nagpur Urban" }
          ].map(item => {
            const isActive = driverProfile.registered_district.toLowerCase() === item.district.toLowerCase() &&
                             driverProfile.registered_taluka.toLowerCase() === item.taluka.toLowerCase();
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => handleSaveDriverLocation(item.state, item.district, item.taluka)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm font-bold'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                📍 {item.name}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setLocState(driverProfile.registered_state || 'Maharashtra');
              setLocDistrict(driverProfile.registered_district || 'Pune');
              setLocTaluka(driverProfile.registered_taluka || 'Haveli');
              setLocVillage(driverProfile.registered_village || '');
              setIsLocationModalOpen(true);
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 transition cursor-pointer flex items-center gap-1"
          >
            <span>+ Change Location</span>
          </button>
        </div>
      </div>

      {/* TARGET POST RECENTLY PUBLISHED NOTIFICATION */}
      {targetPost && (
        <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/80 rounded-2xl flex items-center justify-between shadow-2xl animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <span>Freight Load #{targetPost.id} Reached Transporter Board!</span>
                <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full">LIVE</span>
              </h4>
              <p className="text-xs text-emerald-300 mt-0.5">
                Route: <span className="font-semibold">{targetPost.pickup_taluka}, {targetPost.pickup_district}</span> → <span className="font-semibold">{targetPost.drop_taluka}, {targetPost.drop_district}</span> • Budget: <b>₹{targetPost.customer_budget}</b>
              </p>
            </div>
          </div>
          {onClearTargetPost && (
            <button
              type="button"
              onClick={onClearTargetPost}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Dismiss highlight"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* DISCOVERY MODE TABS (LOCAL GEOFENCED vs ALL INDIA vs RETURN TRIP CORRIDOR SEARCH) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-2 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFeedMode("LOCAL")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              feedMode === "LOCAL"
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Local Base ({driverProfile.registered_taluka})</span>
          </button>

          <button
            onClick={() => setFeedMode("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              feedMode === "ALL"
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>All India / Browse Loads</span>
          </button>

          <button
            onClick={() => setFeedMode("RETURN_CORRIDOR")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              feedMode === "RETURN_CORRIDOR"
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>{t.mode_return_search}</span>
          </button>

          {/* USER REQUIREMENT: Right side of Return Trip Corridor Search: "My Accepted Trips" */}
          <button
            id="btn-my-accepted-trips"
            onClick={() => setFeedMode("ACCEPTED_TRIPS")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              feedMode === "ACCEPTED_TRIPS"
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{t.mode_accepted_trips || "My Accepted Trips"}</span>
            {acceptedTripsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-slate-950 shadow-sm animate-pulse">
                {acceptedTripsCount}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={fetchPosts}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition flex items-center gap-1 text-xs self-end"
          title="Refresh Feed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ALL-INDIA / BROWSE REGION FILTER BAR */}
      {feedMode === "ALL" && (() => {
        const availableTalukas = (
          hierarchyData && 
          browseState !== "ALL" && 
          browseDistrict !== "ALL" && 
          hierarchyData[browseState] && 
          hierarchyData[browseState][browseDistrict]
        ) ? (
          Array.isArray(hierarchyData[browseState][browseDistrict])
            ? hierarchyData[browseState][browseDistrict]
            : Object.keys(hierarchyData[browseState][browseDistrict])
        ) : [];

        return (
          <div className="glass-card p-4 rounded-2xl border border-teal-500/30 space-y-3 bg-teal-950/10 animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-semibold text-teal-400">
                <Globe className="w-4 h-4" />
                <span>Browse Active Demands Across India</span>
              </div>
              <span className="text-slate-400 text-[11px] font-mono">
                {posts.length} {posts.length === 1 ? 'load available' : 'loads available'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">State</label>
                <select
                  value={browseState}
                  onChange={(e) => {
                    setBrowseState(e.target.value);
                    setBrowseDistrict("ALL");
                    setBrowseTaluka("ALL");
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-teal-500 font-medium cursor-pointer"
                >
                  <option value="ALL">🌐 All States</option>
                  {hierarchyData && Object.keys(hierarchyData).map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">District / City</label>
                <select
                  value={browseDistrict}
                  onChange={(e) => {
                    setBrowseDistrict(e.target.value);
                    setBrowseTaluka("ALL");
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-teal-500 font-medium cursor-pointer"
                >
                  <option value="ALL">All Districts {browseState !== 'ALL' ? `in ${browseState}` : ''}</option>
                  {hierarchyData && browseState !== "ALL" && hierarchyData[browseState] && 
                    Object.keys(hierarchyData[browseState]).map(dist => (
                      <option key={dist} value={dist}>{dist}</option>
                    ))
                  }
                </select>
              </div>

              {/* Requirement 1: Taluka Dropdown Field */}
              <div>
                <label className="block text-slate-400 mb-1">Taluka</label>
                <select
                  value={browseTaluka}
                  onChange={(e) => setBrowseTaluka(e.target.value)}
                  disabled={browseDistrict === "ALL" || availableTalukas.length === 0}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-teal-500 font-medium cursor-pointer disabled:opacity-40"
                >
                  <option value="ALL">🏛️ All Talukas {browseDistrict !== 'ALL' ? `in ${browseDistrict}` : ''}</option>
                  {availableTalukas.map(tal => (
                    <option key={tal} value={tal}>{tal}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setBrowseState("ALL");
                    setBrowseDistrict("ALL");
                    setBrowseTaluka("ALL");
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
                >
                  <span>Reset to All Loads</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dedicated "Your Accepted Trips" Banner & Status Header */}
      {feedMode === "ACCEPTED_TRIPS" && (
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-slate-900/90 to-emerald-950/30 shadow-xl space-y-2 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>{t.accepted_trips_banner || "Confirmed Orders & Accepted Trips"}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    {posts.length} {posts.length === 1 ? 'Trip Confirmed' : 'Trips Confirmed'}
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {t.accepted_trips_desc || "These freight loads have been officially finalized with your agreed fare. Customer contact details and exact route landmarks are unlocked below for direct pickup coordination."}
                </p>
              </div>
            </div>

            <button
              onClick={fetchPosts}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700/80 self-start sm:self-auto transition cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Orders</span>
            </button>
          </div>
        </div>
      )}

      {/* Requirement 2: Driver Preference & Route Recommendation Finder */}
      {feedMode !== "ACCEPTED_TRIPS" && (
        <div className="glass-card p-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 space-y-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Trip Preference & Village/City Recommendation Finder</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Your Registered Base: <span className="text-emerald-400 font-bold">{driverProfile.registered_taluka}, {driverProfile.registered_district}</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={preferredLocation}
                onChange={(e) => setPreferredLocation(e.target.value)}
                placeholder="Enter destination or pickup city, village or mandi (e.g. Ratnapur, Amravati, Akola, Pune)..."
                className="w-full bg-slate-800/90 border border-slate-700 focus:border-indigo-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              {preferredLocation && (
                <button
                  type="button"
                  onClick={() => setPreferredLocation("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {preferredLocation && (
              <button
                type="button"
                onClick={() => setPreferredLocation("")}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 cursor-pointer"
              >
                Clear Preference
              </button>
            )}
          </div>

          {/* Quick Suggestion Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
            <span className="text-slate-400 mr-1">Recommended Corridors:</span>
            {["Ratnapur Bk.", "Anjangaon Surji", "Amravati", "Pune", "Nashik", "Uruli Kanchan"].map(place => (
              <button
                key={place}
                type="button"
                onClick={() => setPreferredLocation(place)}
                className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  preferredLocation.toLowerCase() === place.toLowerCase()
                    ? 'bg-indigo-600 border-indigo-400 text-white font-bold shadow'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                📍 {place}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RETURN CORRIDOR SEARCH FILTER BAR */}
      {feedMode === "RETURN_CORRIDOR" && (
        <div className="glass-card p-4 rounded-2xl border border-amber-500/30 space-y-3 bg-amber-950/10">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <Compass className="w-4 h-4" />
            <span>{t.return_search_hint}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">{t.destination_state}</label>
              <input
                type="text"
                value={corridorState}
                onChange={(e) => setCorridorState(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.destination_district}</label>
              <input
                type="text"
                value={corridorDistrict}
                onChange={(e) => setCorridorDistrict(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.destination_taluka}</label>
              <input
                type="text"
                value={corridorTaluka}
                onChange={(e) => setCorridorTaluka(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchPosts}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{t.search_corridor}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FREIGHT LOAD CARDS LIST */}
      {loading ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Searching active freight loads matching your location parameters...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-2xl border border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            {feedMode === "ACCEPTED_TRIPS" ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            ) : (
              <Truck className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-slate-200">
              {feedMode === "ACCEPTED_TRIPS" 
                ? (t.no_accepted_trips || "No Accepted Trips Yet")
                : t.no_loads_found}
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {feedMode === "ACCEPTED_TRIPS"
                ? (t.no_accepted_trips_hint || "Once a customer approves your accepted offer or finalizes a deal with you, it will appear here with unlocked customer phone and trip coordination details.")
                : feedMode === "LOCAL" 
                ? `Currently no pending loads in ${driverProfile.registered_taluka}. Try switching to "All India / Browse Loads" or search return corridors!`
                : "Try adjusting district or taluka to broaden your load query."}
            </p>
          </div>
          {feedMode === "ACCEPTED_TRIPS" && (
            <div className="pt-2">
              <button
                onClick={() => setFeedMode("LOCAL")}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              >
                Browse Available Loads to Accept Deals
              </button>
            </div>
          )}
        </div>
      ) : (() => {
        // Calculate recommendation scores & sort matching trips to the top
        const prefClean = preferredLocation.trim().toLowerCase();
        const driverTaluka = (driverProfile.registered_taluka || "").toLowerCase().trim();
        const driverDistrict = (driverProfile.registered_district || "").toLowerCase().trim();
        const driverVillage = (driverProfile.registered_village || "").toLowerCase().trim();

        const scoredPosts = posts.map(post => {
          let score = 0;
          let matchLabel = null;
          let isBaseLocationMatch = false;

          const pVillage = (post.pickup_village || "").toLowerCase();
          const pTaluka = (post.pickup_taluka || "").toLowerCase();
          const pDistrict = (post.pickup_district || "").toLowerCase();
          const dVillage = (post.drop_village || "").toLowerCase();
          const dTaluka = (post.drop_taluka || "").toLowerCase();
          const dDistrict = (post.drop_district || "").toLowerCase();

          // 1. Base location scoring - HIGHEST PRIORITY: Recommended for driver's location first!
          // a) Exact village match in driver's base
          if (driverVillage && driverVillage.length >= 3 && (pVillage.includes(driverVillage) || dVillage.includes(driverVillage))) {
            score += 250;
            matchLabel = `⭐ Exact Village in Your Base (${pVillage.includes(driverVillage) ? post.pickup_village : post.drop_village})`;
            isBaseLocationMatch = true;
          }
          // b) Exact Taluka pickup match (Local origin pickup near driver)
          else if (driverTaluka && driverTaluka !== "__all__" && pTaluka.includes(driverTaluka)) {
            score += 200;
            matchLabel = `⭐ Top Pick: Pickup in Your Base (${post.pickup_taluka})`;
            isBaseLocationMatch = true;
          }
          // c) Return trip dropoff in driver's Taluka
          else if (driverTaluka && driverTaluka !== "__all__" && dTaluka.includes(driverTaluka)) {
            score += 160;
            matchLabel = `🔄 Return Trip to Your Base (${post.drop_taluka})`;
            isBaseLocationMatch = true;
          }
          // d) In driver's operating district (Pickup or drop)
          else if (driverDistrict && driverDistrict !== "__all__" && (pDistrict.includes(driverDistrict) || dDistrict.includes(driverDistrict))) {
            score += 100;
            matchLabel = `📍 In Your Operating District (${pDistrict.includes(driverDistrict) ? post.pickup_district : post.drop_district})`;
            isBaseLocationMatch = true;
          }

          // 2. Manual Preferred Search Location match
          if (prefClean.length >= 2) {
            if (pVillage.includes(prefClean) || dVillage.includes(prefClean)) {
              score += 120;
              if (!matchLabel) matchLabel = `🎯 Matches Search Village (${pVillage.includes(prefClean) ? post.pickup_village : post.drop_village})`;
            } else if (pTaluka.includes(prefClean) || dTaluka.includes(prefClean)) {
              score += 90;
              if (!matchLabel) matchLabel = `🎯 Matches Search Taluka (${prefClean.toUpperCase()})`;
            } else if (pDistrict.includes(prefClean) || dDistrict.includes(prefClean)) {
              score += 70;
              if (!matchLabel) matchLabel = `🎯 Matches Search District (${prefClean.toUpperCase()})`;
            }
          }

          return { ...post, _matchScore: score, _matchLabel: matchLabel, _isBaseLocationMatch: isBaseLocationMatch };
        });

        const sortedPosts = [...scoredPosts].sort((a, b) => (b._matchScore || 0) - (a._matchScore || 0));
        const baseMatchesCount = sortedPosts.filter(p => p._isBaseLocationMatch).length;

        return (
          <div className="space-y-4">
            {/* Location / Accepted Trips Notification Bar */}
            {feedMode === "ACCEPTED_TRIPS" ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-xs shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-200">
                    Your Accepted Orders: <b className="text-emerald-400 font-bold">{sortedPosts.length} finalized {sortedPosts.length === 1 ? 'trip' : 'trips'}</b> assigned to your truck
                  </span>
                </div>
                <span className="text-[11px] text-emerald-300 font-medium">Customer contacts unlocked below</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-slate-300">
                    Prioritizing loads for your base: <b className="text-emerald-400 font-bold">{driverProfile.registered_taluka}, {driverProfile.registered_district}</b>
                  </span>
                  {baseMatchesCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[10px]">
                      {baseMatchesCount} {baseMatchesCount === 1 ? 'trip' : 'trips'} recommended first
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[11px]">(Showing nearby & corridor loads)</span>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-[11px] text-slate-400">Total: {sortedPosts.length} available</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5">
            {sortedPosts.map((post) => {
              const isAgreed = post.status === "AGREED";
              const isTargeted = targetPost && post.id === targetPost.id;
              const myOffer = (post.offers || []).find(o => o.driver_id === driverProfile.id);
              const isPendingMyApproval = myOffer && myOffer.status === 'PENDING';
              const isAgreedWithMe = (isAgreed && post.agreed_driver_id === driverProfile.id) || feedMode === "ACCEPTED_TRIPS";

              const agreedOffer = (post.offers || []).find(o => o.driver_id === driverProfile.id && o.status === 'ACCEPTED');
              const finalFare = post.agreed_price || agreedOffer?.offered_price || post.customer_budget;
              const cleanCustomerPhone = post.customer_phone ? post.customer_phone.replace(/\D/g, '') : '';

              return (
                <div 
                  key={post.id}
                  className={`glass-card p-6 rounded-2xl border transition-all duration-200 space-y-4 hover:border-slate-700 shadow-xl ${
                    isTargeted 
                      ? 'border-emerald-400 ring-2 ring-emerald-500/50 bg-emerald-950/20' 
                      : isAgreedWithMe
                      ? 'border-emerald-500/80 bg-emerald-950/20'
                      : isAgreed 
                      ? 'border-slate-800 opacity-80' 
                      : post._matchScore > 40
                      ? 'border-indigo-500/50 bg-indigo-950/15'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Header row: Badge, ID, Timing */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                        Load #{post.id}
                      </span>
                      {isTargeted && (
                        <span className="text-[11px] font-bold bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Just Published Load</span>
                        </span>
                      )}
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                        post.delivery_scope === "INTRA_CITY" 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {post.delivery_scope === "INTRA_CITY" ? "Intra-Taluka Delivery" : "Inter-City Long Haul"}
                      </span>

                      {/* Status Badges */}
                      {isAgreedWithMe ? (
                        <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                          DEAL FINALIZED WITH YOU
                        </span>
                      ) : isAgreed ? (
                        <span className="text-[11px] font-bold bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg">
                          DEAL FINALIZED
                        </span>
                      ) : isPendingMyApproval ? (
                        <span className="text-[11px] font-bold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/40 animate-pulse flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>ACCEPTANCE SENT • AWAITING CUSTOMER</span>
                        </span>
                      ) : null}

                      {/* Requirement 2 Recommendation Badge */}
                      {post._matchLabel && !isAgreed && (
                        <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/40 flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>{post._matchLabel}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {post.feasible_date} ({post.feasible_time_window})
                      </span>
                    </div>
                  </div>

                  {/* Route Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 text-xs">
                    {/* Pickup Side */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Pickup: {post.pickup_taluka}, {post.pickup_district}</span>
                      </div>
                      <p className="text-slate-300 font-medium">{post.pickup_village || "Local Area"}</p>
                      {post.pickup_landmark && (
                        <p className="text-slate-400 italic">Landmark: {post.pickup_landmark}</p>
                      )}
                    </div>

                    {/* Dropoff Side */}
                    <div className="space-y-1 md:border-l md:border-slate-800 md:pl-4">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Dropoff: {post.drop_taluka}, {post.drop_district}</span>
                      </div>
                      <p className="text-slate-300 font-medium">{post.drop_village || "Local Area"}</p>
                      {post.drop_landmark && (
                        <p className="text-slate-400 italic">Landmark: {post.drop_landmark}</p>
                      )}
                    </div>
                  </div>

                  {/* Cargo & Vehicle Details */}
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Goods Description:</span>
                        <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          {post.parsed_goods_type || "General Cargo"}
                        </span>
                      </div>
                      <p className="text-slate-200 font-medium">{post.raw_goods_description}</p>
                      <div className="flex flex-wrap gap-4 pt-1 text-slate-400">
                        <span>Payload: <b className="text-white">{post.parsed_cargo_weight_kg} kg</b></span>
                        <span>Vehicle: <b className="text-white">{post.vehicle_type}</b></span>
                        <span>Distance: <b className="text-white">{post.estimated_distance_km} km</b></span>
                      </div>
                      {post.handling_notes && (
                        <p className="text-amber-300/90 text-[11px] pt-1">
                          ⚠️ Handling: {post.handling_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* UNLOCKED SHIPPER / CUSTOMER DIRECT COORDINATION PANEL */}
                  {isAgreedWithMe && (
                    <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 space-y-3 shadow-inner">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                            👤
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                              Verified Shipper / Customer Contact (Unlocked)
                            </span>
                            <span className="text-sm font-bold text-white">{post.customer_name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-300 font-mono font-bold bg-slate-900/90 px-3 py-1.5 rounded-lg border border-emerald-500/40 shadow-inner flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{post.customer_phone}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {post.customer_phone && !post.customer_phone.includes("X") && (
                          <>
                            <a
                              href={`tel:${post.customer_phone}`}
                              className="flex-1 min-w-[130px] py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call Customer ({post.customer_phone})</span>
                            </a>

                            <a
                              href={`https://wa.me/91${cleanCustomerPhone}?text=${encodeURIComponent(
                                `Hello ${post.customer_name}, I am your transporter for FlexiFreight Load #${post.id} (${post.pickup_taluka} to ${post.drop_taluka}). Our agreed fare is ₹${finalFare}. Ready for loading coordination.`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 min-w-[130px] py-2 px-3.5 bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>WhatsApp Shipper</span>
                            </a>
                          </>
                        )}

                        <button
                          onClick={() => setActiveNegotiationPost(post)}
                          className="py-2 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Deal Room & Transcript</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Financials & Actions Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[11px] text-slate-400 block">
                          {isAgreedWithMe ? "Agreed Final Fare" : t.budget_offered}
                        </span>
                        <span className={`text-xl font-black ${isAgreedWithMe ? 'text-emerald-400' : 'text-white'}`}>
                          ₹{isAgreedWithMe ? finalFare : post.customer_budget}
                        </span>
                      </div>
                      <div className="border-l border-slate-800 pl-4">
                        <span className="text-[11px] text-slate-400 block">{t.ai_fair_price}</span>
                        <span className="text-lg font-bold text-emerald-400">₹{post.base_price_predicted}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!isAgreed ? (
                        <>
                          <button
                            onClick={() => setActiveNegotiationPost(post)}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{t.negotiate_btn}</span>
                            {post.offers_count > 0 && (
                              <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full font-bold text-[10px]">
                                {post.offers_count}
                              </span>
                            )}
                          </button>

                          {isPendingMyApproval ? (
                            <span className="px-4 py-2.5 bg-amber-500/20 text-amber-300 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-amber-500/30">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Acceptance Sent (Awaiting Customer)</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDirectAccept(post)}
                              disabled={acceptingPostId === post.id}
                              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{t.direct_accept} (₹{post.customer_budget})</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => setActiveNegotiationPost(post)}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>View Deal & Direct Contact Info</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
