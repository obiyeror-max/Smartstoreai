import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  ActivityLog,
  Product,
  PurchaseRecord,
  Shop,
  StaffMember,
  StaffNotification,
  StaffRole,
  StockAdjustmentReason,
  StockLossRecord,
  SubscriptionPlanId,
} from '../src/types.ts';

interface DatabaseState {
  shops: Shop[];
  products: Product[];
  staff: StaffMember[];
  activities: ActivityLog[];
  purchases: PurchaseRecord[];
  stockLosses: StockLossRecord[];
  notifications: StaffNotification[];
  processedMessageIds: string[];
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

function createSeedState(): DatabaseState {
  const shop1Id = 'shop_adebayo_lagos';
  const shop2Id = 'shop_zainab_abuja';

  const shops: Shop[] = [
    {
      id: shop1Id,
      name: 'Adebayo Provisions & Supermarket',
      location: 'Surulere, Lagos',
      category: 'Supermarket & Provisions',
      whatsappNumber: '+234 803 555 0100',
      whatsappConnected: true,
      planId: 'growth',
      createdAt: hoursAgo(240),
    },
    {
      id: shop2Id,
      name: 'Zainab Fresh Mart',
      location: 'Wuse II, Abuja',
      category: 'Mini-Mart & Groceries',
      whatsappNumber: '+234 809 555 0200',
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
      expiryDate: daysFromNowDate(16), // Approaching expiry!
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
      expiryDate: daysFromNowDate(21), // Approaching expiry!
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
      expiryDate: daysFromNowDate(-4), // Expired batch alert!
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

    // Shop 2: Zainab Fresh Mart (Abuja)
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
      actorName: 'SmartStore Price Assistant',
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
    shops,
    products,
    staff,
    activities,
    purchases,
    stockLosses,
    notifications,
    processedMessageIds: [],
  };
}

function migrateProduct(p: Partial<Product> & Pick<Product, 'id' | 'shopId' | 'name' | 'sellingPrice' | 'stockQuantity' | 'unit' | 'reorderLevel' | 'updatedAt' | 'updatedBy'>): Product {
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

class SmartStoreRepository {
  private state: DatabaseState;

  constructor() {
    this.state = this.load();
  }

  private load(): DatabaseState {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<DatabaseState>;
        if (parsed && Array.isArray(parsed.shops) && Array.isArray(parsed.products)) {
          const seed = createSeedState();
          const migrated: DatabaseState = {
            shops: parsed.shops,
            products: parsed.products.map((p) => migrateProduct(p)),
            staff: parsed.staff || [],
            activities: parsed.activities || [],
            purchases: parsed.purchases || seed.purchases,
            stockLosses: parsed.stockLosses || seed.stockLosses,
            notifications: parsed.notifications || seed.notifications,
            processedMessageIds: parsed.processedMessageIds || [],
          };
          return migrated;
        }
      }
    } catch (err) {
      console.error('Failed to load store file, recreating seed state:', err);
    }
    const seed = createSeedState();
    this.persist(seed);
    return seed;
  }

  private persist(nextState: DatabaseState = this.state): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(nextState, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.warn('Could not persist state to disk (continuing in-memory):', err);
    }
  }

  public normalizePhone(phone: string): string {
    return phone.replace(/[\s\-()]/g, '').trim();
  }

  public getAllShops(): Shop[] {
    return this.state.shops;
  }

  public getShopById(shopId: string): Shop | undefined {
    return this.state.shops.find((s) => s.id === shopId);
  }

  public getShopByWhatsappNumber(phone: string): Shop | undefined {
    const normalized = this.normalizePhone(phone);
    return this.state.shops.find(
      (s) => this.normalizePhone(s.whatsappNumber) === normalized
    );
  }

  public createShop(input: {
    name: string;
    location: string;
    category: string;
    whatsappNumber: string;
    ownerName: string;
    ownerPhone: string;
    planId: SubscriptionPlanId;
  }): Shop {
    const id = `shop_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const shop: Shop = {
      id,
      name: input.name.trim(),
      location: input.location.trim(),
      category: input.category.trim() || 'Supermarket & Provisions',
      whatsappNumber: input.whatsappNumber.trim(),
      whatsappConnected: true,
      planId: input.planId || 'starter',
      createdAt: now,
    };
    this.state.shops.push(shop);

    const owner: StaffMember = {
      id: `staff_${crypto.randomUUID().slice(0, 8)}`,
      shopId: id,
      name: input.ownerName.trim(),
      phone: this.normalizePhone(input.ownerPhone),
      role: 'owner',
      active: true,
      createdAt: now,
    };
    this.state.staff.push(owner);

    this.state.activities.unshift({
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId: id,
      type: 'staff_updated',
      actorName: owner.name,
      actorRole: 'owner',
      summary: `Created shop account "${shop.name}"`,
      detail: `Connected WhatsApp Business number ${shop.whatsappNumber}`,
      channel: 'dashboard',
      createdAt: now,
    });

    this.persist();
    return shop;
  }

  public updateShopConfig(
    shopId: string,
    patch: Partial<Pick<Shop, 'whatsappNumber' | 'whatsappConnected' | 'planId' | 'name' | 'location'>>
  ): Shop | undefined {
    const shop = this.getShopById(shopId);
    if (!shop) return undefined;
    if (typeof patch.name === 'string' && patch.name.trim()) shop.name = patch.name.trim();
    if (typeof patch.location === 'string' && patch.location.trim()) shop.location = patch.location.trim();
    if (typeof patch.whatsappNumber === 'string' && patch.whatsappNumber.trim()) {
      shop.whatsappNumber = patch.whatsappNumber.trim();
    }
    if (typeof patch.whatsappConnected === 'boolean') {
      shop.whatsappConnected = patch.whatsappConnected;
    }
    if (patch.planId) {
      shop.planId = patch.planId;
    }
    this.persist();
    return shop;
  }

  public getProductsForShop(shopId: string): Product[] {
    return this.state.products
      .filter((p) => p.shopId === shopId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public getProductInShop(shopId: string, productId: string): Product | undefined {
    return this.state.products.find((p) => p.shopId === shopId && p.id === productId);
  }

  public createProduct(
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
  ): Product {
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
    this.state.products.push(product);

    this.state.activities.unshift({
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
    });

    this.persist();
    return product;
  }

  public bulkImportProducts(
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
  ): Product[] {
    const now = new Date().toISOString();
    const created: Product[] = [];
    for (const item of items) {
      if (!item.name?.trim()) continue;
      const selling = Math.max(0, Number(item.sellingPrice) || 0);
      const cost =
        item.costPrice !== undefined && !Number.isNaN(Number(item.costPrice))
          ? Math.max(0, Number(item.costPrice))
          : Math.round(selling * 0.85);
      const product: Product = {
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
      };
      this.state.products.push(product);
      created.push(product);
    }

    if (created.length > 0) {
      this.state.activities.unshift({
        id: `act_${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        type: 'product_added',
        actorName,
        actorRole,
        summary: `Imported ${created.length} products via CSV`,
        detail: created.slice(0, 3).map((p) => p.name).join(', ') + (created.length > 3 ? '...' : ''),
        channel: 'dashboard',
        createdAt: now,
      });
      this.persist();
    }
    return created;
  }

  public updateProduct(
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
  ): Product | undefined {
    const product = this.getProductInShop(shopId, productId);
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

    // Flag price review if cost increased without selling price also changing in this edit
    if (product.costPrice > oldCost && product.sellingPrice === oldPrice) {
      product.priceReviewFlag = true;
      product.priceReviewReason = `Cost price rose from ₦${oldCost.toLocaleString('en-NG')} to ₦${product.costPrice.toLocaleString('en-NG')}`;
    }

    if (product.sellingPrice !== oldPrice) {
      product.previousSellingPrice = oldPrice;
      product.lastPriceUpdateAt = now;
      product.priceReviewFlag = false;
      product.priceReviewReason = undefined;

      this.state.activities.unshift({
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

      this.state.notifications.unshift({
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
      this.state.activities.unshift({
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

    this.persist();
    return product;
  }

  public dismissPriceReview(shopId: string, productId: string, actorName: string, actorRole: StaffRole): Product | undefined {
    const product = this.getProductInShop(shopId, productId);
    if (!product) return undefined;
    const now = new Date().toISOString();
    product.priceReviewFlag = false;
    product.priceReviewReason = undefined;
    product.lastPriceUpdateAt = now;
    product.updatedAt = now;
    product.updatedBy = actorName;

    this.state.activities.unshift({
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
    });

    this.persist();
    return product;
  }

  public recordPurchase(
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
  ): { product: Product; purchase: PurchaseRecord } | undefined {
    const product = this.getProductInShop(shopId, input.productId);
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

    if (costIncreased) {
      const marginPct =
        product.sellingPrice > 0
          ? (((product.sellingPrice - unitCost) / product.sellingPrice) * 100).toFixed(1)
          : '0.0';
      product.priceReviewFlag = true;
      product.priceReviewReason = `Supplier cost rose from ₦${prevCost.toLocaleString('en-NG')} to ₦${unitCost.toLocaleString('en-NG')} (margin now ${marginPct}%)`;

      this.state.notifications.unshift({
        id: `notif_${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        type: 'price_review',
        title: `Price review recommended: ${product.name}`,
        message: `Cost increased from ₦${prevCost.toLocaleString('en-NG')} to ₦${unitCost.toLocaleString('en-NG')}. Review selling price (₦${product.sellingPrice.toLocaleString('en-NG')}).`,
        actorName: input.actorName,
        read: false,
        createdAt: now,
      });
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
    this.state.purchases.unshift(purchase);

    this.state.activities.unshift({
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
    });

    this.persist();
    return { product, purchase };
  }

  public recordStockAdjustmentWithReason(
    shopId: string,
    input: {
      productId: string;
      quantityDelta: number; // positive for add, negative for deduct
      reason: StockAdjustmentReason;
      note?: string;
      actorName: string;
      actorRole: StaffRole;
    }
  ): { product: Product; loss?: StockLossRecord } | undefined {
    const product = this.getProductInShop(shopId, input.productId);
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
      this.state.stockLosses.unshift(loss);

      this.state.activities.unshift({
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
      });
    } else {
      this.state.activities.unshift({
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
      });
    }

    this.persist();
    return { product, loss };
  }

  public submitPhysicalStockCount(
    shopId: string,
    counts: Array<{ productId: string; countedQuantity: number }>,
    actorName: string,
    actorRole: StaffRole
  ): {
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
  } {
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

    for (const entry of counts) {
      const product = this.getProductInShop(shopId, entry.productId);
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

        if (variance < 0) {
          const lossVal = Math.abs(variance) * product.costPrice;
          totalShrinkageValue += lossVal;
          this.state.stockLosses.unshift({
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

    this.state.activities.unshift({
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
    });

    this.persist();
    return {
      adjustedCount,
      totalVarianceUnits,
      totalShrinkageValue,
      variances,
    };
  }

  public deleteProduct(shopId: string, productId: string): boolean {
    const idx = this.state.products.findIndex((p) => p.shopId === shopId && p.id === productId);
    if (idx === -1) return false;
    this.state.products.splice(idx, 1);
    this.persist();
    return true;
  }

  public getStaffForShop(shopId: string): StaffMember[] {
    return this.state.staff.filter((s) => s.shopId === shopId);
  }

  public findStaffByPhoneInShop(shopId: string, phone: string): StaffMember | undefined {
    const normalized = this.normalizePhone(phone);
    return this.state.staff.find(
      (s) => s.shopId === shopId && this.normalizePhone(s.phone) === normalized
    );
  }

  public addStaffMember(
    shopId: string,
    input: {
      name: string;
      phone: string;
      role: StaffRole;
      actorName: string;
    }
  ): StaffMember {
    const now = new Date().toISOString();
    const member: StaffMember = {
      id: `staff_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      name: input.name.trim(),
      phone: this.normalizePhone(input.phone),
      role: input.role,
      active: true,
      createdAt: now,
    };
    this.state.staff.push(member);

    this.state.activities.unshift({
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      type: 'staff_updated',
      actorName: input.actorName,
      actorRole: 'owner',
      summary: `Added ${member.name} (${member.role})`,
      detail: `WhatsApp access number: ${member.phone}`,
      channel: 'dashboard',
      createdAt: now,
    });

    this.persist();
    return member;
  }

  public updateStaffMember(
    shopId: string,
    staffId: string,
    patch: { role?: StaffRole; active?: boolean; name?: string; phone?: string; actorName: string }
  ): StaffMember | undefined {
    const member = this.state.staff.find((s) => s.shopId === shopId && s.id === staffId);
    if (!member) return undefined;

    if (patch.role) member.role = patch.role;
    if (typeof patch.active === 'boolean') member.active = patch.active;
    if (typeof patch.name === 'string' && patch.name.trim()) member.name = patch.name.trim();
    if (typeof patch.phone === 'string' && patch.phone.trim()) {
      member.phone = this.normalizePhone(patch.phone);
    }

    this.state.activities.unshift({
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      type: 'staff_updated',
      actorName: patch.actorName,
      actorRole: 'owner',
      summary: `Updated ${member.name} (${member.role} · ${member.active ? 'Active' : 'Suspended'})`,
      channel: 'dashboard',
      createdAt: new Date().toISOString(),
    });

    this.persist();
    return member;
  }

  public getActivitiesForShop(shopId: string): ActivityLog[] {
    return this.state.activities
      .filter((a) => a.shopId === shopId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public markNotificationsRead(shopId: string): void {
    for (const notif of this.state.notifications) {
      if (notif.shopId === shopId) notif.read = true;
    }
    this.persist();
  }

  public logActivity(entry: Omit<ActivityLog, 'id' | 'createdAt'>): ActivityLog {
    const log: ActivityLog = {
      ...entry,
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    this.state.activities.unshift(log);
    if (this.state.activities.length > 500) {
      this.state.activities = this.state.activities.slice(0, 500);
    }
    this.persist();
    return log;
  }

  public isMessageProcessed(messageId: string): boolean {
    return this.state.processedMessageIds.includes(messageId);
  }

  public markMessageProcessed(messageId: string): void {
    if (!this.state.processedMessageIds.includes(messageId)) {
      this.state.processedMessageIds.push(messageId);
      if (this.state.processedMessageIds.length > 1000) {
        this.state.processedMessageIds = this.state.processedMessageIds.slice(-1000);
      }
      this.persist();
    }
  }

  public getDashboardSnapshot(shopId: string) {
    const shop = this.getShopById(shopId);
    if (!shop) return undefined;

    const products = this.getProductsForShop(shopId);
    const staff = this.getStaffForShop(shopId);
    const activities = this.getActivitiesForShop(shopId);
    const purchases = this.state.purchases
      .filter((p) => p.shopId === shopId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const stockLosses = this.state.stockLosses
      .filter((l) => l.shopId === shopId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const notifications = this.state.notifications
      .filter((n) => n.shopId === shopId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
      allShops: this.getAllShops(),
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
}

export const store = new SmartStoreRepository();
