import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Boxes,
  Building2,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  Settings,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type { AuthSessionResponse, AuthUser, DashboardSnapshot, Shop } from './types';
import { api } from './lib/api';
import { OverviewView } from './components/OverviewView';
import { ProductsView } from './components/ProductsView';
import { PricingView } from './components/PricingView';
import { InventoryView } from './components/InventoryView';
import { StaffView } from './components/StaffView';
import { ActivityView } from './components/ActivityView';
import { WhatsAppSettingsView } from './components/WhatsAppSettingsView';
import { WhatsAppSimulator } from './components/WhatsAppSimulator';
import { NewShopModal } from './components/NewShopModal';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';

type NavTab =
  | 'dashboard'
  | 'products'
  | 'pricing'
  | 'inventory'
  | 'staff'
  | 'activity'
  | 'whatsapp';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'pricing', label: 'Pricing & margins', icon: TrendingUp },
  { id: 'inventory', label: 'Inventory & losses', icon: Boxes },
  { id: 'staff', label: 'Staff & permissions', icon: Users },
  { id: 'activity', label: 'Activity history', icon: Activity },
  { id: 'whatsapp', label: 'WhatsApp & plan', icon: Settings },
];

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'demo'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'demo') return 'demo';
    }
    return 'landing';
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeShopId, setActiveShopId] = useState<string>('shop_adebayo_lagos');
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [showSimulatorOnDesktop, setShowSimulatorOnDesktop] = useState(true);
  const [mobileView, setMobileView] = useState<'dashboard' | 'simulator'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNewShopModal, setShowNewShopModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);
  const [externalPrompt, setExternalPrompt] = useState<{ id: number; text: string } | null>(null);

  const loadSnapshot = useCallback(async (shopId: string) => {
    try {
      const data = await api.getDashboard(shopId);
      setSnapshot(data);
      setShops(data.allShops);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load shop data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot(activeShopId);
  }, [activeShopId, loadSnapshot]);

  const handleRefresh = useCallback(async () => {
    await loadSnapshot(activeShopId);
  }, [activeShopId, loadSnapshot]);

  function handleQuickPrompt(prompt: string) {
    setExternalPrompt({ id: Date.now(), text: prompt });
    setShowSimulatorOnDesktop(true);
    setMobileView('simulator');
  }

  async function handleShopCreated(shop: Shop) {
    setActiveShopId(shop.id);
    await loadSnapshot(shop.id);
  }

  async function handleAuthenticated(session: AuthSessionResponse) {
    api.setAuthToken(session.token);
    setCurrentUser(session.user);
    setShops(session.shops);
    const firstOwned =
      session.shops.find((s) => s.ownerUserId === session.user.id) || session.shops[0];
    if (firstOwned) {
      setActiveShopId(firstOwned.id);
      await loadSnapshot(firstOwned.id);
    }
  }

  async function handleSignOut() {
    api.setAuthToken(null);
    setCurrentUser(null);
    setActiveShopId('shop_adebayo_lagos');
    await loadSnapshot('shop_adebayo_lagos');
  }

  const ownerMember =
    snapshot?.staff.find((s) => s.role === 'owner') || snapshot?.staff[0];
  const actorName = currentUser?.name || ownerMember?.name || 'Shop Owner';
  const actorRole = ownerMember?.role || 'owner';

  const currentNavLabel =
    NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Dashboard';

  function switchViewMode(next: 'landing' | 'demo') {
    setViewMode(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (next === 'demo') {
        url.searchParams.set('view', 'demo');
      } else {
        url.searchParams.delete('view');
      }
      window.history.replaceState({}, '', url.toString());
      window.scrollTo({ top: 0 });
    }
  }

  if (viewMode === 'landing') {
    return <LandingPage onOpenDemo={() => switchViewMode('demo')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Sabi AI
          </span>
          {currentUser ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              title="Sign out"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalMode('login')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </button>
          )}
        </div>

        {/* Multi-Tenant Shop Switcher */}
        <div className="px-4 py-4 border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="shop-select" className="text-[11px] font-medium text-slate-500">
              Active shop tenant
            </label>
            <button
              type="button"
              onClick={() => setShowNewShopModal(true)}
              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              New shop
            </button>
          </div>
          <div className="relative">
            <select
              id="shop-select"
              value={activeShopId}
              onChange={(e) => setActiveShopId(e.target.value)}
              className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-600"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {!s.isDemo ? ' (Private)' : ''}
                </option>
              ))}
            </select>
          </div>
          {snapshot && (
            <p className="text-[11px] text-slate-500 truncate">
              {snapshot.shop.location}
            </p>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Plan & Owner Account Footer */}
        <div className="px-4 py-3.5 border-t border-slate-200 text-xs text-slate-500 space-y-2.5">
          {snapshot && (
            <div>
              <p className="font-medium text-slate-700 truncate">{actorName}</p>
              <p className="capitalize">
                {snapshot.shop.planId.replace('_', '-')} plan ·{' '}
                {snapshot.shop.isDemo ? 'Demo DB' : 'Private DB'}
              </p>
            </div>
          )}
          {!currentUser && (
            <button
              type="button"
              onClick={() => setAuthModalMode('register')}
              className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              Save my private shop
            </button>
          )}
          <button
            type="button"
            onClick={() => switchViewMode('landing')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to waitlist page
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Sabi AI
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setMobileView('dashboard')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
              mobileView === 'dashboard' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setMobileView('simulator')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
              mobileView === 'simulator' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            WhatsApp
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col z-10 border-r border-slate-200">
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-base font-bold text-slate-900">Sabi AI</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Shop tenant</span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowNewShopModal(true);
                  }}
                  className="text-xs font-semibold text-emerald-700 cursor-pointer"
                >
                  + New shop
                </button>
              </div>
              <select
                value={activeShopId}
                onChange={(e) => setActiveShopId(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {!s.isDemo ? ' (Private)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <nav className="p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileView('dashboard');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg cursor-pointer ${
                      active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto p-4 border-t border-slate-200 space-y-3">
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void handleSignOut();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out ({currentUser.name})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthModalMode('register');
                  }}
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                >
                  Sign in / Save private shop
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  switchViewMode('landing');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to waitlist page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content + Docked WhatsApp Simulator Split */}
      <div className="flex-1 lg:pl-60 flex min-w-0">
        {/* Owner Dashboard Column */}
        <main
          className={`flex-1 min-w-0 flex flex-col ${
            mobileView === 'simulator' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Desktop Top Bar */}
          <div className="hidden lg:flex items-center justify-between gap-6 px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-20">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{snapshot?.shop.name || 'Loading shop...'}</span>
                <span aria-hidden="true">/</span>
                <span className="text-slate-900 font-medium">{currentNavLabel}</span>
              </div>
              <h1 className="text-lg font-semibold text-slate-900 mt-0.5 truncate">
                {currentNavLabel}
              </h1>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowSimulatorOnDesktop((v) => !v)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                {showSimulatorOnDesktop ? 'Hide WhatsApp Simulator' : 'Open WhatsApp Simulator'}
              </button>
            </div>
          </div>

          {/* Dashboard Viewport */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
            {errorMsg && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
                {errorMsg}
              </div>
            )}

            {loading || !snapshot ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
                  ))}
                </div>
                <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <OverviewView
                    snapshot={snapshot}
                    onNavigate={(tab) => setActiveTab(tab)}
                    onQuickPrompt={handleQuickPrompt}
                  />
                )}
                {activeTab === 'products' && (
                  <ProductsView
                    shopId={snapshot.shop.id}
                    products={snapshot.products}
                    actorName={actorName}
                    actorRole={actorRole}
                    onRefresh={handleRefresh}
                  />
                )}
                {activeTab === 'pricing' && (
                  <PricingView
                    shopId={snapshot.shop.id}
                    products={snapshot.products}
                    purchases={snapshot.purchases}
                    notifications={snapshot.notifications}
                    actorName={actorName}
                    actorRole={actorRole}
                    onRefresh={handleRefresh}
                  />
                )}
                {activeTab === 'inventory' && (
                  <InventoryView
                    shopId={snapshot.shop.id}
                    products={snapshot.products}
                    stockLosses={snapshot.stockLosses}
                    actorName={actorName}
                    actorRole={actorRole}
                    onRefresh={handleRefresh}
                  />
                )}
                {activeTab === 'staff' && (
                  <StaffView
                    shopId={snapshot.shop.id}
                    shopName={snapshot.shop.name}
                    staff={snapshot.staff}
                    actorName={actorName}
                    onRefresh={handleRefresh}
                  />
                )}
                {activeTab === 'activity' && (
                  <ActivityView activities={snapshot.activities} />
                )}
                {activeTab === 'whatsapp' && (
                  <WhatsAppSettingsView
                    shop={snapshot.shop}
                    onRefresh={handleRefresh}
                  />
                )}
              </>
            )}
          </div>
        </main>

        {/* Right Docked WhatsApp Attendant Simulator */}
        {snapshot && (
          <aside
            className={`${
              mobileView === 'simulator'
                ? 'flex w-full h-[calc(100vh-57px)] p-3'
                : showSimulatorOnDesktop
                ? 'hidden lg:flex lg:w-[390px] xl:w-[420px] lg:sticky lg:top-0 lg:h-screen lg:p-4 lg:pl-0 shrink-0'
                : 'hidden'
            }`}
          >
            <div className="w-full h-full">
              <WhatsAppSimulator
                shop={snapshot.shop}
                staff={snapshot.staff}
                notifications={snapshot.notifications}
                externalPrompt={externalPrompt}
                onDatabaseUpdated={handleRefresh}
              />
            </div>
          </aside>
        )}
      </div>

      {showNewShopModal && (
        <NewShopModal
          onClose={() => setShowNewShopModal(false)}
          onCreated={handleShopCreated}
        />
      )}

      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </div>
  );
}
