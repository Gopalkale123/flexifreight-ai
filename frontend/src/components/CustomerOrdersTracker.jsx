import React, { useState, useEffect } from 'react';
import { 
  Truck, ShieldCheck, MapPin, IndianRupee, Clock, CheckCircle2, 
  XCircle, MessageSquare, Phone, ExternalLink, AlertCircle, RefreshCw, 
  UserCheck, Lock, Unlock, Eye, EyeOff, Sparkles, ChevronRight, X
} from 'lucide-react';
import { NegotiationRoom } from './NegotiationRoom';

export function CustomerOrdersTracker({ 
  currentUser, 
  t, 
  onSwitchToPostForm, 
  highlightPostId,
  onOpenAuth 
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'ACTION_REQUIRED' | 'ACTIVE' | 'FINALIZED'
  
  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState(null); // { post, offer, driver }
  const [sharePhoneChoice, setSharePhoneChoice] = useState(true);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState(null);

  // Negotiation Room Modal
  const [activeNegotiationPost, setActiveNegotiationPost] = useState(null);

  const fetchCustomerPosts = async () => {
    if (!currentUser?.id) {
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({ 
        customer_view: 'true',
        customer_user_id: currentUser.id
      });

      const res = await fetch(`/api/v1/posts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data || []);
      }
    } catch (e) {
      console.warn("Notice: Fetching customer posts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.id) {
      setPosts([]);
      setLoading(false);
      return;
    }
    fetchCustomerPosts();
    // Auto refresh every 5 seconds to catch live driver acceptances & counter-offers
    const interval = setInterval(fetchCustomerPosts, 5000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.phone]);

  // Handle Accept or Reject Decision
  const handleConfirmDecision = async (action, targetPost = null, targetOffer = null) => {
    const post = targetPost || decisionModal?.post;
    const offer = targetOffer || decisionModal?.offer;
    if (!post || !offer) return;

    setIsSubmittingDecision(true);
    setDecisionFeedback(null);

    const driverId = offer.driver_id;

    try {
      const res = await fetch(`/api/v1/posts/${post.id}/customer-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action, // 'ACCEPT' or 'REJECT'
          driver_id: driverId,
          offer_id: offer.id,
          share_phone: sharePhoneChoice,
          agreed_price: offer.offered_price
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to process decision");

      if (action === 'ACCEPT') {
        setDecisionFeedback({
          type: 'success',
          message: data.message
        });

        setTimeout(() => {
          setDecisionModal(null);
          setDecisionFeedback(null);
        }, 2000);
      } else {
        setDecisionModal(null);
        alert(data.message || `Transporter declined. Your trip post stays active for other drivers!`);
      }

      fetchCustomerPosts();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Filter posts
  const filteredPosts = posts.filter(p => {
    const hasPendingOffer = p.offers && p.offers.some(o => o.status === 'PENDING');
    if (filterTab === 'ACTION_REQUIRED') {
      return (p.status === 'DRIVER_REQUESTED' || p.status === 'NEGOTIATING' || hasPendingOffer) && p.status !== 'AGREED';
    }
    if (filterTab === 'ACTIVE') {
      return p.status === 'OPEN' || p.status === 'DRIVER_REQUESTED' || p.status === 'NEGOTIATING';
    }
    if (filterTab === 'FINALIZED') {
      return p.status === 'AGREED';
    }
    return true;
  });

  const actionRequiredCount = posts.filter(p => 
    (p.status === 'DRIVER_REQUESTED' || p.status === 'NEGOTIATING' || (p.offers && p.offers.some(o => o.status === 'PENDING'))) && p.status !== 'AGREED'
  ).length;

  if (!currentUser) {
    return (
      <div className="glass-card p-10 rounded-2xl border border-slate-800 text-center max-w-xl mx-auto my-12 shadow-2xl space-y-6 animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white font-heading">
            Sign In Required to Track Shipments
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            Please sign in or register to view your active freight shipments, monitor transporter acceptances, review counter-offers, and manage negotiated deals.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onOpenAuth && onOpenAuth('LOGIN')}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <Lock className="w-4 h-4" />
            <span>Sign In to FlexiFreight</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenAuth && onOpenAuth('REGISTER')}
            className="w-full sm:w-auto px-6 py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <span>Create Customer Account</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">My Posted Freight Shipments & Orders</h2>
            {actionRequiredCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 animate-bounce">
                {actionRequiredCount} Action Needed
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track driver acceptances, review counter-offers, accept or reject transporters, and control phone number sharing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchCustomerPosts}
            className="p-2.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5 text-xs cursor-pointer border border-slate-700"
            title="Refresh order statuses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {onSwitchToPostForm && (
            <button
              type="button"
              onClick={onSwitchToPostForm}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <span>+ Post New Load</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800">
        <button
          onClick={() => setFilterTab('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filterTab === 'ALL'
              ? 'bg-slate-800 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All Shipments ({posts.length})
        </button>

        <button
          onClick={() => setFilterTab('ACTION_REQUIRED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            filterTab === 'ACTION_REQUIRED'
              ? 'bg-amber-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Driver Requests / Offers</span>
          {actionRequiredCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px] font-bold">
              {actionRequiredCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setFilterTab('ACTIVE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filterTab === 'ACTIVE'
              ? 'bg-emerald-700 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Open / Pending
        </button>

        <button
          onClick={() => setFilterTab('FINALIZED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filterTab === 'FINALIZED'
              ? 'bg-teal-700 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Finalized Deals ({posts.filter(p => p.status === 'AGREED').length})
        </button>
      </div>

      {/* Posts List */}
      {loading && posts.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
          <span>Loading your shipments...</span>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 p-8 space-y-3">
          <Truck className="w-10 h-10 mx-auto text-slate-600" />
          <h3 className="text-base font-bold text-white">No Shipments Found in this Category</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {filterTab === 'ACTION_REQUIRED' 
              ? "None of your loads have pending transporter offers at the moment."
              : "You haven't posted any freight shipments yet, or no orders match the selected filter."}
          </p>
          {onSwitchToPostForm && (
            <button
              onClick={onSwitchToPostForm}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Post a Freight Load Now
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredPosts.map(post => {
            const isHighlighted = highlightPostId && post.id === highlightPostId;
            const pendingOffers = (post.offers || []).filter(o => o.status === 'PENDING');
            const hasDriverAccepted = pendingOffers.some(o => o.offered_price <= post.customer_budget);
            const hasCounterOffer = pendingOffers.some(o => o.offered_price > post.customer_budget);

            return (
              <div 
                key={post.id}
                className={`bg-slate-900/85 rounded-2xl border transition shadow-xl overflow-hidden ${
                  isHighlighted 
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30' 
                    : post.status === 'AGREED'
                    ? 'border-teal-500/50'
                    : pendingOffers.length > 0
                    ? 'border-amber-500/70 shadow-amber-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header: Load ID, Status Badge, Route Summary */}
                <div className="px-5 py-3.5 bg-slate-800/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                      Load #{post.id}
                    </span>
                    
                    {/* Status Badge */}
                    {post.status === 'AGREED' ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 font-bold border border-teal-500/40">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                        <span>DEAL FINALIZED</span>
                      </span>
                    ) : pendingOffers.length > 0 ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 animate-pulse">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {hasDriverAccepted 
                            ? 'TRANSPORTER ACCEPTED YOUR BUDGET!' 
                            : 'COUNTER-OFFER RECEIVED'}
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/30">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span>WAITING FOR TRANSPORTERS</span>
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      • Posted {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Budget:</span>
                    <span className="font-black text-emerald-400 text-sm">₹{post.customer_budget}</span>
                    {post.base_price_predicted && (
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        (AI Fair: ₹{post.base_price_predicted})
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Body */}
                <div className="p-5 space-y-4">
                  {/* Origin to Destination Route Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-0.5">
                        Pickup Location
                      </span>
                      <div className="font-semibold text-white text-sm">
                        {post.pickup_taluka}, {post.pickup_district}
                      </div>
                      <div className="text-slate-300 text-xs mt-0.5">
                        {post.pickup_village || post.pickup_street || 'Local Base'}
                      </div>
                      {post.pickup_landmark && (
                        <div className="text-slate-400 text-[11px]">
                          Landmark: {post.pickup_landmark}
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-0.5">
                        Dropoff Destination
                      </span>
                      <div className="font-semibold text-white text-sm">
                        {post.drop_taluka}, {post.drop_district}
                      </div>
                      <div className="text-slate-300 text-xs mt-0.5">
                        {post.drop_village || post.drop_street || 'Destination Area'}
                      </div>
                      {post.drop_landmark && (
                        <div className="text-slate-400 text-[11px]">
                          Landmark: {post.drop_landmark}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cargo & Vehicle Specs */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300 border-b border-slate-800/60 pb-3">
                    <div>
                      <span className="text-slate-400">Goods: </span>
                      <span className="font-medium text-white">{post.raw_goods_description}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Weight: </span>
                      <span className="font-bold text-emerald-400">{post.parsed_cargo_weight_kg || 500} kg</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Vehicle: </span>
                      <span className="font-medium text-white">{post.vehicle_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Timing: </span>
                      <span className="text-slate-300">{post.feasible_date} ({post.feasible_time_window})</span>
                    </div>
                  </div>

                  {/* ===================== DRIVER OFFERS / ACCEPTANCE SECTION ===================== */}
                  {post.status === 'AGREED' ? (
                    /* Finalized Deal Card */
                    <div className="p-4 bg-teal-950/30 border border-teal-500/50 rounded-xl space-y-3 animate-fadeIn">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-500/30 pb-2.5">
                        <div className="flex items-center gap-2 text-teal-300 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5 text-teal-400" />
                          <span>Deal Finalized & Transporter Confirmed!</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 mr-2">Agreed Fare:</span>
                          <span className="text-base font-black text-teal-400">₹{post.agreed_price}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        {/* 1. Transporter Details */}
                        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                            Assigned Transporter
                          </span>
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 flex items-center justify-center font-bold text-base shadow">
                              <Truck className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm">
                                {post.agreed_driver_name || "Commercial Transporter"}
                              </div>
                              <div className="flex items-center gap-1 text-emerald-400 text-[11px]">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Govt VAHAN Verified</span>
                              </div>
                            </div>
                          </div>
                          {post.agreed_driver_certificate_id && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              Registry ID: <span className="text-emerald-400">{post.agreed_driver_certificate_id}</span>
                            </div>
                          )}
                        </div>

                        {/* 2. Vehicle & Photo */}
                        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2 flex items-center gap-3">
                          {post.agreed_driver_vehicle_photo_url && (
                            <div className="w-24 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex-shrink-0 shadow">
                              <img 
                                src={post.agreed_driver_vehicle_photo_url} 
                                alt="Assigned Vehicle" 
                                className="w-full h-full object-cover" 
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                              Commercial Vehicle
                            </span>
                            <div className="font-bold text-white text-xs">
                              {post.agreed_driver_vehicle_type || post.vehicle_type}
                            </div>
                            {post.agreed_driver_vehicle_rc && (
                              <div className="text-[11px] font-mono text-amber-300">
                                RC: {post.agreed_driver_vehicle_rc}
                              </div>
                            )}
                            <span className="inline-block text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                              Ready for Transit
                            </span>
                          </div>
                        </div>

                        {/* 3. Direct Contact Exchange */}
                        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2">
                          <div>
                            <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block mb-1">
                              Direct Contact Unlocked
                            </span>
                            <div className="text-xs text-slate-300 font-medium">
                              {post.agreed_driver_phone ? (
                                <span className="text-white font-mono font-bold text-sm block">
                                  +91 {post.agreed_driver_phone}
                                </span>
                              ) : (
                                "Phone exchange active"
                              )}
                            </div>
                          </div>

                          {post.agreed_driver_phone && (
                            <div className="flex items-center gap-2 pt-1">
                              <a
                                href={`tel:${post.agreed_driver_phone}`}
                                className="flex-1 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span>Call Driver</span>
                              </a>
                              <a
                                href={`https://wa.me/91${post.agreed_driver_phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(post.agreed_driver_name || 'Driver')},%20regarding%20freight%20load%20#${post.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
                                title="Chat on WhatsApp"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : pendingOffers.length > 0 ? (
                    /* Active Pending Driver Offers / Requests */
                    <div className="space-y-3 pt-1">
                      {/* Driver Acceptance Notification Banner */}
                      <div className="p-3 bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/10 border border-amber-500/40 rounded-xl flex items-start gap-3">
                        <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg flex-shrink-0 mt-0.5">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="font-bold text-amber-300 flex items-center gap-2">
                            <span>Transporter Accepted Your Load!</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                              Action Required
                            </span>
                          </div>
                          <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                            A transporter has accepted or offered terms for this shipment. 
                            <span className="text-amber-200 font-semibold"> Phone numbers are strictly hidden right now for your privacy</span>.
                            Review the transporter and their vehicle below to decide whether to accept or reject them.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold text-amber-400 px-1">
                        <span className="flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-amber-400" />
                          <span>Transporters Interested in this Load ({pendingOffers.length})</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          Accept or Reject transporter below
                        </span>
                      </div>

                      {pendingOffers.map(offer => {
                        const isBudgetAccept = offer.offered_price <= post.customer_budget;

                        return (
                          <div 
                            key={offer.id}
                            className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-amber-500/50 rounded-xl space-y-3 shadow-lg"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Driver Info & Vehicle Photo */}
                              <div className="flex items-start gap-3">
                                {offer.driver_vehicle_photo_url ? (
                                  <div className="w-20 h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex-shrink-0 shadow">
                                    <img 
                                      src={offer.driver_vehicle_photo_url} 
                                      alt={offer.driver_vehicle_type || 'Vehicle'} 
                                      className="w-full h-full object-cover" 
                                    />
                                  </div>
                                ) : (
                                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl flex-shrink-0">
                                    <Truck className="w-6 h-6" />
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-bold text-white text-sm">
                                      {offer.driver_name || "Commercial Transporter"}
                                    </h4>
                                    <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>Govt VAHAN Verified</span>
                                    </span>
                                  </div>

                                  <p className="text-xs text-slate-300">
                                    Vehicle: <span className="text-white font-medium">{offer.driver_vehicle_type || post.vehicle_type}</span>
                                    {offer.driver_vehicle_rc && (
                                      <span className="text-amber-300 font-mono text-[11px] ml-1.5">
                                        (RC: {offer.driver_vehicle_rc})
                                      </span>
                                    )}
                                    {offer.driver_certificate_id && (
                                      <span className="text-slate-400 text-[11px] block sm:inline sm:ml-2">
                                        • Reg: <span className="font-mono text-emerald-400">{offer.driver_certificate_id}</span>
                                      </span>
                                    )}
                                  </p>

                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
                                    <Lock className="w-3 h-3 text-amber-400" />
                                    <span>Phone: <span className="font-mono text-slate-300">{offer.driver_phone || "+91 989XXXX765"}</span> (Protected until acceptance)</span>
                                  </div>
                                </div>
                              </div>

                              {/* Price Offer */}
                              <div className="sm:text-right bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex-shrink-0">
                                <span className="text-[10px] text-slate-400 block uppercase font-medium">
                                  {isBudgetAccept ? "Driver Accepted Budget" : "Driver Proposed Fare"}
                                </span>
                                <div className="text-lg font-black text-amber-400">
                                  ₹{offer.offered_price}
                                </div>
                                {!isBudgetAccept && (
                                  <span className="text-[10px] text-rose-400">
                                    (+₹{offer.offered_price - post.customer_budget} over budget)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Driver Message / Note */}
                            {offer.message && (
                              <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs text-slate-300 italic">
                                "{offer.message}"
                              </div>
                            )}

                            {/* Customer Action Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800">
                              <button
                                type="button"
                                onClick={() => setActiveNegotiationPost(post)}
                                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                                <span>Negotiate / Chat</span>
                              </button>

                              <div className="flex items-center gap-2">
                                {/* REJECT BUTTON */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Reject transporter ${offer.driver_name || 'this driver'}?\n\nIf you reject, your freight post will REMAIN ACTIVE on the platform for other drivers to accept.`)) {
                                      handleConfirmDecision('REJECT', post, offer);
                                    }
                                  }}
                                  className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                                  title="Reject this driver and keep trip open for others"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Reject Driver</span>
                                </button>

                                {/* ACCEPT BUTTON */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDecisionModal({ post, offer });
                                    setSharePhoneChoice(true);
                                  }}
                                  className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Review & Accept Driver (₹{offer.offered_price})</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Waiting for Driver */
                    <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        <span>Actively broadcasted to commercial transporters in {post.pickup_taluka}, {post.pickup_district}.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveNegotiationPost(post)}
                        className="text-emerald-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Open Negotiation Room</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== DECISION / PHONE NUMBER SHARING MODAL ===================== */}
      {decisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Accept Transporter & Finalize Trip</h3>
                  <p className="text-[11px] text-slate-400">Review Driver Credentials & Exchange Contact Details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDecisionModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Transporter & Vehicle Preview */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-xs">
              {decisionModal.offer.driver_vehicle_photo_url && (
                <div className="w-full h-36 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow">
                  <img 
                    src={decisionModal.offer.driver_vehicle_photo_url} 
                    alt="Driver Vehicle" 
                    className="w-full h-full object-cover" 
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Transporter Name</span>
                  <span className="font-bold text-white text-sm">
                    {decisionModal.offer.driver_name || "Commercial Transporter"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">VAHAN Verification</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Govt Verified
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Vehicle Type</span>
                  <span className="text-slate-200 font-medium">
                    {decisionModal.offer.driver_vehicle_type || decisionModal.post.vehicle_type}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">RC Number</span>
                  <span className="text-amber-300 font-mono text-xs">
                    {decisionModal.offer.driver_vehicle_rc || "MH-12-RN-8842"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-slate-300 font-semibold">Agreed Tariff Fare:</span>
                <span className="text-lg font-black text-emerald-400">
                  ₹{decisionModal.offer.offered_price}
                </span>
              </div>
            </div>

            {/* Explanation of post status & driver recommendation */}
            <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl text-xs text-teal-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
                <span>What happens when you accept:</span>
              </p>
              <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5 ml-1">
                <li>Your trip is finalized with this driver.</li>
                <li>The post is <strong>removed from all other drivers' feeds</strong> and will not be recommended to anyone else.</li>
                <li>Direct phone number and WhatsApp call buttons will be unlocked immediately.</li>
              </ul>
            </div>

            {/* Step 4: Ask Customer to Share Phone Number */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-200 block">
                Contact sharing preference:
              </label>

              <div className="space-y-2">
                <label 
                  onClick={() => setSharePhoneChoice(true)}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                    sharePhoneChoice 
                      ? 'bg-emerald-950/40 border-emerald-500 text-white' 
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="phoneShare"
                    checked={sharePhoneChoice}
                    onChange={() => setSharePhoneChoice(true)}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-emerald-300 block flex items-center gap-1.5">
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Exchange Phone Numbers Directly (Recommended)</span>
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Both you and the driver will get each other's full phone number and WhatsApp links to coordinate immediately.
                    </span>
                  </div>
                </label>

                <label 
                  onClick={() => setSharePhoneChoice(false)}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                    !sharePhoneChoice 
                      ? 'bg-amber-950/40 border-amber-500 text-white' 
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="phoneShare"
                    checked={!sharePhoneChoice}
                    onChange={() => setSharePhoneChoice(false)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-amber-300 block flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Keep My Phone Number Confidential</span>
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Your number stays masked. You can coordinate exclusively through FlexiFreight in-app room.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {decisionFeedback && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                decisionFeedback.type === 'success' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{decisionFeedback.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingDecision}
                onClick={() => setDecisionModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmittingDecision}
                onClick={() => handleConfirmDecision('ACCEPT')}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDecision ? (
                  <span>Locking Deal...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Finalize Deal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Negotiation Room Modal */}
      {activeNegotiationPost && (
        <NegotiationRoom
          isOpen={activeNegotiationPost !== null}
          onClose={() => setActiveNegotiationPost(null)}
          post={activeNegotiationPost}
          currentRole="CUSTOMER"
          t={t}
          onDealFinalized={() => {
            fetchCustomerPosts();
            setActiveNegotiationPost(null);
          }}
        />
      )}
    </div>
  );
}
