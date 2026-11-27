export type StaffRole = 'owner' | 'manager' | 'attendant';

export type SubscriptionPlanId = 'starter' | 'growth' | 'multi_branch';

export type StockAdjustmentReason =
  | 'restock'
  | 'sale'
  | 'damaged'
  | 'expired'
  | 'theft_or_missing'
  | 'stock_count_variance'
  | 'correction';

export interface Shop {
  id: string;
  name: string;
  location: string;
  category: string;
  whatsappNumber: string;
  whatsappConnected: boolean;
  planId: SubscriptionPlanId;
  createdAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  packSize: string;
  sku: string;
  category: string;
  costPrice: number; // Supplier unit cost in Naira (₦)
  sellingPrice: number; // Current selling price in Naira (₦)
  previousSellingPrice: number | null;
  lastPriceUpdateAt: string;
  supplierName: string;
  stockQuantity: number;
  unit: string;
  reorderLevel: number;
  expiryDate: string | null; // ISO YYYY-MM-DD
  priceReviewFlag: boolean;
  priceReviewReason?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface PurchaseRecord {
  id: string;
  shopId: string;
  productId: string;
  productName: string;
  supplierName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  previousCostPrice: number;
  totalCost: number;
  costIncreased: boolean;
  note?: string;
  recordedBy: string;
  createdAt: string;
}

export interface StockLossRecord {
  id: string;
  shopId: string;
  productId: string;
  productName: string;
  lossType: 'damaged' | 'expired' | 'theft_or_missing' | 'stock_count_variance';
  quantity: number;
  unit: string;
  unitCost: number;
  estimatedLossValue: number;
  reason: string;
  recordedBy: string;
  createdAt: string;
}

export interface StaffNotification {
  id: string;
  shopId: string;
  type: 'price_change' | 'price_review' | 'expiry_alert' | 'stock_loss';
  title: string;
  message: string;
  actorName: string;
  read: boolean;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
}

export type ActivityType =
  | 'enquiry'
  | 'price_change'
  | 'stock_adjustment'
  | 'stock_loss'
  | 'purchase'
  | 'stock_count'
  | 'product_added'
  | 'staff_updated'
  | 'access_denied';

export interface ActivityLog {
  id: string;
  shopId: string;
  type: ActivityType;
  actorName: string;
  actorRole: StaffRole | 'external';
  actorPhone?: string;
  productId?: string;
  productName?: string;
  summary: string;
  detail?: string;
  channel: 'dashboard' | 'whatsapp';
  createdAt: string;
}

export interface WhatsAppCandidateOption {
  productId: string;
  label: string;
  packSize: string;
  sellingPrice: number;
  stockQuantity: number;
  unit: string;
}

export interface PendingConfirmation {
  actionType: 'price_change' | 'stock_adjustment';
  productId: string;
  productLabel: string;
  newPrice?: number;
  stockDelta?: number;
  newStockQuantity?: number;
  reason?: string;
}

export interface WhatsAppChatMessage {
  id: string;
  sender: 'attendant' | 'assistant';
  text: string;
  timestamp: string;
  senderName?: string;
  senderRole?: StaffRole | 'external';
  options?: WhatsAppCandidateOption[];
  pendingConfirmation?: PendingConfirmation;
  isAudio?: boolean;
  transcript?: string;
  accessDenied?: boolean;
}

export interface DashboardSnapshot {
  shop: Shop;
  allShops: Shop[];
  products: Product[];
  staff: StaffMember[];
  activities: ActivityLog[];
  purchases: PurchaseRecord[];
  stockLosses: StockLossRecord[];
  notifications: StaffNotification[];
  stats: {
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    enquiriesToday: number;
    inventoryValue: number;
    priceReviewCount: number;
    expiringSoonCount: number;
    expiredCount: number;
    totalLossValue: number;
    avgGrossMarginPct: number;
  };
}

export type StoreCategoryOption =
  | 'Supermarket'
  | 'Provision store'
  | 'Mini-mart'
  | 'Wholesale'
  | 'Pharmacy'
  | 'Other retail';

export type StaffCountRange = '1-3' | '4-10' | '11+';

export interface WaitlistEntry {
  id: string;
  fullName: string;
  shopName: string;
  city: string;
  email: string;
  whatsappNumber: string;
  storeCategory: StoreCategoryOption;
  staffCountRange: StaffCountRange;
  createdAt: string;
}

export interface WaitlistSummary {
  totalCount: number;
}

export interface WaitlistJoinResponse {
  entry?: {
    id: string;
    fullName: string;
    shopName: string;
    city: string;
    storeCategory: StoreCategoryOption;
    staffCountRange: StaffCountRange;
    createdAt: string;
  };
  position: number;
  totalCount: number;
  alreadyJoined: boolean;
}

