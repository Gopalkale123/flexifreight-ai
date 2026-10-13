import React, { useState, useEffect } from 'react';
import { 
  Truck, ShieldCheck, Globe, Cpu, RefreshCw, 
  MapPin, CheckCircle2, MessageSquare, Sparkles, AlertCircle,
  User, LogIn, LogOut, KeyRound, ChevronDown, ClipboardList,
  PackagePlus, Bell, PackageCheck
} from 'lucide-react';
import { CustomerPortal } from './components/CustomerPortal';
import { DriverFeed } from './components/DriverFeed';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { translations } from './i18n/translations';

export default function App() {
  const [lang, setLang] = useState('en');
  const [role, setRole] = useState('CUSTOMER'); // 'CUSTOMER' or 'DRIVER'
  const [customerViewMode, setCustomerViewMode] = useState('POST'); // 'POST' or 'MY_ORDERS'
  const [customerStats, setCustomerStats] = useState({ total: 0, actions: 0 });
  const [hierarchyData, setHierarchyData] = useState(null);
  const [isRetraining, setIsRetraining] = useState(false);
  const [retrainResult, setRetrainResult] = useState(null);
  const [serverOnline, setServerOnline] = useState(true);
  const [targetPost, setTargetPost] = useState(null);

  // Authentication & Profile State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('flexifreight_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authToken, setAuthToken] = useState(() => {
    try {
      return localStorage.getItem('flexifreight_token') || null;
    } catch {
      return null;
    }
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('LOGIN');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const t = translations[lang] || translations.en;

  // Fetch location hierarchy from backend
  useEffect(() => {
    fetch('/api/v1/locations/hierarchy')
      .then(res => {
        if (!res.ok) throw new Error("Backend offline");
        return res.json();
      })
      .then(data => {
        setHierarchyData(data);
        setServerOnline(true);
      })
      .catch(err => {
        console.warn("Notice: Location hierarchy loaded with built-in master:", err);
        setServerOnline(false);
      });
  }, []);

  // When user role changes or currentUser changes, sync role tab
  useEffect(() => {
    if (currentUser?.role) {
      setRole(currentUser.role);
    }
  }, [currentUser]);

  // Periodically fetch customer loads count and pending driver acceptance requests
  const fetchCustomerStats = async () => {
    // If not signed in, reset to 0 and do not fetch!
    if (!currentUser?.id) {
      setCustomerStats({ total: 0, actions: 0 });
      return;
    }

    try {
      const params = new URLSearchParams({ 
        customer_view: 'true', 
        customer_user_id: currentUser.id 
      });

      const res = await fetch(`/api/v1/posts?${params.toString()}`);
      if (res.ok) {
        const posts = await res.json();
        if (Array.isArray(posts)) {
          const actions = posts.filter(p => 
            (p.status === 'DRIVER_REQUESTED' || (p.offers && p.offers.some(o => o.status === 'PENDING'))) && p.status !== 'AGREED'
          ).length;
          setCustomerStats({ total: posts.length, actions });
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchCustomerStats();
    const interval = setInterval(fetchCustomerStats, 5000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.phone]);

  // Auth Handlers
  const handleAuthSuccess = (user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
    try {
      localStorage.setItem('flexifreight_user', JSON.stringify(user));
      localStorage.setItem('flexifreight_token', token);
    } catch (e) {
      console.warn("LocalStorage save error:", e);
    }
    if (user.role) {
      setRole(user.role);
    }
  };

  const handleProfileUpdated = (updatedUser) => {
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('flexifreight_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.warn("LocalStorage save error:", e);
    }
    if (updatedUser.role) {
      setRole(updatedUser.role);
    }
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setAuthToken(null);
    setCustomerStats({ total: 0, actions: 0 });
    try {
      localStorage.removeItem('flexifreight_user');
      localStorage.removeItem('flexifreight_token');
      localStorage.removeItem('flexi_my_post_ids');
      localStorage.removeItem('flexi_last_cust_phone');
    } catch (e) {
      console.warn("LocalStorage clear error:", e);
    }
    setUserDropdownOpen(false);
  };

  // Trigger XGBoost daily retraining manually to demonstrate continuous learning
  const handleTriggerRetrain = async () => {
    setIsRetraining(true);
    setRetrainResult(null);
    try {
      const res = await fetch('/api/v1/retrain', { method: 'POST' });
      const data = await res.json();
      setRetrainResult(data);
      setTimeout(() => setRetrainResult(null), 6000);
    } catch (e) {
      alert("Retraining failed: " + e.message);
    } finally {
      setIsRetraining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ===================== TOP HEADER & NAVIGATION ===================== */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo & Platform Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center font-black">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-black text-white text-xl tracking-tight">
                  FlexiFreight <span className="text-emerald-400">AI</span>
                </h1>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 hidden sm:inline-block">
                  v2.0 Production
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden md:block">
                {t.app_subtitle}
              </p>
            </div>
          </div>

          {/* Center Role & Post Tracker Switcher Tabs */}
          <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
            {/* 1. Shipper / Post Freight */}
            <button
              onClick={() => {
                setRole('CUSTOMER');
                setCustomerViewMode('POST');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                role === 'CUSTOMER' && customerViewMode === 'POST'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>{t.role_customer}</span>
            </button>

            {/* 2. Customer Post Status & Tracker (Directly right side of Shipper / Post Freight) */}
            <button
              onClick={() => {
                setRole('CUSTOMER');
                setCustomerViewMode('MY_ORDERS');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${
                role === 'CUSTOMER' && customerViewMode === 'MY_ORDERS'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-teal-300" />
              <span>{t.role_customer_tracker}</span>
              {customerStats.actions > 0 ? (
                <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-bounce shadow">
                  <span>⚡ {customerStats.actions} Driver Accept</span>
                </span>
              ) : customerStats.total > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {customerStats.total}
                </span>
              ) : null}
            </button>

            {/* 3. Driver / Transporter Feed */}
            <button
              onClick={() => setRole('DRIVER')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                role === 'DRIVER'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t.role_driver}</span>
            </button>
          </div>

          {/* Right Controls: Retrain, Language & User Profile / Login */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* XGBoost APScheduler Retrain Trigger */}
            <button
              onClick={handleTriggerRetrain}
              disabled={isRetraining}
              title="Test XGBoost Daily Self-Learning Retraining Engine"
              className="p-2 sm:px-3 sm:py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Cpu className={`w-3.5 h-3.5 text-emerald-400 ${isRetraining ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">{isRetraining ? t.retraining : t.retrain_btn}</span>
            </button>

            {/* Language Selector (EN, HI, MR) */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-1 text-xs">
              <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded-lg font-semibold transition ${
                  lang === 'en' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('hi')}
                className={`px-2 py-1 rounded-lg font-semibold transition ${
                  lang === 'hi' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                हिंदी
              </button>
              <button
                onClick={() => setLang('mr')}
                className={`px-2 py-1 rounded-lg font-semibold transition ${
                  lang === 'mr' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                मराठी
              </button>
            </div>

            {/* User Profile / Login Widget */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs transition cursor-pointer shadow-sm"
                >
                  <img
                    src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                    alt={currentUser.full_name}
                    className="w-6 h-6 rounded-lg object-cover border border-emerald-500/50"
                  />
                  <div className="text-left hidden sm:block">
                    <span className="font-semibold block max-w-[110px] truncate leading-tight">
                      {currentUser.full_name}
                    </span>
                    <span className="text-[10px] text-emerald-400 block leading-tight">
                      {currentUser.role === 'DRIVER' ? 'Transporter' : 'Customer'}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-xs animate-fadeIn">
                    <div className="px-3.5 py-2.5 border-b border-slate-800/80">
                      <p className="font-bold text-white truncate">{currentUser.full_name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          currentUser.role === 'DRIVER' 
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        }`}>
                          {currentUser.role === 'DRIVER' ? 'Commercial Transporter' : 'Goods Shipper'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setIsProfileModalOpen(true); setUserDropdownOpen(false); }}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 text-slate-300 hover:text-white transition cursor-pointer"
                    >
                      <User className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="font-medium">My Profile & Location</div>
                        <div className="text-[10px] text-slate-500">Edit address & vehicle details</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setAuthModalTab('FORGOT_PASSWORD'); setIsAuthModalOpen(true); setUserDropdownOpen(false); }}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 text-slate-300 hover:text-white transition cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="font-medium">Reset Password</div>
                        <div className="text-[10px] text-slate-500">Change account password</div>
                      </div>
                    </button>

                    <div className="border-t border-slate-800 my-1" />

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full px-3.5 py-2 text-left hover:bg-rose-500/10 text-rose-400 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setAuthModalTab('LOGIN'); setIsAuthModalOpen(true); }}
                className="px-3 sm:px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Retrain Alert Notification */}
      {retrainResult && (
        <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-4 py-2.5 text-center text-xs text-emerald-300 flex items-center justify-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>
            {retrainResult.message} <b>{retrainResult.historical_records_used} records</b> used. 
            RMSE: <b>{retrainResult.rmse}</b> | R² Score: <b>{retrainResult.r2_score}</b>. 
            Scheduled automatically at 02:00 AM daily.
          </span>
        </div>
      )}

      {/* ===================== MAIN CONTENT VIEW ===================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {role === 'CUSTOMER' ? (
          <CustomerPortal 
            t={t} 
            hierarchyData={hierarchyData}
            currentUser={currentUser}
            onOpenAuth={() => { setAuthModalTab('LOGIN'); setIsAuthModalOpen(true); }}
            customerViewMode={customerViewMode}
            onCustomerViewModeChange={setCustomerViewMode}
            onPostCreated={(newPost) => {
              setTargetPost(newPost);
              fetchCustomerStats();
            }}
            onNavigateToDriverFeed={(newPost) => {
              setTargetPost(newPost);
              setRole('DRIVER');
            }}
          />
        ) : (
          <DriverFeed 
            t={t} 
            hierarchyData={hierarchyData} 
            currentUser={currentUser}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            targetPost={targetPost}
            onClearTargetPost={() => setTargetPost(null)}
          />
        )}
      </main>

      {/* ===================== MODALS ===================== */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authModalTab}
        onAuthSuccess={handleAuthSuccess}
        hierarchyData={hierarchyData}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        authToken={authToken}
        onProfileUpdated={handleProfileUpdated}
        hierarchyData={hierarchyData}
      />

      {/* ===================== FOOTER ===================== */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>FlexiFreight AI Engine: Active (<span className="text-emerald-400">&lt;10ms Local XGBoost Inference</span>)</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <span>All-India LGD Cascading Hierarchy</span>
            <span>•</span>
            <span>Google OAuth & Verified Profiles</span>
            <span>•</span>
            <span>Parivahan / VAHAN KYC</span>
            <span>•</span>
            <span>APScheduler 2:00 AM Retraining</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
