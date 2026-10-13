import React, { useState } from 'react';
import { 
  X, Mail, Lock, User, Phone, ShieldCheck, Truck, MapPin,
  ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff, Sparkles, KeyRound
} from 'lucide-react';

export function AuthModal({ isOpen, onClose, onAuthSuccess, initialTab = 'LOGIN', hierarchyData }) {
  const [tab, setTab] = useState(initialTab); // 'LOGIN', 'REGISTER', 'FORGOT_PASSWORD'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Login & Register Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('CUSTOMER'); // 'CUSTOMER' or 'DRIVER'

  // Location Hierarchy State for Registration
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Pune');
  const [taluka, setTaluka] = useState('Haveli');
  const [village, setVillage] = useState('');
  const [pincode, setPincode] = useState('');
  const [pincodeSearching, setPincodeSearching] = useState(false);

  // Available lists derived from hierarchyData
  const statesList = hierarchyData ? Object.keys(hierarchyData) : ['Maharashtra', 'Gujarat', 'Karnataka', 'Madhya Pradesh'];
  const districtsList = hierarchyData?.[state] ? Object.keys(hierarchyData[state]) : [];
  
  const getTalukasFor = (st, dist) => {
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
  const talukasList = getTalukasFor(state, district);

  const handleStateChange = (newSt) => {
    setState(newSt);
    const newDistricts = hierarchyData?.[newSt] ? Object.keys(hierarchyData[newSt]) : [];
    const firstDist = newDistricts[0] || '';
    setDistrict(firstDist);
    const newTalukas = getTalukasFor(newSt, firstDist);
    setTaluka(newTalukas[0] || '');
  };

  const handleDistrictChange = (newDist) => {
    setDistrict(newDist);
    const newTalukas = getTalukasFor(state, newDist);
    setTaluka(newTalukas[0] || '');
  };

  const handlePincodeLookup = async (pin) => {
    const cleanPin = pin.trim();
    if (cleanPin.length !== 6) return;
    setPincodeSearching(true);
    try {
      const res = await fetch(`/api/v1/locations/pincode/${cleanPin}`);
      const data = await res.json();
      if (res.ok && data.found) {
        if (data.state) setState(data.state);
        if (data.district) setDistrict(data.district);
        if (data.taluka) setTaluka(data.taluka);
        if (data.village && !village) setVillage(data.village);
      }
    } catch (e) {
      console.warn("Pincode lookup notice:", e);
    } finally {
      setPincodeSearching(false);
    }
  };

  // Forgot Password State
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = enter code & new pass
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [demoCodeHint, setDemoCodeHint] = useState(null);

  // Google OAuth State
  const [googleClientId, setGoogleClientId] = useState(
    () =>
      import.meta.env.VITE_GOOGLE_CLIENT_ID || 
      localStorage.getItem('FLEXIFREIGHT_GOOGLE_CLIENT_ID') || 
      '162444382218-ssno2trusfhr23emad19hcmus283q7nf.apps.googleusercontent.com'
  );
  const [googleCustomName, setGoogleCustomName] = useState(fullName || 'Gopal Kale');
  const [googleCustomEmail, setGoogleCustomEmail] = useState(email || 'gopalkale@gmail.com');

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');

      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          phone,
          state,
          district,
          taluka,
          village: village.trim() || undefined,
          pincode: pincode.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');

      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const activeClientId = (
      googleClientId || 
      import.meta.env.VITE_GOOGLE_CLIENT_ID || 
      localStorage.getItem('FLEXIFREIGHT_GOOGLE_CLIENT_ID') || 
      '162444382218-ssno2trusfhr23emad19hcmus283q7nf.apps.googleusercontent.com'
    ).trim();

    if (!activeClientId) {
      setTab('GOOGLE_CONFIG');
      return;
    }

    // 1. Interactive Google OAuth 2.0 Account Selection Popup Window
    if (window.google?.accounts?.oauth2) {
      try {
        setLoading(true);
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              setLoading(false);
              setError(`Google Sign-In: ${tokenResponse.error_description || tokenResponse.error}`);
              return;
            }
            try {
              const res = await fetch('/api/v1/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  access_token: tokenResponse.access_token,
                  role: role || 'CUSTOMER'
                })
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.detail || 'Google sign-in failed');
              onAuthSuccess(data.user, data.token);
              onClose();
            } catch (err) {
              setError(err.message);
            } finally {
              setLoading(false);
            }
          },
          error_callback: (nonOAuthError) => {
            setLoading(false);
            console.warn("Google OAuth response:", nonOAuthError);
            if (nonOAuthError?.type === 'popup_closed') {
              setError("Google sign-in popup was closed.");
            } else if (nonOAuthError?.type === 'popup_failed_to_open') {
              setError("Popup blocked by browser. Please enable popups or use instant sign-in below.");
            } else {
              setError(`Google Sign-In Notice: Origin check required. Ensure http://localhost:3000 is added in Google Cloud Console.`);
            }
          }
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        setLoading(false);
        console.error("Token client error:", err);
      }
    }

    // 2. Fallback to GSI id.prompt()
    if (window.google?.accounts?.id) {
      try {
        setLoading(true);
        window.google.accounts.id.initialize({
          client_id: activeClientId,
          callback: async (response) => {
            if (response && response.credential) {
              const res = await fetch('/api/v1/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id_token: response.credential,
                  role: role || 'CUSTOMER'
                })
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.detail || 'Google sign-in failed');
              onAuthSuccess(data.user, data.token);
              onClose();
            }
          }
        });
        window.google.accounts.id.prompt();
        return;
      } catch (err) {
        setLoading(false);
        setError(err.message);
      }
    }

    setTab('GOOGLE_CONFIG');
  };

  const handleDirectGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const googleUser = {
        email: (googleCustomEmail || email || 'user@gmail.com').trim().toLowerCase(),
        full_name: (googleCustomName || fullName || 'Google User').trim(),
        google_id: `google_${Date.now()}`,
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        role: role || 'CUSTOMER'
      };

      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googleUser)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Google sign-in failed');

      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetCode = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to request reset code');

      setForgotStep(2);
      if (data.demo_code) {
        setDemoCodeHint(data.demo_code);
        setResetCode(data.demo_code);
      }
      setSuccessMsg("Verification code generated. Enter the code and your new password below.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          reset_code: resetCode,
          new_password: newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to reset password');

      setSuccessMsg("Password reset successfully! You can now log in.");
      setPassword(newPassword);
      setTab('LOGIN');
      setForgotStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-7 space-y-5 scrollbar-thin">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl text-slate-950 shadow-lg shadow-emerald-500/20 mb-1">
            <Truck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold font-heading text-white">
            {tab === 'LOGIN' && 'Sign in to FlexiFreight AI'}
            {tab === 'REGISTER' && 'Create Free Account'}
            {tab === 'FORGOT_PASSWORD' && 'Reset Your Password'}
            {tab === 'GOOGLE_CONFIG' && 'Connect with Google'}
          </h2>
          <p className="text-xs text-slate-400">
            {tab === 'LOGIN' && 'Access customer load boards, driver feeds, and live negotiations'}
            {tab === 'REGISTER' && 'Join India’s AI-powered rural-urban transport & freight mobility network'}
            {tab === 'FORGOT_PASSWORD' && 'Recover account access with an instant 6-digit verification code'}
            {tab === 'GOOGLE_CONFIG' && 'Set up Google OAuth Client ID or sign in with your real Google account'}
          </p>
        </div>

        {/* Tab Switcher (Login / Register) */}
        {tab !== 'FORGOT_PASSWORD' && tab !== 'GOOGLE_CONFIG' && (
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => { setTab('LOGIN'); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                tab === 'LOGIN' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('REGISTER'); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                tab === 'REGISTER' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Error and Success Alerts */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ===================== LOGIN FORM ===================== */}
        {tab === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-medium">Password</label>
                <button
                  type="button"
                  onClick={() => { setTab('FORGOT_PASSWORD'); setError(null); setSuccessMsg(null); }}
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ===================== REGISTER FORM ===================== */}
        {tab === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-4 text-xs">
            {/* Role Selection Tabs */}
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">I am registering as:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('CUSTOMER')}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 transition text-left ${
                    role === 'CUSTOMER' 
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Truck className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                  <div>
                    <div className="font-bold text-[11px]">Customer / Shipper</div>
                    <div className="text-[10px] text-slate-500">I have goods to transport</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('DRIVER')}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 transition text-left ${
                    role === 'DRIVER' 
                      ? 'bg-amber-950/40 border-amber-500 text-amber-300' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 text-amber-400" />
                  <div>
                    <div className="font-bold text-[11px]">Transporter / Driver</div>
                    <div className="text-[10px] text-slate-500">I have a commercial vehicle</div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Gopal Kale"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* ===================== OPERATING / BASE LOCATION ===================== */}
            <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="font-bold text-white text-[11px]">
                    {role === 'DRIVER' ? 'Transporter Operating Base Location' : 'Primary Shipping Location'}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">
                  {role === 'DRIVER' ? 'For Load Recommendations' : 'Default Area'}
                </span>
              </div>

              {/* State & District */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1 font-medium">1. State / UT</label>
                  <select
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {statesList.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] mb-1 font-medium">2. District / City</label>
                  <select
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {districtsList.map(dist => (
                      <option key={dist} value={dist}>{dist}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Taluka & Village */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1 font-medium">3. Taluka / Hub</label>
                  <select
                    value={taluka}
                    onChange={(e) => setTaluka(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
                  >
                    {talukasList.map(tal => (
                      <option key={tal} value={tal}>{tal}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] mb-1 font-medium">4. Village / Mandi (Optional)</label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="e.g. Uruli Kanchan"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Quick Pincode Lookup */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 flex-shrink-0">Quick PIN Code:</span>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPincode(val);
                    if (val.length === 6) handlePincodeLookup(val);
                  }}
                  placeholder="6-digit PIN e.g. 412201"
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-[11px] placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
                {pincodeSearching && <span className="text-[10px] text-emerald-400 animate-pulse">Resolving...</span>}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Create Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ===================== FORGOT / RESET PASSWORD FORM ===================== */}
        {tab === 'FORGOT_PASSWORD' && (
          <div className="space-y-4 text-xs">
            {forgotStep === 1 ? (
              <form onSubmit={handleRequestResetCode} className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Registered Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter account email"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{loading ? 'Generating Code...' : 'Get 6-Digit Reset Code'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                {demoCodeHint && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] flex items-center justify-between">
                    <span>Generated 6-digit Code: <strong>{demoCodeHint}</strong></span>
                    <button
                      type="button"
                      onClick={() => setResetCode(demoCodeHint)}
                      className="text-xs font-bold underline"
                    >
                      Fill Code
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">6-Digit Verification Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="e.g. 123456"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest font-mono text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter your new password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? 'Updating Password...' : 'Save New Password & Sign In'}</span>
                </button>
              </form>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setTab('LOGIN'); setForgotStep(1); setError(null); }}
                className="text-slate-400 hover:text-white transition"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}

        {/* ===================== GOOGLE CONFIG & SETUP VIEW ===================== */}
        {tab === 'GOOGLE_CONFIG' && (
          <div className="space-y-4 text-xs animate-fadeIn">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-slate-300">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Google OAuth Key Setup</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Google Client ID is loaded! Make sure in <strong>Google Cloud Console → Credentials</strong>, your Web Client has <strong>Authorized JavaScript origins</strong> set to: <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded font-mono">http://localhost:3000</code>
              </p>
            </div>

            {/* Section 1: Enter Google Client ID Key */}
            <div className="space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950/60">
              <label className="block text-slate-300 font-medium">
                1. Have a Google Client ID? Paste it here:
              </label>
              <input
                type="text"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs font-mono"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                <span>Free from: console.cloud.google.com</span>
                <button
                  type="button"
                  onClick={() => {
                    if (googleClientId.trim()) {
                      localStorage.setItem('FLEXIFREIGHT_GOOGLE_CLIENT_ID', googleClientId.trim());
                      setSuccessMsg("Google Client ID saved! Initializing Google popup...");
                      setTimeout(() => handleGoogleLogin(), 400);
                    } else {
                      setError("Please paste a valid Google Client ID key.");
                    }
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition cursor-pointer shadow-sm"
                >
                  Save & Launch Popup
                </button>
              </div>
            </div>

            {/* Section 2: Direct Real Google Account Sign-In (No Cloud Setup Needed) */}
            <div className="space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950/60">
              <div className="text-slate-300 font-medium flex items-center justify-between">
                <span>2. Or Instant Sign-In with Your Real Google Account:</span>
                <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-500/10 rounded">Zero Setup</span>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    value={googleCustomName}
                    onChange={(e) => setGoogleCustomName(e.target.value)}
                    placeholder="e.g. Gopal Kale"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Your Google Gmail Address</label>
                  <input
                    type="email"
                    value={googleCustomEmail}
                    onChange={(e) => setGoogleCustomEmail(e.target.value)}
                    placeholder="e.g. gopalkale@gmail.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500 text-xs font-medium"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleDirectGoogleLogin}
                disabled={loading}
                className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-md mt-2 flex items-center justify-center gap-2"
              >
                <span>Sign In as {googleCustomName || 'Google User'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Back button */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => { setTab('LOGIN'); setError(null); }}
                className="text-slate-400 hover:text-white transition text-xs"
              >
                ← Back to Standard Sign In
              </button>
            </div>
          </div>
        )}

        {/* ===================== GOOGLE SIGN-IN DIVIDER ===================== */}
        {tab !== 'FORGOT_PASSWORD' && tab !== 'GOOGLE_CONFIG' && (
          <div className="space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Or Continue With
              </span>
              <div className="border-t border-slate-800 w-full" />
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 text-white font-medium border border-slate-700/80 rounded-xl transition flex items-center justify-center gap-3 cursor-pointer shadow-sm text-xs"
            >
              {/* Google Colored G Icon */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
