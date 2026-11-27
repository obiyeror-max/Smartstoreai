import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSupabaseAdmin } from './supabaseClient.ts';
import { syncWaitlistExcelFile } from './waitlistExcel.ts';
import type { ChatHistoryTurn } from './ai.ts';
import type {
  ActivityLog,
  AuthUser,
  PendingConfirmation,
  Product,
  PurchaseRecord,
  Shop,
  StaffCountRange,
  StaffMember,
  StaffNotification,
  StaffRole,
  StockAdjustmentReason,
  StockLossRecord,
  StoreCategoryOption,
  SubscriptionPlanId,
  WaitlistEntry,
  WaitlistJoinResponse,
  WaitlistSummary,
} from '../src/types.ts';

interface StoredUserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface WhatsAppThreadState {
  threadKey: string;
  shopId: string;
  phone: string;
  history: ChatHistoryTurn[];
  pendingConfirmation: PendingConfirmation | null;
  updatedAt: string;
}

interface DatabaseState {
  users: StoredUserAccount[];
  shops: Shop[];
  products: Product[];
  staff: StaffMember[];
  activities: ActivityLog[];
  purchases: PurchaseRecord[];
  stockLosses: StockLossRecord[];
  notifications: StaffNotification[];
  processedMessageIds: string[];
  waitlist: WaitlistEntry[];
  whatsappThreads: Record<string, WhatsAppThreadState>;
}

const DATA_DIR =
  process.env.VERCEL || process.env.VERCEL_ENV
    ? '/tmp/smartstore-data'
    : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'smartstore.db.json');

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

function hoursAgo(hrs: number): string {
  return new Date(Date.now() - hrs * 3_600_000).toISOString();
}

function daysFromNowDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function normalizePhoneDisplay(phone: string): string {
  return phone.replace(/[\s\-()]/g, '').trim();
}

export function canonicalPhoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('0')) {
    return `234${digits.slice(1)}`;
  }
  return digits;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derivedHex = crypto.scryptSync(password, salt, 64).toString('hex');
  if (derivedHex.length !== expectedHex.length) return false;
  return crypto.timingSafeEqual(Buffer.from(derivedHex, 'utf8'), Buffer.from(expectedHex, 'utf8'));
}

function createSeedState(): DatabaseState {
  const shop1Id = 'shop_adebayo_lagos';
  const shop2Id = 'shop_zainab_abuja';

  const shops: Shop[] = [
    {
      id: shop1Id,
      ownerUserId: null,
      isDemo: true,
      name: 'Adebayo Provisions & Supermarket',
      location: 'Surulere, Lagos',
      category: 'Supermarket & Provisions',
      whatsappNumber: '+234 803 555 0100',
      whatsappPhoneNumberId: null,
      whatsappConnected: true,
      planId: 'growth',
      createdAt: hoursAgo(240),
    },
    {
      id: shop2Id,
      ownerUserId: null,
      isDemo: true,
      name: 'Zainab Fresh Mart',
      location: 'Wuse II, Abuja',
      category: 'Mini-Mart & Groceries',
      whatsappNumber: '+234 809 555 0200',
      whatsappPhoneNumberId: null,
      whatsappConnected: true,
      planId: 'multi_branch',
      createdAt: hoursAgo(180),
    },
  ];

  const products: Product[] = [
    {
      id: 'prod_milo_400',
      shopId: shop1Id,
      name: 'Milo',
      packSize: '400 g tin',
      sku: 'MILO-400',
      category: 'Beverages',
      costPrice: 3950,
      sellingPrice: 4800,
      previousSellingPrice: 4500,
      lastPriceUpdateAt: minutesAgo(42),
      supplierName: 'Nestlé Nigeria Distributors',
      stockQuantity: 12,
      unit: 'tins',
      reorderLevel: 5,
      expiryDate: daysFromNowDate(180),
      priceReviewFlag: false,
      updatedAt: minutesAgo(42),
      updatedBy: 'Adebayo Ogunleye',
    },
    {
      id: 'prod_milo_900',
      shopId: shop1Id,
      name: 'Milo',
      packSize: '900 g refill',
      sku: 'MILO-900',
      category: 'Beverages',
      costPrice: 7900,
      sellingPrice: 8500,
      previousSellingPrice: 8000,
      lastPriceUpdateAt: hoursAgo(72),
      supplierName: 'Nestlé Nigeria Distributors',
      stockQuantity: 7,
      unit: 'packs',
      reorderLevel: 4,
      expiryDate: daysFromNowDate(140),
      priceReviewFlag: true,
      priceReviewReason: 'Supplier cost rose from ₦7,200 to ₦7,900 (margin dropped to 7.1%)',
      updatedAt: hoursAgo(4),
      updatedBy: 'Tunde Bakare',
    },
    {
      id: 'prod_milo_sachet',
      shopId: shop1Id,
      name: 'Milo',
      packSize: '20 g sachet',
      sku: 'MILO-20G',
      category: 'Beverages',
      costPrice: 155,
      sellingPrice: 200,
      previousSellingPrice: 180,
      lastPriceUpdateAt: hoursAgo(96),
      supplierName: 'Nestlé Nigeria Distributors',
      stockQuantity: 64,
      unit: 'sachets',
      reorderLevel: 20,
      expiryDate: daysFromNowDate(210),
      priceReviewFlag: false,
      updatedAt: hoursAgo(9),
      updatedBy: 'Tunde Bakare',
    },
    {
      id: 'prod_peak_evap',
      shopId: shop1Id,
      name: 'Peak Evaporated Milk',
      packSize: '160 g tin',
      sku: 'PEAK-160',
      category: 'Dairy',
      costPrice: 780,
      sellingPrice: 950,
      previousSellingPrice: 900,
      lastPriceUpdateAt: hoursAgo(30),
      supplierName: 'FrieslandCampina WAMCO',
      stockQuantity: 28,
      unit: 'tins',
      reorderLevel: 12,
      expiryDate: daysFromNowDate(16),
      priceReviewFlag: false,
      updatedAt: hoursAgo(3),
      updatedBy: 'Adebayo Ogunleye',
    },
    {
      id: 'prod_peak_powder',
      shopId: shop1Id,
      name: 'Peak Milk Powder',
      packSize: '400 g refill',
      sku: 'PEAK-400P',
      category: 'Dairy',
      costPrice: 5100,
      sellingPrice: 5400,
      previousSellingPrice: 5000,
      lastPriceUpdateAt: hoursAgo(120),
      supplierName: 'FrieslandCampina WAMCO',
      stockQuantity: 3,
      unit: 'packs',
      reorderLevel: 6,
      expiryDate: daysFromNowDate(21),
      priceReviewFlag: true,
      priceReviewReason: 'Supplier cost rose from ₦4,600 to ₦5,100 (margin dropped to 5.6%)',
      updatedAt: minutesAgo(18),
      updatedBy: 'Tunde Bakare',
    },
    {
      id: 'prod_indomie_onion',
      shopId: shop1Id,
      name: 'Indomie Onion Chicken',
      packSize: '70 g carton (40 packs)',
      sku: 'INDO-ONION-CTN',
      category: 'Noodles & Pasta',
      costPrice: 9800,
      sellingPrice: 11500,
      previousSellingPrice: 10800,
      lastPriceUpdateAt: hoursAgo(48),
      supplierName: 'Dufil Prima Foods',
      stockQuantity: 9,
      unit: 'cartons',
      reorderLevel: 5,
      expiryDate: daysFromNowDate(160),
      priceReviewFlag: false,
      updatedAt: hoursAgo(5),
      updatedBy: 'Adebayo Ogunleye',
    },
    {
      id: 'prod_indomie_super',
      shopId: shop1Id,
      name: 'Indomie Super Pack',
      packSize: '120 g carton (40 packs)',
      sku: 'INDO-SUPER-CTN',
      category: 'Noodles & Pasta',
      costPrice: 14100,
      sellingPrice: 16200,
      previousSellingPrice: 15500,
      lastPriceUpdateAt: hoursAgo(36),
      supplierName: 'Dufil Prima Foods',
      stockQuantity: 4,
      unit: 'cartons',
      reorderLevel: 5,
      expiryDate: daysFromNowDate(120),
      priceReviewFlag: false,
      updatedAt: hoursAgo(2),
      updatedBy: 'Tunde Bakare',
    },
    {
      id: 'prod_rice_50kg',
      shopId: shop1Id,
      name: 'Royal Stallion Rice',
      packSize: '50 kg bag',
      sku: 'RICE-STAL-50',
      category: 'Grains & Staples',
      costPrice: 74500,
      sellingPrice: 82000,
      previousSellingPrice: 79000,
      lastPriceUpdateAt: hoursAgo(24),
      supplierName: 'Oke-Arin Wholesale Hub',
      stockQuantity: 2,
      unit: 'bags',
      reorderLevel: 4,
      expiryDate: daysFromNowDate(240),
      priceReviewFlag: false,
      updatedAt: hoursAgo(1),
      updatedBy: 'Adebayo Ogunleye',
    },
    {
      id: 'prod_semovita_5kg',
      shopId: shop1Id,
      name: 'Golden Penny Semovita',
      packSize: '5 kg bag',
      sku: 'SEMO-GP-5KG',
      category: 'Grains & Staples',
      costPrice: 6600,
      sellingPrice: 7800,
      previousSellingPrice: 7500,
      lastPriceUpdateAt: hoursAgo(70),
      supplierName: 'Flour Mills of Nigeria',
      stockQuantity: 11,
      unit: 'bags',
      reorderLevel: 4,
      expiryDate: daysFromNowDate(-4),
      priceReviewFlag: false,
      updatedAt: hoursAgo(6),
      updatedBy: 'Tunde Bakare',
    },
    {
      id: 'prod_kings_oil',
      shopId: shop1Id,
      name: "Devon King's Cooking Oil",
      packSize: '5 L keg',
      sku: 'KINGS-5L',
      category: 'Cooking Essentials',
      costPrice: 14500,
      sellingPrice: 16800,
      previousSellingPrice: 16000,
      lastPriceUpdateAt: hoursAgo(50),
      supplierName: 'PZ Wilmar Distributors',
      stockQuantity: 6,
      unit: 'kegs',
      reorderLevel: 3,
      expiryDate: daysFromNowDate(195),
      priceReviewFlag: false,
      updatedAt: hoursAgo(8),
      updatedBy: 'Adebayo Ogunleye',
    },
    {
      id: 'prod_coke_crate',
      shopId: shop1Id,
      name: 'Coca-Cola 50 cl',
      packSize: 'Crate (24 bottles)',
      sku: 'COKE-50CL-CRT',
      category: 'Soft Drinks',
      costPrice: 6100,
      sellingPrice: 7200,
      previousSellingPrice: 6800,
      lastPriceUpdateAt: hoursAgo(60),
      supplierName: 'NBC Bottling Depot',
      stockQuantity: 15,
      unit: 'crates',
      reorderLevel: 6,
      expiryDate: daysFromNowDate(95),
      priceReviewFlag: false,
      updatedAt: hoursAgo(12),
      updatedBy: 'Tunde Bakare',
    },
    {
      id: 'prod_ariel_800',
      shopId: shop1Id,
      name: 'Ariel Detergent',
      packSize: '800 g pack',
      sku: 'ARIEL-800',
      category: 'Household Care',
      costPrice: 2550,
      sellingPrice: 3100,
      previousSellingPrice: 2950,
      lastPriceUpdateAt: hoursAgo(90),
      supplierName: 'Procter & Gamble Trade',
      stockQuantity: 0,
      unit: 'packs',
      reorderLevel: 5,
      expiryDate: null,
      priceReviewFlag: false,
      updatedAt: minutesAgo(55),
      updatedBy: 'Tunde Bakare',
    },
    {
      id: 'prod_hypo_1l',
      shopId: shop1Id,
      name: 'Hypo Bleach',
      packSize: '1 L bottle',
      sku: 'HYPO-1L',
      category: 'Household Care',
      costPrice: 1180,
      sellingPrice: 1450,
      previousSellingPrice: 1350,
      lastPriceUpdateAt: hoursAgo(110),
      supplierName: 'Tolaram Group Depot',
      stockQuantity: 19,
      unit: 'bottles',
      reorderLevel: 8,
      expiryDate: daysFromNowDate(280),
      priceReviewFlag: false,
      updatedAt: hoursAgo(14),
      updatedBy: 'Adebayo Ogunleye',
    },
    {
      id: 'prod_z_milo_400',
      shopId: shop2Id,
      name: 'Milo',
      packSize: '400 g tin',
      sku: 'ZFM-MILO-400',
      category: 'Beverages',
      costPrice: 4200,
      sellingPrice: 5100,
      previousSellingPrice: 4900,
      lastPriceUpdateAt: hoursAgo(2),
      supplierName: 'Abuja Central Distributors',
      stockQuantity: 20,
      unit: 'tins',
      reorderLevel: 6,
      expiryDate: daysFromNowDate(160),
      priceReviewFlag: false,
      updatedAt: hoursAgo(2),
      updatedBy: 'Zainab Musa',
    },
    {
      id: 'prod_z_rice_50kg',
      shopId: shop2Id,
      name: 'Mama Gold Rice',
      packSize: '50 kg bag',
      sku: 'ZFM-RICE-50',
      category: 'Grains & Staples',
      costPrice: 77500,
      sellingPrice: 85500,
      previousSellingPrice: 83000,
      lastPriceUpdateAt: hoursAgo(5),
      supplierName: 'Northern Agro Supply',
      stockQuantity: 5,
      unit: 'bags',
      reorderLevel: 3,
      expiryDate: daysFromNowDate(220),
      priceReviewFlag: false,
      updatedAt: hoursAgo(5),
      updatedBy: 'Zainab Musa',
    },
    {
      id: 'prod_z_indomie',
      shopId: shop2Id,
      name: 'Indomie Chicken Flavour',
      packSize: '70 g carton (40 packs)',
      sku: 'ZFM-INDO-CTN',
      category: 'Noodles & Pasta',
      costPrice: 10200,
      sellingPrice: 12000,
      previousSellingPrice: 11500,
      lastPriceUpdateAt: hoursAgo(7),
      supplierName: 'Dufil Abuja Depot',
      stockQuantity: 14,
      unit: 'cartons',
      reorderLevel: 5,
      expiryDate: daysFromNowDate(180),
      priceReviewFlag: false,
      updatedAt: hoursAgo(7),
      updatedBy: 'Ibrahim Sani',
    },
    {
      id: 'prod_z_hollandia',
      shopId: shop2Id,
      name: 'Hollandia Yoghurt',
      packSize: '1 L pack',
      sku: 'ZFM-HOLL-1L',
      category: 'Dairy',
      costPrice: 1950,
      sellingPrice: 2200,
      previousSellingPrice: 2000,
      lastPriceUpdateAt: hoursAgo(40),
      supplierName: 'Chi Limited Abuja',
      stockQuantity: 3,
      unit: 'packs',
      reorderLevel: 8,
      expiryDate: daysFromNowDate(9),
      priceReviewFlag: true,
      priceReviewReason: 'Supplier cost rose from ₦1,700 to ₦1,950 (margin dropped to 11.4%)',
      updatedAt: hoursAgo(1),
      updatedBy: 'Ibrahim Sani',
    },
  ];

  const staff: StaffMember[] = [
    {
      id: 'staff_adebayo',
      shopId: shop1Id,
      name: 'Adebayo Ogunleye',
      phone: '+2348031110001',
      role: 'owner',
      active: true,
      createdAt: hoursAgo(240),
    },
    {
      id: 'staff_tunde',
      shopId: shop1Id,
      name: 'Tunde Bakare',
      phone: '+2348031110002',
      role: 'manager',
      active: true,
      createdAt: hoursAgo(200),
    },
    {
      id: 'staff_chinedu',
      shopId: shop1Id,
      name: 'Chinedu Okafor',
      phone: '+2348031110003',
      role: 'attendant',
      active: true,
      createdAt: hoursAgo(160),
    },
    {
      id: 'staff_amina',
      shopId: shop1Id,
      name: 'Amina Yusuf',
      phone: '+2348031110004',
      role: 'attendant',
      active: true,
      createdAt: hoursAgo(120),
    },
    {
      id: 'staff_zainab',
      shopId: shop2Id,
      name: 'Zainab Musa',
      phone: '+2348092220001',
      role: 'owner',
      active: true,
      createdAt: hoursAgo(180),
    },
    {
      id: 'staff_ibrahim',
      shopId: shop2Id,
      name: 'Ibrahim Sani',
      phone: '+2348092220002',
      role: 'attendant',
      active: true,
      createdAt: hoursAgo(150),
    },
  ];

  const purchases: PurchaseRecord[] = [
    {
      id: 'pur_1',
      shopId: shop1Id,
      productId: 'prod_milo_900',
      productName: 'Milo (900 g refill)',
      supplierName: 'Nestlé Nigeria Distributors',
      quantity: 10,
      unit: 'packs',
      unitCost: 7900,
      previousCostPrice: 7200,
      totalCost: 79000,
      costIncreased: true,
      note: 'New restock invoice — supplier increased price by ₦700/pack',
      recordedBy: 'Tunde Bakare',
      createdAt: hoursAgo(4),
    },
    {
      id: 'pur_2',
      shopId: shop1Id,
      productId: 'prod_peak_powder',
      productName: 'Peak Milk Powder (400 g refill)',
      supplierName: 'FrieslandCampina WAMCO',
      quantity: 8,
      unit: 'packs',
      unitCost: 5100,
      previousCostPrice: 4600,
      totalCost: 40800,
      costIncreased: true,
      note: 'Dairy wholesale restock',
      recordedBy: 'Adebayo Ogunleye',
      createdAt: hoursAgo(18),
    },
    {
      id: 'pur_3',
      shopId: shop1Id,
      productId: 'prod_milo_400',
      productName: 'Milo (400 g tin)',
      supplierName: 'Nestlé Nigeria Distributors',
      quantity: 18,
      unit: 'tins',
      unitCost: 3950,
      previousCostPrice: 3750,
      totalCost: 71100,
      costIncreased: true,
      note: 'Selling price reviewed to ₦4,800',
      recordedBy: 'Adebayo Ogunleye',
      createdAt: hoursAgo(26),
    },
  ];

  const stockLosses: StockLossRecord[] = [
    {
      id: 'loss_1',
      shopId: shop1Id,
      productId: 'prod_peak_evap',
      productName: 'Peak Evaporated Milk (160 g tin)',
      lossType: 'damaged',
      quantity: 3,
      unit: 'tins',
      unitCost: 780,
      estimatedLossValue: 2340,
      reason: 'Dented tins during shelf restocking',
      recordedBy: 'Tunde Bakare',
      createdAt: hoursAgo(14),
    },
    {
      id: 'loss_2',
      shopId: shop1Id,
      productId: 'prod_semovita_5kg',
      productName: 'Golden Penny Semovita (5 kg bag)',
      lossType: 'expired',
      quantity: 1,
      unit: 'bags',
      unitCost: 6600,
      estimatedLossValue: 6600,
      reason: 'Removed torn/expired bag from back store',
      recordedBy: 'Adebayo Ogunleye',
      createdAt: hoursAgo(36),
    },
  ];

  const notifications: StaffNotification[] = [
    {
      id: 'notif_1',
      shopId: shop1Id,
      type: 'price_change',
      title: 'Price updated: Milo (400 g tin)',
      message: 'Adebayo Ogunleye changed selling price from ₦4,500 to ₦4,800. Synced immediately to WhatsApp.',
      actorName: 'Adebayo Ogunleye',
      read: false,
      createdAt: minutesAgo(42),
    },
    {
      id: 'notif_2',
      shopId: shop1Id,
      type: 'price_review',
      title: 'Price review recommended (2 items)',
      message: 'Milo 900 g refill and Peak Milk Powder 400 g had supplier cost increases.',
      actorName: 'Sabi AI Price Assistant',
      read: false,
      createdAt: hoursAgo(4),
    },
  ];

  const activities: ActivityLog[] = [
    {
      id: 'act_1',
      shopId: shop1Id,
      type: 'enquiry',
      actorName: 'Chinedu Okafor',
      actorRole: 'attendant',
      actorPhone: '+2348031110003',
      productId: 'prod_milo_400',
      productName: 'Milo (400 g tin)',
      summary: 'Checked price & stock for Milo 400 g tin',
      detail: 'Returned ₦4,800 · 12 tins in stock',
      channel: 'whatsapp',
      createdAt: minutesAgo(12),
    },
    {
      id: 'act_2',
      shopId: shop1Id,
      type: 'stock_adjustment',
      actorName: 'Tunde Bakare',
      actorRole: 'manager',
      productId: 'prod_peak_powder',
      productName: 'Peak Milk Powder (400 g refill)',
      summary: 'Sold 4 packs · Stock reduced from 7 to 3 packs',
      detail: 'Triggered low-stock alert (reorder level: 6 packs)',
      channel: 'dashboard',
      createdAt: minutesAgo(18),
    },
    {
      id: 'act_3',
      shopId: shop1Id,
      type: 'price_change',
      actorName: 'Adebayo Ogunleye',
      actorRole: 'owner',
      productId: 'prod_milo_400',
      productName: 'Milo (400 g tin)',
      summary: 'Updated selling price from ₦4,500 to ₦4,800',
      detail: 'Notified authorised staff · Previous price recorded',
      channel: 'dashboard',
      createdAt: minutesAgo(42),
    },
    {
      id: 'act_4',
      shopId: shop1Id,
      type: 'stock_loss',
      actorName: 'Tunde Bakare',
      actorRole: 'manager',
      productId: 'prod_peak_evap',
      productName: 'Peak Evaporated Milk (160 g tin)',
      summary: 'Recorded 3 tins damaged (₦2,340 cost loss)',
      detail: 'Dented tins during shelf restocking',
      channel: 'dashboard',
      createdAt: hoursAgo(14),
    },
    {
      id: 'act_5',
      shopId: shop2Id,
      type: 'enquiry',
      actorName: 'Ibrahim Sani',
      actorRole: 'attendant',
      actorPhone: '+2348092220002',
      productId: 'prod_z_milo_400',
      productName: 'Milo (400 g tin)',
      summary: 'Checked price for Milo 400 g tin',
      detail: 'Returned ₦5,100 · 20 tins in stock',
      channel: 'whatsapp',
      createdAt: minutesAgo(25),
    },
  ];

  return {
    users: [],
    shops,
    products,
    staff,
    activities,
    purchases,
    stockLosses,
    notifications,
    processedMessageIds: [],
    waitlist: [],
    whatsappThreads: {},
  };
}

function migrateProduct(
  p: Partial<Product> &
    Pick<
      Product,
      'id' | 'shopId' | 'name' | 'sellingPrice' | 'stockQuantity' | 'unit' | 'reorderLevel' | 'updatedAt' | 'updatedBy'
    >
): Product {
  return {
    id: p.id,
    shopId: p.shopId,
    name: p.name,
    packSize: p.packSize || 'Standard',
    sku: p.sku || 'SKU',
    category: p.category || 'General',
    costPrice: typeof p.costPrice === 'number' ? p.costPrice : Math.round(p.sellingPrice * 0.84),
    sellingPrice: p.sellingPrice,
    previousSellingPrice: p.previousSellingPrice ?? null,
    lastPriceUpdateAt: p.lastPriceUpdateAt || p.updatedAt,
    supplierName: p.supplierName || 'General Distributor',
    stockQuantity: p.stockQuantity,
    unit: p.unit,
    reorderLevel: p.reorderLevel,
    expiryDate: p.expiryDate ?? null,
    priceReviewFlag: Boolean(p.priceReviewFlag),
    priceReviewReason: p.priceReviewReason,
    updatedAt: p.updatedAt,
    updatedBy: p.updatedBy,
  };
}

// ---------- Supabase Row Mappers ----------
function rowToShop(row: Record<string, unknown>): Shop {
  return {
    id: String(row.id),
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    isDemo: Boolean(row.is_demo),
    name: String(row.name),
    location: String(row.location),
    category: String(row.category || 'Supermarket & Provisions'),
    whatsappNumber: String(row.whatsapp_number),
    whatsappPhoneNumberId: row.whatsapp_phone_number_id
      ? String(row.whatsapp_phone_number_id)
      : null,
    whatsappConnected: row.whatsapp_connected !== false,
    planId: (String(row.plan_id || 'starter') as SubscriptionPlanId),
    createdAt: String(row.created_at),
  };
}

function shopToRow(shop: Shop) {
  return {
    id: shop.id,
    owner_user_id: shop.ownerUserId ?? null,
    is_demo: Boolean(shop.isDemo),
    name: shop.name,
    location: shop.location,
    category: shop.category,
    whatsapp_number: shop.whatsappNumber,
    whatsapp_phone_number_id: shop.whatsappPhoneNumberId ?? null,
    whatsapp_connected: shop.whatsappConnected,
    plan_id: shop.planId,
    created_at: shop.createdAt,
  };
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    name: String(row.name),
    packSize: String(row.pack_size),
    sku: String(row.sku),
    category: String(row.category || 'General'),
    costPrice: Number(row.cost_price ?? 0),
    sellingPrice: Number(row.selling_price ?? 0),
    previousSellingPrice:
      row.previous_selling_price !== null && row.previous_selling_price !== undefined
        ? Number(row.previous_selling_price)
        : null,
    lastPriceUpdateAt: String(row.last_price_update_at),
    supplierName: String(row.supplier_name || 'General Distributor'),
    stockQuantity: Number(row.stock_quantity ?? 0),
    unit: String(row.unit || 'units'),
    reorderLevel: Number(row.reorder_level ?? 5),
    expiryDate: row.expiry_date ? String(row.expiry_date) : null,
    priceReviewFlag: Boolean(row.price_review_flag),
    priceReviewReason: row.price_review_reason ? String(row.price_review_reason) : undefined,
    updatedAt: String(row.updated_at),
    updatedBy: String(row.updated_by),
  };
}

function productToRow(p: Product) {
  return {
    id: p.id,
    shop_id: p.shopId,
    name: p.name,
    pack_size: p.packSize,
    sku: p.sku,
    category: p.category,
    cost_price: p.costPrice,
    selling_price: p.sellingPrice,
    previous_selling_price: p.previousSellingPrice,
    last_price_update_at: p.lastPriceUpdateAt,
    supplier_name: p.supplierName,
    stock_quantity: p.stockQuantity,
    unit: p.unit,
    reorder_level: p.reorderLevel,
    expiry_date: p.expiryDate,
    price_review_flag: p.priceReviewFlag,
    price_review_reason: p.priceReviewReason ?? null,
    updated_at: p.updatedAt,
    updated_by: p.updatedBy,
  };
}

function rowToStaff(row: Record<string, unknown>): StaffMember {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    name: String(row.name),
    phone: String(row.phone),
    role: String(row.role) as StaffRole,
    active: row.active !== false,
    createdAt: String(row.created_at),
  };
}

function staffToRow(m: StaffMember) {
  return {
    id: m.id,
    shop_id: m.shopId,
    name: m.name,
    phone: m.phone,
    role: m.role,
    active: m.active,
    created_at: m.createdAt,
  };
}

function rowToPurchase(row: Record<string, unknown>): PurchaseRecord {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    supplierName: String(row.supplier_name),
    quantity: Number(row.quantity),
    unit: String(row.unit),
    unitCost: Number(row.unit_cost),
    previousCostPrice: Number(row.previous_cost_price),
    totalCost: Number(row.total_cost),
    costIncreased: Boolean(row.cost_increased),
    note: row.note ? String(row.note) : undefined,
    recordedBy: String(row.recorded_by),
    createdAt: String(row.created_at),
  };
}

function purchaseToRow(p: PurchaseRecord) {
  return {
    id: p.id,
    shop_id: p.shopId,
    product_id: p.productId,
    product_name: p.productName,
    supplier_name: p.supplierName,
    quantity: p.quantity,
    unit: p.unit,
    unit_cost: p.unitCost,
    previous_cost_price: p.previousCostPrice,
    total_cost: p.totalCost,
    cost_increased: p.costIncreased,
    note: p.note ?? null,
    recorded_by: p.recordedBy,
    created_at: p.createdAt,
  };
}

function rowToLoss(row: Record<string, unknown>): StockLossRecord {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    lossType: String(row.loss_type) as StockLossRecord['lossType'],
    quantity: Number(row.quantity),
    unit: String(row.unit),
    unitCost: Number(row.unit_cost),
    estimatedLossValue: Number(row.estimated_loss_value),
    reason: String(row.reason),
    recordedBy: String(row.recorded_by),
    createdAt: String(row.created_at),
  };
}

function lossToRow(l: StockLossRecord) {
  return {
    id: l.id,
    shop_id: l.shopId,
    product_id: l.productId,
    product_name: l.productName,
    loss_type: l.lossType,
    quantity: l.quantity,
    unit: l.unit,
    unit_cost: l.unitCost,
    estimated_loss_value: l.estimatedLossValue,
    reason: l.reason,
    recorded_by: l.recordedBy,
    created_at: l.createdAt,
  };
}

function rowToNotification(row: Record<string, unknown>): StaffNotification {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    type: String(row.type) as StaffNotification['type'],
    title: String(row.title),
    message: String(row.message),
    actorName: String(row.actor_name),
    read: Boolean(row.read),
    createdAt: String(row.created_at),
  };
}

function notificationToRow(n: StaffNotification) {
  return {
    id: n.id,
    shop_id: n.shopId,
    type: n.type,
    title: n.title,
    message: n.message,
    actor_name: n.actorName,
    read: n.read,
    created_at: n.createdAt,
  };
}

function rowToActivity(row: Record<string, unknown>): ActivityLog {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    type: String(row.type) as ActivityLog['type'],
    actorName: String(row.actor_name),
    actorRole: String(row.actor_role) as ActivityLog['actorRole'],
    actorPhone: row.actor_phone ? String(row.actor_phone) : undefined,
    productId: row.product_id ? String(row.product_id) : undefined,
    productName: row.product_name ? String(row.product_name) : undefined,
    summary: String(row.summary),
    detail: row.detail ? String(row.detail) : undefined,
    channel: (String(row.channel || 'dashboard') as 'dashboard' | 'whatsapp'),
    createdAt: String(row.created_at),
  };
}

function activityToRow(a: ActivityLog) {
  return {
    id: a.id,
    shop_id: a.shopId,
    type: a.type,
    actor_name: a.actorName,
    actor_role: a.actorRole,
    actor_phone: a.actorPhone ?? null,
    product_id: a.productId ?? null,
    product_name: a.productName ?? null,
    summary: a.summary,
    detail: a.detail ?? null,
    channel: a.channel,
    created_at: a.createdAt,
  };
}

function rowToWaitlist(row: Record<string, unknown>): WaitlistEntry {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    shopName: String(row.shop_name),
    city: String(row.city),
    email: String(row.email || ''),
    whatsappNumber: String(row.whatsapp_number || ''),
    storeCategory: String(row.store_category || 'Supermarket') as StoreCategoryOption,
    staffCountRange: String(row.staff_count_range || '1-3') as StaffCountRange,
    createdAt: String(row.created_at),
  };
}

class SmartStoreRepository {
  private state: DatabaseState;
  private supabaseSeedPromise: Promise<void> | null = null;

  constructor() {
    this.state = this.loadLocal();
    void syncWaitlistExcelFile(this.state.waitlist);
  }

  private loadLocal(): DatabaseState {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<DatabaseState>;
        if (parsed && Array.isArray(parsed.shops) && Array.isArray(parsed.products)) {
          const seed = createSeedState();
          return {
            users: Array.isArray(parsed.users) ? parsed.users : [],
            shops: parsed.shops.map((s) => ({
              ...s,
              isDemo:
                s.isDemo !== undefined
                  ? s.isDemo
                  : s.id === 'shop_adebayo_lagos' || s.id === 'shop_zainab_abuja',
              ownerUserId: s.ownerUserId ?? null,
              whatsappPhoneNumberId: s.whatsappPhoneNumberId ?? null,
            })),
            products: parsed.products.map((p) => migrateProduct(p)),
            staff: parsed.staff || [],
            activities: parsed.activities || [],
            purchases: parsed.purchases || seed.purchases,
            stockLosses: parsed.stockLosses || seed.stockLosses,
            notifications: parsed.notifications || seed.notifications,
            processedMessageIds: parsed.processedMessageIds || [],
            waitlist: Array.isArray(parsed.waitlist) ? parsed.waitlist : seed.waitlist,
            whatsappThreads: parsed.whatsappThreads || {},
          };
        }
      }
    } catch (err) {
      console.error('Failed to load store file, recreating seed state:', err);
    }
    const seed = createSeedState();
    this.persistLocal(seed);
    return seed;
  }

  private persistLocal(nextState: DatabaseState = this.state): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(nextState, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.warn('Could not persist local state to disk (continuing in-memory):', err);
    }
  }

  private async ensureSupabaseSeeded(): Promise<void> {
    const sb = getSupabaseAdmin();
    if (!sb) return;
    if (this.supabaseSeedPromise) {
      await this.supabaseSeedPromise;
      return;
    }

    this.supabaseSeedPromise = (async () => {
      const { count, error } = await sb
        .from('shops')
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.error('Supabase shops check failed:', error.message);
        throw new Error(`Supabase error: ${error.message}. Make sure you ran supabase/schema.sql.`);
      }

      if ((count ?? 0) === 0) {
        const seed = createSeedState();
        await sb.from('shops').upsert(seed.shops.map(shopToRow));
        await sb.from('products').upsert(seed.products.map(productToRow));
        await sb.from('staff').upsert(seed.staff.map(staffToRow));
        await sb.from('purchases').upsert(seed.purchases.map(purchaseToRow));
        await sb.from('stock_losses').upsert(seed.stockLosses.map(lossToRow));
        await sb.from('staff_notifications').upsert(seed.notifications.map(notificationToRow));
        await sb.from('activities').upsert(seed.activities.map(activityToRow));
      }
    })().catch((err) => {
      this.supabaseSeedPromise = null;
      throw err;
    });

    await this.supabaseSeedPromise;
  }

  public normalizePhone(phone: string): string {
    return normalizePhoneDisplay(phone);
  }

  // ---------- User Accounts (Owner Auth) ----------
  public async registerUserAccount(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ user?: AuthUser; error?: string }> {
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanName = input.name.trim();
    if (!cleanName || !cleanEmail || input.password.length < 6) {
      return { error: 'Name, valid email, and a password of at least 6 characters are required.' };
    }

    const userRecord: StoredUserAccount = {
      id: `usr_${crypto.randomUUID().slice(0, 12)}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      await this.ensureSupabaseSeeded();
      const { data: existing } = await sb
        .from('app_users')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existing) {
        return { error: 'An account with this email already exists. Please sign in.' };
      }

      const { error } = await sb.from('app_users').insert({
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        password_hash: userRecord.passwordHash,
        created_at: userRecord.createdAt,
      });

      if (error) {
        return { error: `Could not create account: ${error.message}` };
      }
    } else {
      const existing = this.state.users.find((u) => u.email === cleanEmail);
      if (existing) {
        return { error: 'An account with this email already exists. Please sign in.' };
      }
      this.state.users.push(userRecord);
      this.persistLocal();
    }

    return {
      user: {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        createdAt: userRecord.createdAt,
      },
    };
  }

  public async loginUserAccount(
    email: string,
    password: string
  ): Promise<{ user?: AuthUser; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const sb = getSupabaseAdmin();
    let found: StoredUserAccount | undefined;

    if (sb) {
      await this.ensureSupabaseSeeded();
      const { data } = await sb
        .from('app_users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (data) {
        found = {
          id: String(data.id),
          name: String(data.name),
          email: String(data.email),
          passwordHash: String(data.password_hash),
          createdAt: String(data.created_at),
        };
      }
    } else {
      found = this.state.users.find((u) => u.email === cleanEmail);
    }

    if (!found || !verifyPassword(password, found.passwordHash)) {
      return { error: 'Invalid email or password.' };
    }

    return {
      user: {
        id: found.id,
        name: found.name,
        email: found.email,
        createdAt: found.createdAt,
      },
    };
  }

  public async getUserById(userId: string): Promise<AuthUser | undefined> {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb.from('app_users').select('*').eq('id', userId).maybeSingle();
      if (!data) return undefined;
      return {
        id: String(data.id),
        name: String(data.name),
        email: String(data.email),
        createdAt: String(data.created_at),
      };
    }

    const found = this.state.users.find((u) => u.id === userId);
    if (!found) return undefined;
    return {
      id: found.id,
      name: found.name,
      email: found.email,
      createdAt: found.createdAt,
    };
  }

  // ---------- Shops ----------
  public async getAccessibleShops(userId?: string): Promise<Shop[]> {
    const sb = getSupabaseAdmin();
    let shops: Shop[];

    if (sb) {
      await this.ensureSupabaseSeeded();
      const { data } = await sb.from('shops').select('*').order('created_at', { ascending: true });
      shops = (data || []).map((r) => rowToShop(r as Record<string, unknown>));
    } else {
      shops = [...this.state.shops];
    }

    const filtered = shops.filter(
      (s) => s.isDemo || (userId && s.ownerUserId && s.ownerUserId === userId)
    );
    // Put user's own shops first if signed in
    if (userId) {
      filtered.sort((a, b) => {
        const aOwn = a.ownerUserId === userId ? 0 : 1;
        const bOwn = b.ownerUserId === userId ? 0 : 1;
        return aOwn - bOwn;
      });
    }
    return filtered;
  }

  public async getShopById(shopId: string): Promise<Shop | undefined> {
    const sb = getSupabaseAdmin();
    if (sb) {
      await this.ensureSupabaseSeeded();
      const { data } = await sb.from('shops').select('*').eq('id', shopId).maybeSingle();
      return data ? rowToShop(data as Record<string, unknown>) : undefined;
    }
    return this.state.shops.find((s) => s.id === shopId);
  }

  public async getShopByWhatsappIdentity(params: {
    shopId?: string;
    phoneNumberId?: string;
    toBusinessPhone?: string;
  }): Promise<Shop | undefined> {
    if (params.shopId) {
      return this.getShopById(params.shopId);
    }

    const sb = getSupabaseAdmin();
    let shops: Shop[];
    if (sb) {
      await this.ensureSupabaseSeeded();
      const { data } = await sb.from('shops').select('*');
      shops = (data || []).map((r) => rowToShop(r as Record<string, unknown>));
    } else {
      shops = this.state.shops;
    }

    if (params.phoneNumberId) {
      const byPid = shops.find((s) => s.whatsappPhoneNumberId === params.phoneNumberId);
      if (byPid) return byPid;
    }

    if (params.toBusinessPhone) {
      const targetKey = canonicalPhoneKey(params.toBusinessPhone);
      const byPhone = shops.find((s) => canonicalPhoneKey(s.whatsappNumber) === targetKey);
      if (byPhone) return byPhone;
    }

    // Fallback: if single default WHATSAPP_PHONE_NUMBER_ID matches or user only has 1 WhatsApp-connected shop
    if (params.phoneNumberId && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() === params.phoneNumberId) {
      const nonDemo = shops.find((s) => !s.isDemo && s.whatsappConnected);
      if (nonDemo) return nonDemo;
      return shops.find((s) => s.whatsappConnected);
    }

    return undefined;
  }

  public async createShop(input: {
    ownerUserId?: string | null;
    isDemo?: boolean;
    name: string;
    location: string;
    category: string;
    whatsappNumber: string;
    whatsappPhoneNumberId?: string | null;
    ownerName: string;
    ownerPhone: string;
    planId: SubscriptionPlanId;
  }): Promise<Shop> {
    const id = `shop_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const shop: Shop = {
      id,
      ownerUserId: input.ownerUserId ?? null,
      isDemo: input.isDemo !== undefined ? input.isDemo : !input.ownerUserId,
      name: input.name.trim(),
      location: input.location.trim(),
      category: input.category.trim() || 'Supermarket & Provisions',
      whatsappNumber: input.whatsappNumber.trim(),
      whatsappPhoneNumberId: input.whatsappPhoneNumberId?.trim() || null,
      whatsappConnected: true,
      planId: input.planId || 'starter',
      createdAt: now,
    };

    const owner: StaffMember = {
      id: `staff_${crypto.randomUUID().slice(0, 8)}`,
      shopId: id,
      name: input.ownerName.trim(),
      phone: normalizePhoneDisplay(input.ownerPhone),
      role: 'owner',
      active: true,
      createdAt: now,
    };

    const activity: ActivityLog = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId: id,
      type: 'staff_updated',
      actorName: owner.name,
      actorRole: 'owner',
      summary: `Created shop account "${shop.name}"`,
      detail: `Connected WhatsApp Business number ${shop.whatsappNumber}`,
      channel: 'dashboard',
      createdAt: now,
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      await this.ensureSupabaseSeeded();
      await sb.from('shops').insert(shopToRow(shop));
      await sb.from('staff').insert(staffToRow(owner));
      await sb.from('activities').insert(activityToRow(activity));
    } else {
      this.state.shops.push(shop);
      this.state.staff.push(owner);
      this.state.activities.unshift(activity);
      this.persistLocal();
    }

    return shop;
  }

  public async updateShopConfig(
    shopId: string,
    patch: Partial<
      Pick<
        Shop,
        'whatsappNumber' | 'whatsappPhoneNumberId' | 'whatsappConnected' | 'planId' | 'name' | 'location'
      >
    >
  ): Promise<Shop | undefined> {
    const shop = await this.getShopById(shopId);
    if (!shop) return undefined;

    if (typeof patch.name === 'string' && patch.name.trim()) shop.name = patch.name.trim();
    if (typeof patch.location === 'string' && patch.location.trim()) shop.location = patch.location.trim();
    if (typeof patch.whatsappNumber === 'string' && patch.whatsappNumber.trim()) {
      shop.whatsappNumber = patch.whatsappNumber.trim();
    }
    if (patch.whatsappPhoneNumberId !== undefined) {
      shop.whatsappPhoneNumberId = patch.whatsappPhoneNumberId
        ? patch.whatsappPhoneNumberId.trim()
        : null;
    }
    if (typeof patch.whatsappConnected === 'boolean') {
      shop.whatsappConnected = patch.whatsappConnected;
    }
    if (patch.planId) {
      shop.planId = patch.planId;
    }

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('shops').update(shopToRow(shop)).eq('id', shopId);
    } else {
      const idx = this.state.shops.findIndex((s) => s.id === shopId);
      if (idx !== -1) this.state.shops[idx] = shop;
      this.persistLocal();
    }
    return shop;
  }

  // ---------- Products ----------
  public async getProductsForShop(shopId: string): Promise<Product[]> {
    const sb = getSupabaseAdmin();
    if (sb) {
      await this.ensureSupabaseSeeded();
      const { data } = await sb
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .order('name', { ascending: true });
      return (data || []).map((r) => rowToProduct(r as Record<string, unknown>));
    }
    return this.state.products
      .filter((p) => p.shopId === shopId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public async getProductInShop(shopId: string, productId: string): Promise<Product | undefined> {
    const sb = getSupabaseAdmin();
    if (sb) {
      await this.ensureSupabaseSeeded();
      const { data } = await sb
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .eq('id', productId)
        .maybeSingle();
      return data ? rowToProduct(data as Record<string, unknown>) : undefined;
    }
    return this.state.products.find((p) => p.shopId === shopId && p.id === productId);
  }

  public async createProduct(
    shopId: string,
    input: {
      name: string;
      packSize: string;
      sku: string;
      category: string;
      costPrice?: number;
      sellingPrice: number;
      supplierName?: string;
      stockQuantity: number;
      unit: string;
      reorderLevel: number;
      expiryDate?: string | null;
      actorName: string;
      actorRole: StaffRole;
    }
  ): Promise<Product> {
    const now = new Date().toISOString();
    const selling = Math.max(0, Number(input.sellingPrice));
    const cost =
      input.costPrice !== undefined && !Number.isNaN(Number(input.costPrice))
        ? Math.max(0, Number(input.costPrice))
        : Math.round(selling * 0.85);

    const product: Product = {
      id: `prod_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      name: input.name.trim(),
      packSize: input.packSize.trim(),
      sku: input.sku.trim().toUpperCase(),
      category: input.category.trim() || 'General',
      costPrice: cost,
      sellingPrice: selling,
      previousSellingPrice: null,
      lastPriceUpdateAt: now,
      supplierName: input.supplierName?.trim() || 'General Distributor',
      stockQuantity: Math.max(0, Math.floor(Number(input.stockQuantity))),
      unit: input.unit.trim() || 'units',
      reorderLevel: Math.max(0, Math.floor(Number(input.reorderLevel))),
      expiryDate: input.expiryDate || null,
      priceReviewFlag: false,
      updatedAt: now,
      updatedBy: input.actorName,
    };

    const activity: ActivityLog = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      type: 'product_added',
      actorName: input.actorName,
      actorRole: input.actorRole,
      productId: product.id,
      productName: `${product.name} (${product.packSize})`,
      summary: `Added ${product.name} (${product.packSize}) at ₦${product.sellingPrice.toLocaleString('en-NG')}`,
      detail: `Cost ₦${product.costPrice.toLocaleString('en-NG')} · Stock ${product.stockQuantity} ${product.unit}`,
      channel: 'dashboard',
      createdAt: now,
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('products').insert(productToRow(product));
      await sb.from('activities').insert(activityToRow(activity));
    } else {
      this.state.products.push(product);
      this.state.activities.unshift(activity);
      this.persistLocal();
    }

    return product;
  }

  public async bulkImportProducts(
    shopId: string,
    items: Array<{
      name: string;
      packSize: string;
      sku: string;
      category: string;
      costPrice?: number;
      sellingPrice: number;
      supplierName?: string;
      stockQuantity: number;
      unit: string;
      reorderLevel: number;
      expiryDate?: string | null;
    }>,
    actorName: string,
    actorRole: StaffRole
  ): Promise<Product[]> {
    const now = new Date().toISOString();
    const created: Product[] = [];
    for (const item of items) {
      if (!item.name?.trim()) continue;
      const selling = Math.max(0, Number(item.sellingPrice) || 0);
      const cost =
        item.costPrice !== undefined && !Number.isNaN(Number(item.costPrice))
          ? Math.max(0, Number(item.costPrice))
          : Math.round(selling * 0.85);
      created.push({
        id: `prod_${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        name: item.name.trim(),
        packSize: item.packSize?.trim() || 'Standard',
        sku: (item.sku?.trim() || `SKU-${crypto.randomUUID().slice(0, 5)}`).toUpperCase(),
        category: item.category?.trim() || 'General',
        costPrice: cost,
        sellingPrice: selling,
        previousSellingPrice: null,
        lastPriceUpdateAt: now,
        supplierName: item.supplierName?.trim() || 'General Distributor',
        stockQuantity: Math.max(0, Math.floor(Number(item.stockQuantity) || 0)),
        unit: item.unit?.trim() || 'units',
        reorderLevel: Math.max(0, Math.floor(Number(item.reorderLevel) || 5)),
        expiryDate: item.expiryDate || null,
        priceReviewFlag: false,
        updatedAt: now,
        updatedBy: actorName,
      });
    }

    if (created.length === 0) return created;

    const activity: ActivityLog = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      type: 'product_added',
      actorName,
      actorRole,
      summary: `Imported ${created.length} products via CSV`,
      detail: created.slice(0, 3).map((p) => p.name).join(', ') + (created.length > 3 ? '...' : ''),
      channel: 'dashboard',
      createdAt: now,
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('products').insert(created.map(productToRow));
      await sb.from('activities').insert(activityToRow(activity));
    } else {
      this.state.products.push(...created);
      this.state.activities.unshift(activity);
      this.persistLocal();
    }

    return created;
  }

  public async updateProduct(
    shopId: string,
    productId: string,
    patch: {
      name?: string;
      packSize?: string;
      sku?: string;
      category?: string;
      costPrice?: number;
      sellingPrice?: number;
      supplierName?: string;
      stockQuantity?: number;
      unit?: string;
      reorderLevel?: number;
      expiryDate?: string | null;
      actorName: string;
      actorRole: StaffRole;
      channel?: 'dashboard' | 'whatsapp';
      reason?: string;
    }
  ): Promise<Product | undefined> {
    const product = await this.getProductInShop(shopId, productId);
    if (!product) return undefined;

    const now = new Date().toISOString();
    const oldPrice = product.sellingPrice;
    const oldCost = product.costPrice;
    const oldStock = product.stockQuantity;
    const channel = patch.channel || 'dashboard';

    if (typeof patch.name === 'string' && patch.name.trim()) product.name = patch.name.trim();
    if (typeof patch.packSize === 'string' && patch.packSize.trim()) product.packSize = patch.packSize.trim();
    if (typeof patch.sku === 'string' && patch.sku.trim()) product.sku = patch.sku.trim().toUpperCase();
    if (typeof patch.category === 'string' && patch.category.trim()) product.category = patch.category.trim();
    if (typeof patch.supplierName === 'string' && patch.supplierName.trim()) {
      product.supplierName = patch.supplierName.trim();
    }
    if (typeof patch.unit === 'string' && patch.unit.trim()) product.unit = patch.unit.trim();
    if (typeof patch.reorderLevel === 'number' && !Number.isNaN(patch.reorderLevel)) {
      product.reorderLevel = Math.max(0, Math.floor(patch.reorderLevel));
    }
    if (patch.expiryDate !== undefined) {
      product.expiryDate = patch.expiryDate || null;
    }
    if (typeof patch.costPrice === 'number' && !Number.isNaN(patch.costPrice)) {
      product.costPrice = Math.max(0, patch.costPrice);
    }
    if (typeof patch.sellingPrice === 'number' && !Number.isNaN(patch.sellingPrice)) {
      product.sellingPrice = Math.max(0, patch.sellingPrice);
    }
    if (typeof patch.stockQuantity === 'number' && !Number.isNaN(patch.stockQuantity)) {
      product.stockQuantity = Math.max(0, Math.floor(patch.stockQuantity));
    }

    product.updatedAt = now;
    product.updatedBy = patch.actorName;

    if (product.costPrice > oldCost && product.sellingPrice === oldPrice) {
      product.priceReviewFlag = true;
      product.priceReviewReason = `Cost price rose from ₦${oldCost.toLocaleString('en-NG')} to ₦${product.costPrice.toLocaleString('en-NG')}`;
    }

    const newActivities: ActivityLog[] = [];
    const newNotifications: StaffNotification[] = [];

    if (product.sellingPrice !== oldPrice) {
      product.previousSellingPrice = oldPrice;
      product.lastPriceUpdateAt = now;
      product.priceReviewFlag = false;
      product.priceReviewReason = undefined;

      newActivities.push({
        id: `act_${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        type: 'price_change',
        actorName: patch.actorName,
        actorRole: patch.actorRole,
        productId: product.id,
        productName: `${product.name} (${product.packSize})`,
        summary: `Updated selling price from ₦${oldPrice.toLocaleString('en-NG')} to ₦${product.sellingPrice.toLocaleString('en-NG')}`,
        detail: patch.reason || `Updated via ${channel === 'whatsapp' ? 'WhatsApp' : 'Owner Dashboard'}`,
        channel,
        createdAt: now,
      });

      newNotifications.push({
        id: `notif_${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        type: 'price_change',
        title: `Price updated: ${product.name} (${product.packSize})`,
        message: `${patch.actorName} changed selling price from ₦${oldPrice.toLocaleString('en-NG')} to ₦${product.sellingPrice.toLocaleString('en-NG')}. Synced immediately to staff WhatsApp.`,
        actorName: patch.actorName,
        read: false,
        createdAt: now,
      });
    }

    if (product.stockQuantity !== oldStock) {
      const diff = product.stockQuantity - oldStock;
      const verb = diff > 0 ? `Added ${diff}` : `Deducted ${Math.abs(diff)}`;
      newActivities.push({
        id: `act_${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        type: 'stock_adjustment',
        actorName: patch.actorName,
        actorRole: patch.actorRole,
        productId: product.id,
        productName: `${product.name} (${product.packSize})`,
        summary: `${verb} ${product.unit} · Stock ${oldStock} → ${product.stockQuantity} ${product.unit}`,
        detail:
          patch.reason ||
          (product.stockQuantity <= product.reorderLevel
            ? `Low-stock alert (reorder level: ${product.reorderLevel} ${product.unit})`
            : `Updated via ${channel === 'whatsapp' ? 'WhatsApp' : 'Owner Dashboard'}`),
        channel,
        createdAt: now,
      });
    }

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('products').update(productToRow(product)).eq('id', product.id).eq('shop_id', shopId);
      if (newActivities.length > 0) {
        await sb.from('activities').insert(newActivities.map(activityToRow));
      }
      if (newNotifications.length > 0) {
        await sb.from('staff_notifications').insert(newNotifications.map(notificationToRow));
      }
    } else {
      const idx = this.state.products.findIndex((p) => p.id === product.id && p.shopId === shopId);
      if (idx !== -1) this.state.products[idx] = product;
      this.state.activities.unshift(...newActivities);
      this.state.notifications.unshift(...newNotifications);
      this.persistLocal();
    }

    return product;
  }

  public async dismissPriceReview(
    shopId: string,
    productId: string,
    actorName: string,
    actorRole: StaffRole
  ): Promise<Product | undefined> {
    const product = await this.getProductInShop(shopId, productId);
    if (!product) return undefined;

    const now = new Date().toISOString();
    product.priceReviewFlag = false;
    product.priceReviewReason = undefined;
    product.lastPriceUpdateAt = now;
    product.updatedAt = now;
    product.updatedBy = actorName;

    const activity: ActivityLog = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      type: 'price_change',
      actorName,
      actorRole,
      productId: product.id,
      productName: `${product.name} (${product.packSize})`,
      summary: `Reviewed price for ${product.name} (kept ₦${product.sellingPrice.toLocaleString('en-NG')})`,
      channel: 'dashboard',
      createdAt: now,
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('products').update(productToRow(product)).eq('id', product.id).eq('shop_id', shopId);
      await sb.from('activities').insert(activityToRow(activity));
    } else {
      const idx = this.state.products.findIndex((p) => p.id === product.id && p.shopId === shopId);
      if (idx !== -1) this.state.products[idx] = product;
      this.state.activities.unshift(activity);
      this.persistLocal();
    }

    return product;
  }

  public async recordPurchase(
    shopId: string,
    input: {
      productId: string;
      supplierName: string;
      quantity: number;
      unitCost: number;
      expiryDate?: string | null;
      note?: string;
      actorName: string;
      actorRole: StaffRole;
    }
  ): Promise<{ product: Product; purchase: PurchaseRecord } | undefined> {
    const product = await this.getProductInShop(shopId, input.productId);
    if (!product) return undefined;

    const now = new Date().toISOString();
    const qty = Math.max(1, Math.floor(Number(input.quantity)));
    const unitCost = Math.max(0, Number(input.unitCost));
    const prevCost = product.costPrice;
    const costIncreased = unitCost > prevCost;

    product.stockQuantity += qty;
    product.costPrice = unitCost;
    if (input.supplierName.trim()) {
      product.supplierName = input.supplierName.trim();
    }
    if (input.expiryDate) {
      product.expiryDate = input.expiryDate;
    }
    product.updatedAt = now;
    product.updatedBy = input.actorName;

    let notification: StaffNotification | null = null;
    if (costIncreased) {
      const marginPct =
        product.sellingPrice > 0
          ? (((product.sellingPrice - unitCost) / product.sellingPrice) * 100).toFixed(1)
          : '0.0';
      product.priceReviewFlag = true;
      product.priceReviewReason = `Supplier cost rose from ₦${prevCost.toLocaleString('en-NG')} to ₦${unitCost.toLocaleString('en-NG')} (margin now ${marginPct}%)`;

      notification = {
        id: `notif_${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        type: 'price_review',
        title: `Price review recommended: ${product.name}`,
        message: `Cost increased from ₦${prevCost.toLocaleString('en-NG')} to ₦${unitCost.toLocaleString('en-NG')}. Review selling price (₦${product.sellingPrice.toLocaleString('en-NG')}).`,
        actorName: input.actorName,
        read: false,
        createdAt: now,
      };
    }

    const purchase: PurchaseRecord = {
      id: `pur_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      productId: product.id,
      productName: `${product.name} (${product.packSize})`,
      supplierName: product.supplierName,
      quantity: qty,
      unit: product.unit,
      unitCost,
      previousCostPrice: prevCost,
      totalCost: qty * unitCost,
      costIncreased,
      note: input.note?.trim(),
      recordedBy: input.actorName,
      createdAt: now,
    };

    const activity: ActivityLog = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      type: 'purchase',
      actorName: input.actorName,
      actorRole: input.actorRole,
      productId: product.id,
      productName: `${product.name} (${product.packSize})`,
      summary: `Purchased ${qty} ${product.unit} from ${product.supplierName} at ₦${unitCost.toLocaleString('en-NG')}/${product.unit}`,
      detail: costIncreased
        ? `Cost increased (₦${prevCost.toLocaleString('en-NG')} → ₦${unitCost.toLocaleString('en-NG')}) · Flagged for selling price review`
        : `Stock now ${product.stockQuantity} ${product.unit}`,
      channel: 'dashboard',
      createdAt: now,
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('products').update(productToRow(product)).eq('id', product.id).eq('shop_id', shopId);
      await sb.from('purchases').insert(purchaseToRow(purchase));
      await sb.from('activities').insert(activityToRow(activity));
      if (notification) await sb.from('staff_notifications').insert(notificationToRow(notification));
    } else {
      const idx = this.state.products.findIndex((p) => p.id === product.id && p.shopId === shopId);
      if (idx !== -1) this.state.products[idx] = product;
      this.state.purchases.unshift(purchase);
      this.state.activities.unshift(activity);
      if (notification) this.state.notifications.unshift(notification);
      this.persistLocal();
    }

    return { product, purchase };
  }

  public async recordStockAdjustmentWithReason(
    shopId: string,
    input: {
      productId: string;
      quantityDelta: number;
      reason: StockAdjustmentReason;
      note?: string;
      actorName: string;
      actorRole: StaffRole;
    }
  ): Promise<{ product: Product; loss?: StockLossRecord } | undefined> {
    const product = await this.getProductInShop(shopId, input.productId);
    if (!product) return undefined;

    const now = new Date().toISOString();
    const oldStock = product.stockQuantity;
    const nextStock = Math.max(0, oldStock + Math.round(input.quantityDelta));
    const actualDiff = nextStock - oldStock;
    product.stockQuantity = nextStock;
    product.updatedAt = now;
    product.updatedBy = input.actorName;

    let loss: StockLossRecord | undefined;
    const isLossReason =
      input.reason === 'damaged' ||
      input.reason === 'expired' ||
      input.reason === 'theft_or_missing' ||
      (input.reason === 'stock_count_variance' && actualDiff < 0);

    let activity: ActivityLog;

    if (isLossReason && actualDiff < 0) {
      const lostQty = Math.abs(actualDiff);
      const lossValue = lostQty * product.costPrice;
      loss = {
        id: `loss_${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        productId: product.id,
        productName: `${product.name} (${product.packSize})`,
        lossType: input.reason as StockLossRecord['lossType'],
        quantity: lostQty,
        unit: product.unit,
        unitCost: product.costPrice,
        estimatedLossValue: lossValue,
        reason: input.note?.trim() || `Recorded ${input.reason.replace(/_/g, ' ')}`,
        recordedBy: input.actorName,
        createdAt: now,
      };
      activity = {
        id: `act_${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        type: 'stock_loss',
        actorName: input.actorName,
        actorRole: input.actorRole,
        productId: product.id,
        productName: `${product.name} (${product.packSize})`,
        summary: `Recorded ${lostQty} ${product.unit} ${input.reason.replace(/_/g, ' ')} (₦${lossValue.toLocaleString('en-NG')} cost loss)`,
        detail: `${oldStock} → ${nextStock} ${product.unit}${input.note ? ` · ${input.note}` : ''}`,
        channel: 'dashboard',
        createdAt: now,
      };
    } else {
      activity = {
        id: `act_${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        type: 'stock_adjustment',
        actorName: input.actorName,
        actorRole: input.actorRole,
        productId: product.id,
        productName: `${product.name} (${product.packSize})`,
        summary: `Stock adjusted (${input.reason.replace(/_/g, ' ')}): ${oldStock} → ${nextStock} ${product.unit}`,
        detail: input.note?.trim() || undefined,
        channel: 'dashboard',
        createdAt: now,
      };
    }

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('products').update(productToRow(product)).eq('id', product.id).eq('shop_id', shopId);
      if (loss) await sb.from('stock_losses').insert(lossToRow(loss));
      await sb.from('activities').insert(activityToRow(activity));
    } else {
      const idx = this.state.products.findIndex((p) => p.id === product.id && p.shopId === shopId);
      if (idx !== -1) this.state.products[idx] = product;
      if (loss) this.state.stockLosses.unshift(loss);
      this.state.activities.unshift(activity);
      this.persistLocal();
    }

    return { product, loss };
  }

  public async submitPhysicalStockCount(
    shopId: string,
    counts: Array<{ productId: string; countedQuantity: number }>,
    actorName: string,
    actorRole: StaffRole
  ): Promise<{
    adjustedCount: number;
    totalVarianceUnits: number;
    totalShrinkageValue: number;
    variances: Array<{
      productId: string;
      productName: string;
      expected: number;
      counted: number;
      variance: number;
      costImpact: number;
    }>;
  }> {
    const now = new Date().toISOString();
    const variances: Array<{
      productId: string;
      productName: string;
      expected: number;
      counted: number;
      variance: number;
      costImpact: number;
    }> = [];

    let adjustedCount = 0;
    let totalVarianceUnits = 0;
    let totalShrinkageValue = 0;

    const updatedProducts: Product[] = [];
    const newLosses: StockLossRecord[] = [];

    for (const entry of counts) {
      const product = await this.getProductInShop(shopId, entry.productId);
      if (!product) continue;
      const counted = Math.max(0, Math.floor(Number(entry.countedQuantity)));
      const expected = product.stockQuantity;
      const variance = counted - expected;

      if (variance !== 0) {
        adjustedCount += 1;
        totalVarianceUnits += variance;
        const costImpact = variance * product.costPrice;

        variances.push({
          productId: product.id,
          productName: `${product.name} (${product.packSize})`,
          expected,
          counted,
          variance,
          costImpact,
        });

        product.stockQuantity = counted;
        product.updatedAt = now;
        product.updatedBy = actorName;
        updatedProducts.push(product);

        if (variance < 0) {
          const lossVal = Math.abs(variance) * product.costPrice;
          totalShrinkageValue += lossVal;
          newLosses.push({
            id: `loss_${crypto.randomUUID().slice(0, 8)}`,
            shopId,
            productId: product.id,
            productName: `${product.name} (${product.packSize})`,
            lossType: 'stock_count_variance',
            quantity: Math.abs(variance),
            unit: product.unit,
            unitCost: product.costPrice,
            estimatedLossValue: lossVal,
            reason: `Physical stock count variance (expected ${expected}, counted ${counted})`,
            recordedBy: actorName,
            createdAt: now,
          });
        }
      }
    }

    const activity: ActivityLog = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      type: 'stock_count',
      actorName,
      actorRole,
      summary: `Completed physical stock count (${adjustedCount} item variance${adjustedCount === 1 ? '' : 's'})`,
      detail:
        totalShrinkageValue > 0
          ? `Recorded ₦${totalShrinkageValue.toLocaleString('en-NG')} shrinkage variance`
          : 'All counted quantities reconciled cleanly',
      channel: 'dashboard',
      createdAt: now,
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      if (updatedProducts.length > 0) {
        await sb.from('products').upsert(updatedProducts.map(productToRow));
      }
      if (newLosses.length > 0) {
        await sb.from('stock_losses').insert(newLosses.map(lossToRow));
      }
      await sb.from('activities').insert(activityToRow(activity));
    } else {
      for (const up of updatedProducts) {
        const idx = this.state.products.findIndex((p) => p.id === up.id && p.shopId === shopId);
        if (idx !== -1) this.state.products[idx] = up;
      }
      this.state.stockLosses.unshift(...newLosses);
      this.state.activities.unshift(activity);
      this.persistLocal();
    }

    return {
      adjustedCount,
      totalVarianceUnits,
      totalShrinkageValue,
      variances,
    };
  }

  public async deleteProduct(shopId: string, productId: string): Promise<boolean> {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from('products')
        .delete()
        .eq('shop_id', shopId)
        .eq('id', productId)
        .select('id');
      return Boolean(data && data.length > 0);
    }

    const idx = this.state.products.findIndex((p) => p.shopId === shopId && p.id === productId);
    if (idx === -1) return false;
    this.state.products.splice(idx, 1);
    this.persistLocal();
    return true;
  }

  // ---------- Staff ----------
  public async getStaffForShop(shopId: string): Promise<StaffMember[]> {
    const sb = getSupabaseAdmin();
    if (sb) {
      await this.ensureSupabaseSeeded();
      const { data } = await sb.from('staff').select('*').eq('shop_id', shopId);
      return (data || []).map((r) => rowToStaff(r as Record<string, unknown>));
    }
    return this.state.staff.filter((s) => s.shopId === shopId);
  }

  public async findStaffByPhoneInShop(shopId: string, phone: string): Promise<StaffMember | undefined> {
    const targetKey = canonicalPhoneKey(phone);
    if (!targetKey) return undefined;
    const members = await this.getStaffForShop(shopId);
    return members.find((s) => canonicalPhoneKey(s.phone) === targetKey);
  }

  public async addStaffMember(
    shopId: string,
    input: {
      name: string;
      phone: string;
      role: StaffRole;
      actorName: string;
    }
  ): Promise<StaffMember> {
    const now = new Date().toISOString();
    const member: StaffMember = {
      id: `staff_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      name: input.name.trim(),
      phone: normalizePhoneDisplay(input.phone),
      role: input.role,
      active: true,
      createdAt: now,
    };

    const activity: ActivityLog = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      type: 'staff_updated',
      actorName: input.actorName,
      actorRole: 'owner',
      summary: `Added ${member.name} (${member.role})`,
      detail: `WhatsApp access number: ${member.phone}`,
      channel: 'dashboard',
      createdAt: now,
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('staff').insert(staffToRow(member));
      await sb.from('activities').insert(activityToRow(activity));
    } else {
      this.state.staff.push(member);
      this.state.activities.unshift(activity);
      this.persistLocal();
    }

    return member;
  }

  public async updateStaffMember(
    shopId: string,
    staffId: string,
    patch: { role?: StaffRole; active?: boolean; name?: string; phone?: string; actorName: string }
  ): Promise<StaffMember | undefined> {
    const members = await this.getStaffForShop(shopId);
    const member = members.find((s) => s.id === staffId);
    if (!member) return undefined;

    if (patch.role) member.role = patch.role;
    if (typeof patch.active === 'boolean') member.active = patch.active;
    if (typeof patch.name === 'string' && patch.name.trim()) member.name = patch.name.trim();
    if (typeof patch.phone === 'string' && patch.phone.trim()) {
      member.phone = normalizePhoneDisplay(patch.phone);
    }

    const activity: ActivityLog = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      type: 'staff_updated',
      actorName: patch.actorName,
      actorRole: 'owner',
      summary: `Updated ${member.name} (${member.role} · ${member.active ? 'Active' : 'Suspended'})`,
      channel: 'dashboard',
      createdAt: new Date().toISOString(),
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('staff').update(staffToRow(member)).eq('id', staffId).eq('shop_id', shopId);
      await sb.from('activities').insert(activityToRow(activity));
    } else {
      const idx = this.state.staff.findIndex((s) => s.id === staffId && s.shopId === shopId);
      if (idx !== -1) this.state.staff[idx] = member;
      this.state.activities.unshift(activity);
      this.persistLocal();
    }

    return member;
  }

  // ---------- Activities, Notifications, Idempotency & WhatsApp Threads ----------
  public async getActivitiesForShop(shopId: string): Promise<ActivityLog[]> {
    const sb = getSupabaseAdmin();
    if (sb) {
      await this.ensureSupabaseSeeded();
      const { data } = await sb
        .from('activities')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(200);
      return (data || []).map((r) => rowToActivity(r as Record<string, unknown>));
    }
    return this.state.activities
      .filter((a) => a.shopId === shopId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async markNotificationsRead(shopId: string): Promise<void> {
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('staff_notifications').update({ read: true }).eq('shop_id', shopId);
      return;
    }
    for (const notif of this.state.notifications) {
      if (notif.shopId === shopId) notif.read = true;
    }
    this.persistLocal();
  }

  public async logActivity(entry: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog> {
    const log: ActivityLog = {
      ...entry,
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('activities').insert(activityToRow(log));
    } else {
      this.state.activities.unshift(log);
      if (this.state.activities.length > 500) {
        this.state.activities = this.state.activities.slice(0, 500);
      }
      this.persistLocal();
    }
    return log;
  }

  public async isMessageProcessed(messageId: string): Promise<boolean> {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from('processed_messages')
        .select('message_id')
        .eq('message_id', messageId)
        .maybeSingle();
      return Boolean(data);
    }
    return this.state.processedMessageIds.includes(messageId);
  }

  public async markMessageProcessed(messageId: string): Promise<void> {
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('processed_messages').upsert({
        message_id: messageId,
        created_at: new Date().toISOString(),
      });
      return;
    }
    if (!this.state.processedMessageIds.includes(messageId)) {
      this.state.processedMessageIds.push(messageId);
      if (this.state.processedMessageIds.length > 1000) {
        this.state.processedMessageIds = this.state.processedMessageIds.slice(-1000);
      }
      this.persistLocal();
    }
  }

  public async getWhatsAppThread(shopId: string, phone: string): Promise<WhatsAppThreadState> {
    const key = `${shopId}::${canonicalPhoneKey(phone) || normalizePhoneDisplay(phone)}`;
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from('whatsapp_threads')
        .select('*')
        .eq('thread_key', key)
        .maybeSingle();
      if (data) {
        return {
          threadKey: String(data.thread_key),
          shopId: String(data.shop_id),
          phone: String(data.phone),
          history: Array.isArray(data.history) ? (data.history as ChatHistoryTurn[]) : [],
          pendingConfirmation: (data.pending_confirmation as PendingConfirmation) || null,
          updatedAt: String(data.updated_at),
        };
      }
    } else if (this.state.whatsappThreads[key]) {
      return this.state.whatsappThreads[key];
    }

    return {
      threadKey: key,
      shopId,
      phone: canonicalPhoneKey(phone) || normalizePhoneDisplay(phone),
      history: [],
      pendingConfirmation: null,
      updatedAt: new Date().toISOString(),
    };
  }

  public async saveWhatsAppThread(
    shopId: string,
    phone: string,
    next: { history: ChatHistoryTurn[]; pendingConfirmation: PendingConfirmation | null }
  ): Promise<void> {
    const canonical = canonicalPhoneKey(phone) || normalizePhoneDisplay(phone);
    const key = `${shopId}::${canonical}`;
    const trimmedHistory = next.history.slice(-8);
    const now = new Date().toISOString();

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('whatsapp_threads').upsert({
        thread_key: key,
        shop_id: shopId,
        phone: canonical,
        history: trimmedHistory,
        pending_confirmation: next.pendingConfirmation,
        updated_at: now,
      });
      return;
    }

    this.state.whatsappThreads[key] = {
      threadKey: key,
      shopId,
      phone: canonical,
      history: trimmedHistory,
      pendingConfirmation: next.pendingConfirmation,
      updatedAt: now,
    };
    this.persistLocal();
  }

  // ---------- Dashboard Snapshot ----------
  public async getDashboardSnapshot(shopId: string, requesterUserId?: string) {
    const shop = await this.getShopById(shopId);
    if (!shop) return undefined;

    const sb = getSupabaseAdmin();
    const [allShops, products, staff, activities] = await Promise.all([
      this.getAccessibleShops(requesterUserId),
      this.getProductsForShop(shopId),
      this.getStaffForShop(shopId),
      this.getActivitiesForShop(shopId),
    ]);

    let purchases: PurchaseRecord[];
    let stockLosses: StockLossRecord[];
    let notifications: StaffNotification[];

    if (sb) {
      const [purRes, lossRes, notifRes] = await Promise.all([
        sb
          .from('purchases')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false }),
        sb
          .from('stock_losses')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false }),
        sb
          .from('staff_notifications')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false }),
      ]);
      purchases = (purRes.data || []).map((r) => rowToPurchase(r as Record<string, unknown>));
      stockLosses = (lossRes.data || []).map((r) => rowToLoss(r as Record<string, unknown>));
      notifications = (notifRes.data || []).map((r) =>
        rowToNotification(r as Record<string, unknown>)
      );
    } else {
      purchases = this.state.purchases
        .filter((p) => p.shopId === shopId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      stockLosses = this.state.stockLosses
        .filter((l) => l.shopId === shopId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      notifications = this.state.notifications
        .filter((n) => n.shopId === shopId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const nowMs = Date.now();
    const thirtyDaysMs = 30 * 86_400_000;

    let expiringSoonCount = 0;
    let expiredCount = 0;
    let marginSum = 0;
    let marginCount = 0;

    for (const p of products) {
      if (p.expiryDate) {
        const expMs = new Date(p.expiryDate).getTime();
        if (expMs < startOfToday.getTime()) {
          expiredCount += 1;
        } else if (expMs - nowMs <= thirtyDaysMs) {
          expiringSoonCount += 1;
        }
      }
      if (p.sellingPrice > 0) {
        marginSum += ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100;
        marginCount += 1;
      }
    }

    const lowStockCount = products.filter((p) => p.stockQuantity <= p.reorderLevel).length;
    const outOfStockCount = products.filter((p) => p.stockQuantity === 0).length;
    const enquiriesToday = activities.filter(
      (a) => a.type === 'enquiry' && new Date(a.createdAt) >= startOfToday
    ).length;
    const inventoryValue = products.reduce(
      (sum, p) => sum + p.sellingPrice * p.stockQuantity,
      0
    );
    const priceReviewCount = products.filter((p) => p.priceReviewFlag).length;
    const totalLossValue = stockLosses.reduce((sum, l) => sum + l.estimatedLossValue, 0);
    const avgGrossMarginPct = marginCount > 0 ? Number((marginSum / marginCount).toFixed(1)) : 0;

    return {
      shop,
      allShops,
      products,
      staff,
      activities,
      purchases,
      stockLosses,
      notifications,
      stats: {
        totalProducts: products.length,
        lowStockCount,
        outOfStockCount,
        enquiriesToday,
        inventoryValue,
        priceReviewCount,
        expiringSoonCount,
        expiredCount,
        totalLossValue,
        avgGrossMarginPct,
      },
    };
  }

  // ---------- Waitlist ----------
  public async getWaitlistEntries(): Promise<WaitlistEntry[]> {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from('waitlist')
        .select('*')
        .order('created_at', { ascending: true });
      return (data || []).map((r) => rowToWaitlist(r as Record<string, unknown>));
    }
    return this.state.waitlist;
  }

  public async getWaitlistSummary(): Promise<WaitlistSummary> {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { count } = await sb.from('waitlist').select('id', { count: 'exact', head: true });
      return { totalCount: count ?? 0 };
    }
    return { totalCount: this.state.waitlist.length };
  }

  public async joinWaitlist(input: {
    fullName: string;
    shopName: string;
    city: string;
    email: string;
    whatsappNumber: string;
    storeCategory: StoreCategoryOption;
    staffCountRange: StaffCountRange;
  }): Promise<WaitlistJoinResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhone = normalizePhoneDisplay(input.whatsappNumber);
    const existingList = await this.getWaitlistEntries();

    const existingIdx = existingList.findIndex((item) => {
      const emailMatch =
        Boolean(normalizedEmail) && item.email.trim().toLowerCase() === normalizedEmail;
      const phoneMatch =
        Boolean(normalizedPhone) &&
        canonicalPhoneKey(item.whatsappNumber) === canonicalPhoneKey(normalizedPhone);
      return emailMatch || phoneMatch;
    });

    if (existingIdx !== -1) {
      return {
        position: existingIdx + 1,
        totalCount: existingList.length,
        alreadyJoined: true,
      };
    }

    const entry: WaitlistEntry = {
      id: `wl_${crypto.randomUUID().slice(0, 8)}`,
      fullName: input.fullName.trim(),
      shopName: input.shopName.trim(),
      city: input.city.trim(),
      email: normalizedEmail,
      whatsappNumber: normalizedPhone,
      storeCategory: input.storeCategory,
      staffCountRange: input.staffCountRange,
      createdAt: new Date().toISOString(),
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('waitlist').insert({
        id: entry.id,
        full_name: entry.fullName,
        shop_name: entry.shopName,
        city: entry.city,
        email: entry.email,
        whatsapp_number: entry.whatsappNumber,
        store_category: entry.storeCategory,
        staff_count_range: entry.staffCountRange,
        created_at: entry.createdAt,
      });
    } else {
      this.state.waitlist.push(entry);
      this.persistLocal();
      void syncWaitlistExcelFile(this.state.waitlist);
    }

    const nextTotal = existingList.length + 1;
    return {
      entry: {
        id: entry.id,
        fullName: entry.fullName,
        shopName: entry.shopName,
        city: entry.city,
        storeCategory: entry.storeCategory,
        staffCountRange: entry.staffCountRange,
        createdAt: entry.createdAt,
      },
      position: nextTotal,
      totalCount: nextTotal,
      alreadyJoined: false,
    };
  }
}

export const store = new SmartStoreRepository();
