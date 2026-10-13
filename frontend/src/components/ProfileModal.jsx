import React, { useState, useEffect } from 'react';
import { 
  X, User, Mail, Phone, MapPin, Truck, ShieldCheck, 
  Upload, Camera, CheckCircle2, AlertCircle, Save, 
  Search, RefreshCw, FileText, Sparkles, Trash2
} from 'lucide-react';

export function ProfileModal({ 
  isOpen, 
  onClose, 
  currentUser, 
  authToken, 
  onProfileUpdated,
  hierarchyData
}) {
  if (!isOpen) return null;

  // Local editable state initialized with currentUser
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [email] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [role, setRole] = useState(currentUser?.role || 'CUSTOMER'); // 'CUSTOMER' or 'DRIVER'
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');

  // Cascading Address State: State -> District -> Taluka -> Village
  const [state, setState] = useState(currentUser?.state || 'Maharashtra');
  const [district, setDistrict] = useState(currentUser?.district || 'Pune');
  const [taluka, setTaluka] = useState(currentUser?.taluka || 'Haveli');
  const [village, setVillage] = useState(currentUser?.village || 'Uruli Kanchan');
  const [streetAddress, setStreetAddress] = useState(currentUser?.street_address || '');
  const [pincode, setPincode] = useState(currentUser?.pincode || '412201');

  // Dynamic Village list for selected Taluka
  const [villageOptions, setVillageOptions] = useState([]);
  const [isLoadingVillages, setIsLoadingVillages] = useState(false);
  const [villageSearch, setVillageSearch] = useState('');

  // Driver Specific Details
  const [dlNumber, setDlNumber] = useState(currentUser?.driving_license_no || 'MH12 20180045678');
  const [rcNumber, setRcNumber] = useState(currentUser?.vehicle_rc_no || 'MH 12 AB 1234');
  const [aadhaarNumber, setAadhaarNumber] = useState(currentUser?.aadhaar_no || '987654321098');
  const [vehicleType, setVehicleType] = useState(currentUser?.vehicle_type || 'Mahindra Bolero Pickup');
  const [vehicleModel, setVehicleModel] = useState(currentUser?.vehicle_model || 'Bolero Maxi Truck Plus');
  const [vehicleCapacityKg, setVehicleCapacityKg] = useState(currentUser?.vehicle_capacity_kg || 1500);
  const [vehicleBodyType, setVehicleBodyType] = useState(currentUser?.vehicle_body_type || 'Tarpaulin Cover');
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState(
    currentUser?.vehicle_photo_url || 
    'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=600&q=80'
  );
  const [kycVerified, setKycVerified] = useState(currentUser?.kyc_verified || false);
  const [isVerifyingKyc, setIsVerifyingKyc] = useState(false);

  // Status feedback
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Available States from hierarchyData
  const statesList = hierarchyData ? Object.keys(hierarchyData) : ['Maharashtra', 'Gujarat', 'Karnataka', 'Madhya Pradesh'];
  const districtsList = hierarchyData?.[state] ? Object.keys(hierarchyData[state]) : [];
  
  const getTalukasFor = (st, dist) => {
    if (!st || !dist || !hierarchyData?.[st]) return [];
    if (hierarchyData[st][dist]) return hierarchyData[st][dist];
    const foundKey = Object.keys(hierarchyData[st]).find(k => 
      k.toLowerCase() === dist.toLowerCase() ||
      k.toLowerCase().includes(dist.toLowerCase()) ||
      dist.toLowerCase().includes(k.toLowerCase())
    );
    return foundKey ? hierarchyData[st][foundKey] : [];
  };
  const talukasList = getTalukasFor(state, district);

  // When State changes, adjust District and Taluka
  const handleStateChange = (newSt) => {
    setState(newSt);
    const newDistricts = hierarchyData?.[newSt] ? Object.keys(hierarchyData[newSt]) : [];
    const firstDist = newDistricts[0] || '';
    setDistrict(firstDist);
    const newTalukas = getTalukasFor(newSt, firstDist);
    setTaluka(newTalukas[0] || '__ALL__');
  };

  // When District changes, adjust Taluka
  const handleDistrictChange = (newDist) => {
    setDistrict(newDist);
    const newTalukas = getTalukasFor(state, newDist);
    setTaluka(newTalukas[0] || '__ALL__');
  };

  // Fetch villages whenever taluka, district, or state changes
  useEffect(() => {
    const tal = taluka || '__ALL__';
    setIsLoadingVillages(true);
    const queryParams = new URLSearchParams({
      taluka: tal,
      district: district || '',
      state: state || ''
    });
    fetch(`/api/v1/locations/villages?${queryParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        setVillageOptions(data || []);
        if (data && data.length > 0 && !data.includes(village)) {
          setVillage(data[0]);
        }
      })
      .catch(err => {
        console.warn("Could not fetch villages:", err);
      })
      .finally(() => {
        setIsLoadingVillages(false);
      });
  }, [taluka, district, state]);

  // Handle Indian Pincode Auto-Detection
  const handlePincodeLookup = async () => {
    if (!pincode || pincode.length !== 6) {
      setErrorMsg("Please enter a valid 6-digit Indian PIN code.");
      return;
    }
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/locations/pincode/${pincode}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Pincode not found");

      if (data.state) setState(data.state);
      if (data.district) setDistrict(data.district);
      if (data.taluka) setTaluka(data.taluka);
      if (data.village) setVillage(data.village);
      setSuccessMsg(`Pincode resolved: ${data.village}, ${data.taluka}, ${data.district}, ${data.state}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Handle local vehicle photo upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image size exceeds 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setVehiclePhotoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Instant KYC Verification Simulator
  const handleVerifyKyc = async () => {
    setIsVerifyingKyc(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/verify-driver-kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          phone: phone || currentUser?.phone || '9876543210',
          driving_license_no: dlNumber,
          aadhaar_no: aadhaarNumber,
          vehicle_rc_no: rcNumber,
          vehicle_type: vehicleType,
          registered_state: state,
          registered_district: district,
          registered_taluka: taluka
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || (Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail) || "KYC Verification Failed");
        return;
      }
      if (data.kyc_verified) {
        setKycVerified(true);
        setSuccessMsg(`Government MoRTH Parivahan & VAHAN Verification: APPROVED! Certificate: ${data.certificate_id || ''}`);
      } else {
        setErrorMsg(data.message || "KYC Verification Failed");
      }
    } catch (err) {
      setErrorMsg("KYC verification error: " + err.message);
    } finally {
      setIsVerifyingKyc(false);
    }
  };

  // Submit Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      full_name: fullName,
      phone,
      role,
      state,
      district,
      taluka,
      village,
      street_address: streetAddress,
      pincode,
      driving_license_no: role === 'DRIVER' ? dlNumber : null,
      aadhaar_no: role === 'DRIVER' ? aadhaarNumber : null,
      vehicle_rc_no: role === 'DRIVER' ? rcNumber : null,
      vehicle_type: role === 'DRIVER' ? vehicleType : null,
      vehicle_model: role === 'DRIVER' ? vehicleModel : null,
      vehicle_capacity_kg: role === 'DRIVER' ? Number(vehicleCapacityKg) : null,
      vehicle_body_type: role === 'DRIVER' ? vehicleBodyType : null,
      vehicle_photo_url: role === 'DRIVER' ? vehiclePhotoUrl : null
    };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/v1/auth/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not update profile');

      setSuccessMsg("Profile and address hierarchy saved successfully!");
      if (onProfileUpdated) {
        onProfileUpdated(data);
      }
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Top Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 border-b border-slate-800 pb-5">
          <div className="relative group">
            <img
              src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
              alt={fullName}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 p-1 bg-slate-900 rounded-lg border border-slate-700 text-emerald-400">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-bold font-heading text-white">{fullName || 'Transporter Profile'}</h2>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                role === 'DRIVER' 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {role === 'DRIVER' ? 'Commercial Transporter / Driver' : 'Customer / Shipper'}
              </span>
              {role === 'DRIVER' && kycVerified && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>VAHAN KYC Verified</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{email || 'Authenticated User'}</p>
            <p className="text-xs text-slate-500">
              {village}, {taluka}, {district}, {state}
            </p>
          </div>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6 text-xs">
          
          {/* ===================== SECTION 1: PERSONAL INFORMATION ===================== */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-2">
              <User className="w-4 h-4 text-emerald-400" />
              <span>Personal & Account Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Gopal Kale"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Account Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="CUSTOMER">Customer / Shipper (Goods Owner)</option>
                  <option value="DRIVER">Transporter / Commercial Driver</option>
                </select>
              </div>
            </div>
          </div>

          {/* ===================== SECTION 2: ALL-INDIA CASCADING ADDRESS ===================== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>All-India Cascading Address (State → District → Taluka → Village)</span>
              </div>
              <span className="text-[10px] text-slate-500">Government LGD Master Data</span>
            </div>

            {/* Cascading 4 Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. State */}
              <div>
                <label className="block text-slate-400 mb-1">1. State / UT</label>
                <select
                  value={state}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {statesList.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* 2. District */}
              <div>
                <label className="block text-slate-400 mb-1">2. District / City</label>
                <select
                  value={district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {districtsList.map(dist => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
              </div>

              {/* 3. Taluka / Tehsil */}
              <div>
                <label className="block text-slate-400 mb-1">3. Taluka / Tehsil</label>
                <select
                  value={taluka}
                  onChange={(e) => setTaluka(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="__ALL__">-- 🌐 All Talukas / Entire District ({district}) --</option>
                  {talukasList.map(tal => (
                    <option key={tal} value={tal}>{tal}</option>
                  ))}
                </select>
              </div>

              {/* 4. Village / Mandi */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">4. Village / Mandi</label>
                  {isLoadingVillages && <span className="text-[10px] text-emerald-400 animate-pulse">Loading...</span>}
                </div>
                <select
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  {villageOptions.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom village name typing + Pincode Lookup */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 mb-1">Or Type Custom Village / Wadi Name</label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder="e.g. Uruli Kanchan / Kholvad"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">6-Digit PIN Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="e.g. 412201"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handlePincodeLookup}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-xl border border-slate-700 text-[11px] flex-shrink-0 transition"
                  >
                    Auto-Fill
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Street Address / Landmark</label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. Near Kisan Seva Kendra & Mandi Gate"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* ===================== SECTION 3: TRANSPORTER / DRIVER & VEHICLE DETAILS ===================== */}
          {role === 'DRIVER' && (
            <div className="p-4 sm:p-5 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span>Commercial Transporter & Vehicle Documents</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isVerifyingKyc}
                    onClick={handleVerifyKyc}
                    className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isVerifyingKyc ? 'Verifying with VAHAN...' : 'Test Parivahan / VAHAN KYC'}</span>
                  </button>
                </div>
              </div>

              {/* Vehicle Specifications */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-amber-200/80 mb-1">Vehicle Category</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Mahindra Bolero Pickup">Mahindra Bolero Pickup (1.5T - 1.7T)</option>
                    <option value="Tata Ace / Chhota Hathi">Tata Ace / Chhota Hathi (750 kg)</option>
                    <option value="Ashok Leyland Dost">Ashok Leyland Dost (1.25T)</option>
                    <option value="14ft Eicher">14ft Eicher Truck (4T)</option>
                    <option value="17ft Eicher">17ft Eicher Truck (6T)</option>
                    <option value="22ft Multi-Axle">22ft Multi-Axle Truck (10T)</option>
                    <option value="Piaggio Ape / 3-Wheeler">Piaggio Ape / 3-Wheeler Cargo (500 kg)</option>
                    <option value="Tractor Trailer">Tractor Trailer (Farm/Mandi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-amber-200/80 mb-1">Vehicle Model & Make</label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="e.g. Bolero Maxi Truck Plus"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-amber-200/80 mb-1">Payload Capacity (kg)</label>
                  <input
                    type="number"
                    value={vehicleCapacityKg}
                    onChange={(e) => setVehicleCapacityKg(e.target.value)}
                    placeholder="1500"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Government Regulatory Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-amber-200/80 mb-1">Vehicle RC Number</label>
                  <input
                    type="text"
                    required
                    value={rcNumber}
                    onChange={(e) => setRcNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. MH 12 AB 1234"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white uppercase focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-amber-200/80 mb-1">Driving License (DL) No.</label>
                  <input
                    type="text"
                    required
                    value={dlNumber}
                    onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. MH12 20180045678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white uppercase focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-amber-200/80 mb-1">Aadhaar Card No.</label>
                  <input
                    type="text"
                    maxLength={12}
                    required
                    value={aadhaarNumber}
                    onChange={(e) => setAadhaarNumber(e.target.value)}
                    placeholder="12-digit UID"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Vehicle Photo Upload & Live Preview */}
              <div className="space-y-2">
                <label className="block text-amber-200/80 font-medium">Commercial Vehicle Photo</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  {/* Photo Preview Card */}
                  <div className="sm:col-span-1 relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-32 flex items-center justify-center">
                    {vehiclePhotoUrl ? (
                      <>
                        <img 
                          src={vehiclePhotoUrl} 
                          alt="Vehicle" 
                          className="w-full h-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={() => setVehiclePhotoUrl('')}
                          className="absolute top-2 right-2 p-1.5 bg-rose-600/80 text-white rounded-lg hover:bg-rose-500 transition"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-3 text-slate-500 space-y-1">
                        <Truck className="w-6 h-6 mx-auto opacity-50" />
                        <span className="text-[11px]">No vehicle photo</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls & Presets */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-dashed border-slate-700 cursor-pointer transition">
                      <Upload className="w-4 h-4 text-amber-400" />
                      <span>Upload Vehicle Photo from Device</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                      <span>Or pick demo vehicle:</span>
                      <button
                        type="button"
                        onClick={() => setVehiclePhotoUrl('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=600&q=80')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      >
                        Bolero Pickup
                      </button>
                      <button
                        type="button"
                        onClick={() => setVehiclePhotoUrl('https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=600&q=80')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      >
                        Commercial Truck
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Profile...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
