import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Award, FileText, CheckCircle2, AlertCircle, Loader2, X, Truck, UserCheck, MapPin } from 'lucide-react';

export function KycModal({ isOpen, onClose, onVerificationComplete, t }) {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    full_name: "Santosh Dnyaneshwar More",
    phone: "9822998877",
    driving_license_no: "MH1220180054321",
    aadhaar_no: "987654321012",
    vehicle_rc_no: "MH12QW9988",
    vehicle_type: "Mahindra Bolero Pickup",
    registered_state: "Maharashtra",
    registered_district: "Pune",
    registered_taluka: "Haveli"
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/v1/verify-driver-kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        setResult(data);
        if (onVerificationComplete) {
          onVerificationComplete(data);
        }
      } else {
        setError(data.message || "KYC Verification check failed. Please check document numbers.");
      }
    } catch (err) {
      setError("Network or server connection failed. Please ensure the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-white text-lg">{t.kyc_modal_title}</h3>
              <p className="text-xs text-slate-400">{t.kyc_modal_desc}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            /* Successful Verification Badge Card */
            <div className="space-y-4">
              <div className="p-5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/10 animate-pulse">
                  <Award className="w-9 h-9" />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                    Official MoRTH Status: VERIFIED
                  </span>
                  <h4 className="text-xl font-bold text-white mt-2">{result.full_name}</h4>
                  <p className="text-sm text-slate-300">{result.badge_title}</p>
                </div>
                <div className="text-xs font-mono bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/60 inline-block text-slate-400">
                  {t.certificate_id}: <span className="text-emerald-400 font-semibold">{result.certificate_id}</span>
                </div>
              </div>

              {/* Verified Registry Details Grid - Focused on Owner Identity & Vehicle RC */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-semibold text-slate-300">{t.verified_owner_label || "Owner & Driver Identity"}</span>
                  </div>
                  <div className="font-bold text-white truncate">{result.full_name}</div>
                  <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> DL: {result.driving_license_no || formData.driving_license_no}
                  </div>
                </div>

                <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-semibold text-slate-300">{t.verified_rc_label || "Vehicle RC & Plate"}</span>
                  </div>
                  <div className="font-mono font-bold text-amber-300 text-sm tracking-wide">
                    {result.vehicle_rc_no || formData.vehicle_rc_no}
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {formData.vehicle_type}
                  </div>
                </div>

                <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-semibold text-slate-300">{t.verified_rto_label || "RTO Jurisdiction"}</span>
                  </div>
                  <div className="font-semibold text-white truncate">
                    {result.rto_office || "Govt RTO Registered"}
                  </div>
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Active Carrier
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition shadow-lg shadow-emerald-600/30"
              >
                Proceed as Verified Transporter
              </button>
            </div>
          ) : (
            /* KYC Form */
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.full_name}</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. Santosh Dnyaneshwar More"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    placeholder="10-digit mobile"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.vehicle_standard}</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Mahindra Bolero Pickup">Mahindra Bolero Pickup</option>
                    <option value="Tata Ace / Chhota Hathi">Tata Ace / Chhota Hathi</option>
                    <option value="3-Wheeler Auto">3-Wheeler Auto</option>
                    <option value="Open Tractor & Trolley">Open Tractor & Trolley</option>
                    <option value="14ft Eicher">14ft Eicher</option>
                    <option value="Container Truck">Container Truck</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.driving_license_no}</label>
                <input
                  type="text"
                  required
                  value={formData.driving_license_no}
                  onChange={(e) => setFormData({ ...formData, driving_license_no: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. MH1220180054321"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.aadhaar_no}</label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={formData.aadhaar_no}
                    onChange={(e) => setFormData({ ...formData, aadhaar_no: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="12 digit Aadhaar"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.vehicle_rc_no}</label>
                  <input
                    type="text"
                    required
                    value={formData.vehicle_rc_no}
                    onChange={(e) => setFormData({ ...formData, vehicle_rc_no: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. MH12QW9988"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.registered_state}
                    onChange={(e) => setFormData({ ...formData, registered_state: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">District</label>
                  <input
                    type="text"
                    value={formData.registered_district}
                    onChange={(e) => setFormData({ ...formData, registered_district: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Taluka</label>
                  <input
                    type="text"
                    value={formData.registered_taluka}
                    onChange={(e) => setFormData({ ...formData, registered_taluka: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t.verifying_live}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span>{t.verify_submit_btn}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
