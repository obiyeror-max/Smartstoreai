import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  Store,
  TrendingUp,
} from 'lucide-react';
import type {
  StaffCountRange,
  StoreCategoryOption,
  WaitlistJoinResponse,
  WaitlistSummary,
} from '../types';
import { api } from '../lib/api';

interface LandingPageProps {
  onOpenDemo: () => void;
}

const HERO_IMAGE = '/src/assets/images/sabi_hero_retail_1795759591343.jpg';
const AUDIT_IMAGE = '/src/assets/images/sabi_owner_audit_1795759591247.jpg';

const STORE_CATEGORIES: StoreCategoryOption[] = [
  'Supermarket',
  'Provision store',
  'Mini-mart',
  'Wholesale',
  'Pharmacy',
  'Other retail',
];

const STAFF_RANGES: Array<{ value: StaffCountRange; label: string }> = [
  { value: '1-3', label: '1–3 staff' },
  { value: '4-10', label: '4–10 staff' },
  { value: '11+', label: '11+ staff' },
];

const SHOP_COMPARISONS = [
  {
    title: 'Price enquiries during rush hour',
    before:
      'Attendants call the owner repeatedly, shout across aisles, or guess prices from memory.',
    after:
      'Staff ask on WhatsApp in English or Pidgin and receive your exact recorded price in seconds.',
  },
  {
    title: 'Supplier cost increases',
    before:
      'Shelf prices stay outdated for days after restocking, quietly erasing your profit margin.',
    after:
      'Sabi AI flags items for review when restock costs jump and notifies staff the moment you update a price.',
  },
  {
    title: 'Expired, damaged, or missing stock',
    before:
      'Spoilage and shelf variances go unnoticed until cash is missing at the end of the month.',
    after:
      '30-day expiry warnings, structured loss logs, and physical count audits show where every Naira goes.',
  },
];

export function LandingPage({ onOpenDemo }: LandingPageProps) {
  const [summary, setSummary] = useState<WaitlistSummary>({
    totalCount: 0,
  });

  const [heroContact, setHeroContact] = useState('');
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [storeCategory, setStoreCategory] = useState<StoreCategoryOption>('Supermarket');
  const [staffCountRange, setStaffCountRange] = useState<StaffCountRange>('1-3');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [joinedResult, setJoinedResult] = useState<WaitlistJoinResponse | null>(null);

  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [auditImgFailed, setAuditImgFailed] = useState(false);

  const fullNameInputRef = useRef<HTMLInputElement | null>(null);
  const waitlistSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getWaitlistSummary()
      .then((data) => {
        if (active && typeof data.totalCount === 'number') {
          setSummary(data);
        }
      })
      .catch(() => {
        // Keep initial fallback summary if offline
      });
    return () => {
      active = false;
    };
  }, []);

  function handleHeroJump(e: FormEvent) {
    e.preventDefault();
    const val = heroContact.trim();
    if (val) {
      if (val.includes('@')) {
        setEmail(val);
      } else {
        setWhatsappNumber(val);
      }
    }
    setJoinedResult(null);
    waitlistSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      fullNameInputRef.current?.focus();
    }, 350);
  }

  async function handleWaitlistSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    const cleanName = fullName.trim();
    const cleanShop = shopName.trim();
    const cleanCity = city.trim();
    const cleanEmail = email.trim();
    const cleanPhone = whatsappNumber.trim();

    if (!cleanName || !cleanShop) {
      setFormError('Please enter your full name and shop name.');
      return;
    }

    if (!cleanEmail && !cleanPhone) {
      setFormError('Please enter an email address or WhatsApp number.');
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (cleanPhone && cleanPhone.replace(/\D/g, '').length < 8) {
      setFormError('Please enter a valid WhatsApp phone number (at least 8 digits).');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.joinWaitlist({
        fullName: cleanName,
        shopName: cleanShop,
        city: cleanCity || 'Lagos, Nigeria',
        email: cleanEmail,
        whatsappNumber: cleanPhone,
        storeCategory,
        staffCountRange,
      });
      setJoinedResult(result);
      setSummary({
        totalCount: result.totalCount,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to join the waitlist right now.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForAnotherShop() {
    setJoinedResult(null);
    setFullName('');
    setShopName('');
    setCity('');
    setEmail('');
    setWhatsappNumber('');
    setFormError('');
  }

  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar: strict 3-zone contract */}
      <header className="bg-white/95 backdrop-blur-xs border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Sabi AI
          </a>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#how-it-works"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How it works
            </a>
            <a
              href="#capabilities"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#impact"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Shop impact
            </a>
            <a
              href="#waitlist"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Waitlist
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onOpenDemo}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Open Live Demo
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs sm:text-sm font-medium text-emerald-700 mb-3">
                WhatsApp Inventory &amp; Price Assistant · Built for Retail Stores
              </p>

              <h1 className="text-[clamp(2.25rem,4vw,3.35rem)] leading-[1.08] tracking-tight font-bold text-slate-900 [text-wrap:balance]">
                Your staff ask on WhatsApp. Sabi AI answers from your stock.
              </h1>

              <p className="mt-5 text-base sm:text-[17px] leading-relaxed text-slate-600 max-w-xl">
                Stop shop attendants from calling you all day to confirm prices or cartons left in
                the store. Sabi AI checks your real product catalogue, calculates customer baskets,
                and protects your margins.
              </p>

              {/* Hero Quick-Join Waitlist Form */}
              <form
                onSubmit={handleHeroJump}
                className="mt-7 flex flex-col sm:flex-row gap-3 max-w-lg"
              >
                <label htmlFor="hero-waitlist-contact" className="sr-only">
                  Email or WhatsApp number
                </label>
                <input
                  id="hero-waitlist-contact"
                  type="text"
                  value={heroContact}
                  onChange={(e) => setHeroContact(e.target.value)}
                  placeholder="Enter email or WhatsApp number"
                  className="flex-1 min-w-0 bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  Join Waitlist
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span className="tabular-nums font-medium text-slate-700">
                  {summary.totalCount > 0
                    ? `${summary.totalCount} retail ${summary.totalCount === 1 ? 'shop' : 'shops'} on the waitlist`
                    : 'Early-access waitlist open'}
                </span>
                <span aria-hidden="true">·</span>
                <span>Supermarkets, provision stores &amp; mini-marts</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onOpenDemo}
                  className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
                >
                  Try the live shop demo
                </button>
              </div>
            </div>

            {/* Hero Editorial Visual + Real WhatsApp Excerpt */}
            <div className="lg:col-span-6 flex">
              <div className="relative w-full min-h-[300px] lg:min-h-[430px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-200">
                {!heroImgFailed ? (
                  <img
                    src={HERO_IMAGE}
                    alt="Retail shop attendant checking product prices on WhatsApp at the store counter"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover lg:absolute lg:inset-0"
                  />
                ) : (
                  <div className="w-full h-full min-h-[320px] bg-gradient-to-br from-slate-800 via-slate-900 to-emerald-950 flex flex-col items-center justify-center p-8 text-white">
                    <Store className="w-10 h-10 text-emerald-400 mb-3" />
                    <p className="text-sm font-semibold">Sabi AI Shop Floor Assistant</p>
                    <p className="text-xs text-slate-300 mt-1">
                      Instant WhatsApp lookups grounded in your inventory
                    </p>
                  </div>
                )}

                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"
                />

                <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-800">
                      Attendant · Adebayo Provisions
                    </span>
                    <span>WhatsApp</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 font-medium">
                    &ldquo;Abeg how much be Milo 400g and one carton of Indomie?&rdquo;
                  </p>
                  <div className="pt-2 border-t border-slate-200 text-xs text-slate-700 leading-relaxed">
                    <span className="font-semibold text-emerald-700">Sabi AI: </span>
                    Milo 400 g tin is <span className="font-semibold tabular-nums">₦4,800</span> (12
                    tins left). Indomie Chicken carton is{' '}
                    <span className="font-semibold tabular-nums">₦9,200</span> (8 cartons left).
                    Total: <span className="font-semibold tabular-nums">₦14,000</span>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Strip (Full-Width Row) */}
        <section
          id="how-it-works"
          className="border-y border-slate-200 bg-white py-12 lg:py-14"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Built around how your shop already runs
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-600">
                Attendants keep using WhatsApp on their phones. Owners manage prices, suppliers,
                and staff permissions from one calm dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 lg:gap-8">
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">01</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">
                  Attendant texts or sends a voice note
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Works with plain English, retail shorthand, typos, and Nigerian Pidgin right in
                  WhatsApp.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">02</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">
                  Sabi AI verifies the staff member
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Matches the phone number to your shop only—unregistered callers cannot view your
                  prices or stock.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">03</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">
                  Reads only your shop database
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Returns exact recorded prices, unit sizes, and remaining stock. Never guesses or
                  invents numbers.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">04</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">
                  Logs every lookup and update
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Every price edit, stock adjustment, and enquiry is recorded with who made it and
                  when.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Bento Grid */}
        <section
          id="capabilities"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                More than price lookups—built to stop silent losses
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-600">
                Supplier prices shift weekly and expired or damaged goods eat into cash flow. Sabi AI
                tracks both without complicating daily sales.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenDemo}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Inspect live dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 01: Wide Card */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-500">01. Shop-floor WhatsApp lookups</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  Exact prices, multi-size disambiguation, and full basket totals
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl">
                  When a customer asks for Peak milk or Indomie without mentioning the size, Sabi AI
                  asks the attendant to pick the exact pack size. For multi-item orders, it adds up
                  the full Naira total automatically.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-xs">
                <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                  <p className="font-semibold text-slate-800">Multi-size clarification</p>
                  <p className="text-slate-600">
                    &ldquo;Which Peak Milk do you mean? 160 g tin (₦950) · 400 g tin (₦3,600) ·
                    Refill sachet (₦2,950).&rdquo;
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                  <p className="font-semibold text-slate-800">Voice note support</p>
                  <p className="text-slate-600">
                    Attendants record a quick voice message while packing items—transcribed and
                    answered in seconds.
                  </p>
                </div>
              </div>
            </div>

            {/* 02: Price-Change Management */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500">02. Margin protection</p>
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                </div>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  Automatic price-change alerts
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Record supplier purchase costs alongside selling prices. When restock costs rise,
                  Sabi AI flags the item for review—never changing shelf prices without owner
                  approval.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Instant staff broadcast</p>
                <p>
                  Update a selling price once and every attendant receives the new price immediately.
                </p>
              </div>
            </div>

            {/* 03: Role Controls */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500">03. Staff &amp; permissions</p>
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                </div>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  Keep supplier costs private
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Attendants only see selling prices and stock levels. Supplier cost prices, gross
                  margins, and price-edit permissions stay strictly limited to Owners and Managers.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Manager confirmation step</p>
                <p>
                  Price or stock changes over WhatsApp require an explicit confirmation tap before
                  saving.
                </p>
              </div>
            </div>

            {/* 04: Wide Card with Store Audit Image */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch">
              <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    04. Expiry, shrinkage &amp; stock counting
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-slate-900">
                    Spot expired stock and shelf variances early
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Track product expiry dates with early warnings, log damaged or missing items
                    with reasons, and run physical stock counts that calculate exact Naira variances.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                  <div>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">30 days</p>
                    <p className="text-xs text-slate-500">Advance expiry warning window</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">₦0 guesswork</p>
                    <p className="text-xs text-slate-500">Expected vs. counted shelf checks</p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-5 relative min-h-[220px] bg-slate-100">
                {!auditImgFailed ? (
                  <img
                    src={AUDIT_IMAGE}
                    alt="Shop owner checking shelf inventory with a tablet in the grocery aisle"
                    referrerPolicy="no-referrer"
                    onError={() => setAuditImgFailed(true)}
                    className="w-full h-full object-cover md:absolute md:inset-0"
                  />
                ) : (
                  <div className="w-full h-full min-h-[220px] bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
                    <MessageSquare className="w-8 h-8 text-emerald-400 mb-2" />
                    <p className="text-xs font-medium">Stock-Count &amp; Expiry Audit</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Before vs. After Shop Impact Section */}
        <section id="impact" className="border-y border-slate-200 bg-white py-14 lg:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div className="max-w-2xl">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  What changes on your shop floor
                </h2>
                <p className="mt-2 text-sm sm:text-base text-slate-600">
                  Built for supermarkets, provision stores, mini-marts, and wholesalers tired of
                  price mix-ups and unrecorded stock losses.
                </p>
              </div>
              <a
                href="#waitlist"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
              >
                Join early access
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SHOP_COMPARISONS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl p-6 sm:p-7 border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-5"
                >
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Without Sabi AI</p>
                        <p className="mt-1 text-slate-600 leading-relaxed">{item.before}</p>
                      </div>
                      <div className="pt-3 border-t border-slate-200">
                        <p className="text-xs font-semibold text-emerald-700">With Sabi AI</p>
                        <p className="mt-1 text-slate-800 leading-relaxed font-medium">
                          {item.after}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Full Waitlist Capture Section */}
        <section
          id="waitlist"
          ref={waitlistSectionRef}
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 scroll-mt-16"
        >
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-5 flex flex-col justify-between gap-6">
              <div>
                <p className="text-xs font-semibold text-emerald-700">Early Access Waitlist</p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                  Get Sabi AI set up for your shop first
                </h2>
                <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                  We are onboarding retail supermarkets, provision stores, mini-marts, and
                  wholesalers in weekly batches so every shop gets personal help uploading its first
                  product list.
                </p>

                <dl className="mt-7 pt-6 border-t border-slate-200 space-y-4 text-sm">
                  <div>
                    <dt className="font-semibold text-slate-900">1. Free product list import</dt>
                    <dd className="text-slate-600 mt-0.5">
                      Share a spreadsheet, invoice, or shelf list and we help load it cleanly.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">2. Dedicated WhatsApp setup</dt>
                    <dd className="text-slate-600 mt-0.5">
                      We walk your owner and attendants through their first live queries.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">3. Founding store onboarding</dt>
                    <dd className="text-slate-600 mt-0.5">
                      Early waitlist stores get priority rollout and direct team feedback access.
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                {summary.totalCount > 0 ? (
                  <>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {summary.totalCount} {summary.totalCount === 1 ? 'shop' : 'shops'}
                    </span>{' '}
                    already registered for onboarding
                  </>
                ) : (
                  <span>Weekly onboarding cohorts for Nigerian retail stores</span>
                )}
              </div>
            </div>

            <div className="lg:col-span-7">
              {joinedResult ? (
                <div className="h-full bg-emerald-50/60 border border-emerald-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between gap-6">
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">
                      {joinedResult.alreadyJoined
                        ? 'Already on the waitlist'
                        : 'Waitlist spot confirmed'}
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-slate-900">
                      You are <span className="tabular-nums">#{joinedResult.position}</span> in line
                      {joinedResult.entry?.shopName ? ` for ${joinedResult.entry.shopName}` : ''}
                    </h3>
                    <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                      {joinedResult.alreadyJoined
                        ? 'This email or WhatsApp number is already registered on our waitlist. Your spot in line is preserved.'
                        : `Thank you, ${joinedResult.entry?.fullName || 'shop owner'}. When onboarding opens for ${joinedResult.entry?.city || 'your area'}, we will reach out with your setup slot.`}
                    </p>

                    <div className="mt-6 bg-white border border-emerald-200 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-slate-500">Queue position</p>
                        <p className="font-semibold text-slate-900 mt-0.5 tabular-nums">
                          #{joinedResult.position}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Store type</p>
                        <p className="font-semibold text-slate-900 mt-0.5">
                          {joinedResult.entry?.storeCategory || storeCategory}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Waitlist total</p>
                        <p className="font-semibold text-slate-900 mt-0.5 tabular-nums">
                          {joinedResult.totalCount} {joinedResult.totalCount === 1 ? 'shop' : 'shops'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onOpenDemo}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Test Live Demo While You Wait
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={resetForAnotherShop}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Register another shop
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} noValidate className="space-y-4">
                  {formError && (
                    <div
                      role="alert"
                      className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm"
                    >
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="wl-full-name"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Full name
                      </label>
                      <input
                        ref={fullNameInputRef}
                        id="wl-full-name"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Folake Adebayo"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="wl-shop-name"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Shop or business name
                      </label>
                      <input
                        id="wl-shop-name"
                        type="text"
                        required
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="e.g. Adebayo Provisions & Mart"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="wl-email"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Email address
                      </label>
                      <input
                        id="wl-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="owner@yourshop.com"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="wl-whatsapp"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        WhatsApp phone number
                      </label>
                      <input
                        id="wl-whatsapp"
                        type="tel"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="+234 803 000 0000"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="wl-city"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        City / State
                      </label>
                      <input
                        id="wl-city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Yaba, Lagos"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="wl-category"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Store type
                      </label>
                      <select
                        id="wl-category"
                        value={storeCategory}
                        onChange={(e) => setStoreCategory(e.target.value as StoreCategoryOption)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600"
                      >
                        {STORE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Number of shop attendants &amp; managers
                    </span>
                    <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
                      {STAFF_RANGES.map((range) => {
                        const active = staffCountRange === range.value;
                        return (
                          <button
                            key={range.value}
                            type="button"
                            onClick={() => setStaffCountRange(range.value)}
                            className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              active
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {range.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      {submitting ? 'Saving your spot...' : 'Reserve Early Access'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-xs text-slate-500">
                      No spam. We only message when your onboarding batch opens.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-slate-900">Sabi AI</span>
            <span aria-hidden="true">·</span>
            <span>WhatsApp inventory &amp; price assistant for retail stores</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hover:text-slate-900 whitespace-nowrap">
              How it works
            </a>
            <a href="#impact" className="hover:text-slate-900 whitespace-nowrap">
              Shop impact
            </a>
            <a href="#waitlist" className="hover:text-slate-900 whitespace-nowrap">
              Waitlist
            </a>
            <button
              type="button"
              onClick={onOpenDemo}
              className="font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap cursor-pointer"
            >
              Open Live Demo
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
