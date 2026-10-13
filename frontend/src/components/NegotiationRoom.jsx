import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Mic, MicOff, Send, CheckCircle2, Phone, 
  ExternalLink, X, ShieldCheck, Clock, ArrowRight, UserCheck, AlertTriangle 
} from 'lucide-react';

export function NegotiationRoom({ isOpen, onClose, post, currentRole, driverProfile, onDealFinalized, t }) {
  if (!isOpen || !post) return null;

  const [offers, setOffers] = useState([]);
  const [counterPrice, setCounterPrice] = useState(post.customer_budget || 1500);
  const [chatMessage, setChatMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNoteText, setVoiceNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agreedDealData, setAgreedDealData] = useState(null);
  const [error, setError] = useState(null);

  // Load latest offers
  const fetchOffers = async () => {
    try {
      const res = await fetch(`/api/v1/posts/${post.id}`);
      const data = await res.json();
      setOffers(data.offers || []);
      if (data.status === "AGREED") {
        const custPhoneClean = (data.customer_phone || "").replace(/\D/g, '');
        const driverPhoneClean = (data.agreed_driver_phone || "").replace(/\D/g, '');
        setAgreedDealData({
          customer: { 
            name: data.customer_name, 
            phone: data.customer_phone,
            whatsapp_link: custPhoneClean ? `https://wa.me/91${custPhoneClean.slice(-10)}?text=Hello%20${encodeURIComponent(data.customer_name || 'Customer')},%20deal%20finalized%20on%20FlexiFreight%20AI%20for%20load%20#${data.id}` : null
          },
          driver: { 
            name: data.agreed_driver_name || "Assigned Transporter", 
            phone: data.agreed_driver_phone || "Contact Transporter",
            whatsapp_link: driverPhoneClean ? `https://wa.me/91${driverPhoneClean.slice(-10)}?text=Hello,%20deal%20finalized%20on%20FlexiFreight%20AI%20for%20load%20#${data.id}` : null
          },
          agreed_fare: data.agreed_price
        });
      }
    } catch (e) {
      console.error("Error fetching negotiation offers", e);
    }
  };

  useEffect(() => {
    fetchOffers();
    const interval = setInterval(fetchOffers, 4000);
    return () => clearInterval(interval);
  }, [post.id]);

  // Web Speech API for Voice Dictation
  const startVoiceDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Web Speech API is not supported in this browser. Please type your message.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN'; // Multi-lingual recognition
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceNoteText(transcript);
      if (!chatMessage) {
        setChatMessage(transcript);
      }
      setIsRecording(false);
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleSendOffer = async (e) => {
    e.preventDefault();
    if (!counterPrice || counterPrice <= 0) return;
    setSubmitting(true);
    setError(null);

    const driverId = currentRole === "DRIVER" ? (driverProfile?.id || 1) : 1;

    try {
      const res = await fetch(`/api/v1/posts/${post.id}/negotiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverId,
          sender_role: currentRole === "DRIVER" ? "DRIVER" : "CUSTOMER",
          offered_price: parseFloat(counterPrice),
          message: chatMessage || (currentRole === "DRIVER" ? "Proposing fair market rate for this route." : "Can you do this price?"),
          audio_note_text: voiceNoteText || null
        })
      });

      if (!res.ok) throw new Error("Could not submit counter-offer");

      setChatMessage("");
      setVoiceNoteText("");
      fetchOffers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptDeal = async (offerId) => {
    try {
      const res = await fetch(`/api/v1/negotiations/${offerId}/accept`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setAgreedDealData(data);
        if (onDealFinalized) onDealFinalized(data);
      }
    } catch (err) {
      setError("Failed to finalize deal.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-white text-lg">{t.negotiation_room}</h3>
              <p className="text-xs text-slate-400">
                Load #{post.id}: {post.pickup_taluka} → {post.drop_taluka} ({post.vehicle_type})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* DEAL FINALIZED CELEBRATION & DIRECT CONTACT EXCHANGER */}
          {agreedDealData ? (
            <div className="p-5 bg-gradient-to-b from-emerald-950/60 to-slate-900 border border-emerald-500/50 rounded-2xl space-y-4">
              <div className="text-center space-y-1">
                <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-white mt-2">{t.deal_agreed_title}</h4>
                <p className="text-xs text-slate-300">{t.deal_agreed_subtitle}</p>
                <div className="text-2xl font-black text-emerald-400 mt-2">
                  ₹{agreedDealData.agreed_fare || post.agreed_price}
                </div>
              </div>

              {/* Direct Unmasked Contact Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm">
                {/* Shipper Details */}
                <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">{t.customer_contact}</span>
                  <div className="font-bold text-white">{agreedDealData.customer?.name}</div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${agreedDealData.customer?.phone}`}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{t.call_now} ({agreedDealData.customer?.phone})</span>
                    </a>
                  </div>
                  {agreedDealData.customer?.whatsapp_link && (
                    <a
                      href={agreedDealData.customer.whatsapp_link}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-1.5 px-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-900/60 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{t.whatsapp_chat}</span>
                    </a>
                  )}
                </div>

                {/* Transporter Details */}
                <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">{t.driver_contact}</span>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>{agreedDealData.driver?.name}</span>
                    {agreedDealData.driver?.kyc_verified && (
                      <ShieldCheck className="w-4 h-4 text-emerald-400" title="Govt Verified" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${agreedDealData.driver?.phone}`}
                      className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{t.call_now} ({agreedDealData.driver?.phone})</span>
                    </a>
                  </div>
                  {agreedDealData.driver?.whatsapp_link && (
                    <a
                      href={agreedDealData.driver.whatsapp_link}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-1.5 px-3 bg-amber-950/60 border border-amber-500/40 text-amber-300 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 hover:bg-amber-900/60 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{t.whatsapp_chat}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE NEGOTIATION THREAD */
            <div className="space-y-4">
              {/* Trip Reference Snapshot */}
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Customer Initial Budget:</span>
                  <span className="ml-1.5 font-bold text-white">₹{post.customer_budget}</span>
                </div>
                <div>
                  <span className="text-slate-400">XGBoost Fair Baseline:</span>
                  <span className="ml-1.5 font-bold text-emerald-400">₹{post.base_price_predicted || "Calculating"}</span>
                </div>
                <div>
                  <span className="text-slate-400">Distance:</span>
                  <span className="ml-1.5 font-bold text-slate-200">{post.estimated_distance_km} km</span>
                </div>
              </div>

              {/* Offer Messages List */}
              <div className="space-y-3 min-h-[140px]">
                {offers.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No counter-offers submitted yet. Propose your rate or terms below!
                  </div>
                ) : (
                  offers.map((off) => {
                    const isDriver = off.sender_role === "DRIVER";
                    return (
                      <div 
                        key={off.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                          isDriver 
                            ? 'bg-amber-950/20 border-amber-500/30 ml-4' 
                            : 'bg-emerald-950/20 border-emerald-500/30 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                            <span>{isDriver ? (off.driver_name || "Transporter") : "Shipper / Customer"}</span>
                            {isDriver && off.driver_kyc_verified && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                                KYC Verified
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-white">
                            Proposed: <span className="text-emerald-400">₹{off.offered_price}</span>
                          </span>
                        </div>

                        {off.message && (
                          <p className="text-slate-300 text-xs italic">"{off.message}"</p>
                        )}

                        {off.audio_note_text && (
                          <div className="p-2 bg-slate-900/70 border border-slate-700/60 rounded-lg flex items-center gap-2 text-[11px] text-amber-300">
                            <Mic className="w-3.5 h-3.5 text-amber-400" />
                            <span>Voice Note: "{off.audio_note_text}"</span>
                          </div>
                        )}

                        {/* Accept Button for opposite role */}
                        {off.status === "PENDING" && (
                          <div className="pt-2 flex justify-end">
                            <button
                              onClick={() => handleAcceptDeal(off.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow text-xs flex items-center gap-1 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{t.accept_current_offer} (₹{off.offered_price})</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Negotiation Input Footer (Only visible if not finalized) */}
        {!agreedDealData && (
          <form onSubmit={handleSendOffer} className="p-4 border-t border-slate-800 bg-slate-900/90 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  required
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  placeholder={t.counter_price_label}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Web Speech API Voice Note Dictation Button */}
              <button
                type="button"
                onClick={startVoiceDictation}
                title={t.voice_note}
                className={`p-2.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-medium ${
                  isRecording 
                    ? 'bg-rose-600 border-rose-500 text-white animate-pulse' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-amber-400" />}
                <span className="hidden sm:inline">{isRecording ? "Listening..." : "Voice Note"}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder={t.message_placeholder}
                className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t.send_counter}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
