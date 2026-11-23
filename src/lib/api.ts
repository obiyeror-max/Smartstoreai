import type {
  DashboardSnapshot,
  PendingConfirmation,
  Product,
  PurchaseRecord,
  Shop,
  StaffMember,
  StaffRole,
  StockAdjustmentReason,
  StockLossRecord,
  SubscriptionPlanId,
} from '../types';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getHealth(): Promise<{
    ok: boolean;
    service: string;
    ai: { provider: 'groq' | 'gemini'; textModel: string; audioModel: string };
  }> {
    return requestJson('/api/health');
  },

  getDashboard(shopId: string): Promise<DashboardSnapshot> {
    return requestJson(`/api/shops/${encodeURIComponent(shopId)}/dashboard`);
  },

  listShops(): Promise<{ shops: Shop[] }> {
    return requestJson('/api/shops');
  },

  createShop(payload: {
    name: string;
    location: string;
    category: string;
    whatsappNumber: string;
    ownerName: string;
    ownerPhone: string;
    planId: SubscriptionPlanId;
  }): Promise<{ shop: Shop }> {
    return requestJson('/api/shops', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateShopConfig(
    shopId: string,
    payload: Partial<Pick<Shop, 'whatsappNumber' | 'whatsappConnected' | 'planId' | 'name' | 'location'>>
  ): Promise<{ shop: Shop }> {
    return requestJson(`/api/shops/${encodeURIComponent(shopId)}/config`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  createProduct(
    shopId: string,
    payload: {
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
  ): Promise<{ product: Product }> {
    return requestJson(`/api/shops/${encodeURIComponent(shopId)}/products`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  importProducts(
    shopId: string,
    payload: {
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
      }>;
      actorName: string;
      actorRole: StaffRole;
    }
  ): Promise<{ importedCount: number; products: Product[] }> {
    return requestJson(`/api/shops/${encodeURIComponent(shopId)}/products/import`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateProduct(
    shopId: string,
    productId: string,
    payload: Partial<Product> & { actorName: string; actorRole: StaffRole; reason?: string }
  ): Promise<{ product: Product }> {
    return requestJson(
      `/api/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(productId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  },

  deleteProduct(shopId: string, productId: string): Promise<{ ok: boolean }> {
    return requestJson(
      `/api/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(productId)}`,
      { method: 'DELETE' }
    );
  },

  dismissPriceReview(
    shopId: string,
    productId: string,
    payload: { actorName: string; actorRole: StaffRole }
  ): Promise<{ product: Product }> {
    return requestJson(
      `/api/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(productId)}/dismiss-review`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  recordPurchase(
    shopId: string,
    payload: {
      productId: string;
      supplierName: string;
      quantity: number;
      unitCost: number;
      expiryDate?: string | null;
      note?: string;
      actorName: string;
      actorRole: StaffRole;
    }
  ): Promise<{ product: Product; purchase: PurchaseRecord }> {
    return requestJson(`/api/shops/${encodeURIComponent(shopId)}/purchases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  recordStockLoss(
    shopId: string,
    payload: {
      productId: string;
      quantityDelta: number;
      reason: StockAdjustmentReason;
      note?: string;
      actorName: string;
      actorRole: StaffRole;
    }
  ): Promise<{ product: Product; loss?: StockLossRecord }> {
    return requestJson(`/api/shops/${encodeURIComponent(shopId)}/stock-loss`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  submitStockCount(
    shopId: string,
    payload: {
      counts: Array<{ productId: string; countedQuantity: number }>;
      actorName: string;
      actorRole: StaffRole;
    }
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
    return requestJson(`/api/shops/${encodeURIComponent(shopId)}/stock-count`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  markNotificationsRead(shopId: string): Promise<{ ok: boolean }> {
    return requestJson(`/api/shops/${encodeURIComponent(shopId)}/notifications/read`, {
      method: 'POST',
    });
  },

  addStaff(
    shopId: string,
    payload: { name: string; phone: string; role: StaffRole; actorName: string }
  ): Promise<{ member: StaffMember }> {
    return requestJson(`/api/shops/${encodeURIComponent(shopId)}/staff`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateStaff(
    shopId: string,
    staffId: string,
    payload: { role?: StaffRole; active?: boolean; name?: string; phone?: string; actorName: string }
  ): Promise<{ member: StaffMember }> {
    return requestJson(
      `/api/shops/${encodeURIComponent(shopId)}/staff/${encodeURIComponent(staffId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  },

  sendWhatsAppMessage(payload: {
    messageId: string;
    shopId: string;
    toBusinessPhone: string;
    fromPhone: string;
    messageText: string;
    history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    selectedProductId?: string;
    confirmedAction?: PendingConfirmation;
  }) {
    return requestJson<{
      status: 'ok' | 'duplicate' | 'error';
      replyText: string;
      senderName?: string;
      senderRole?: StaffRole | 'external';
      accessDenied?: boolean;
      options?: Array<{
        productId: string;
        label: string;
        packSize: string;
        sellingPrice: number;
        stockQuantity: number;
        unit: string;
      }>;
      pendingConfirmation?: PendingConfirmation;
      mutatedDatabase?: boolean;
      parsedIntent?: Record<string, unknown>;
    }>('/api/whatsapp/webhook', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  sendWhatsAppVoice(payload: {
    messageId: string;
    shopId: string;
    fromPhone: string;
    audioBase64: string;
    mimeType: string;
    history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  }) {
    return requestJson<{
      status: 'ok' | 'duplicate' | 'error';
      replyText: string;
      transcript: string;
      senderName?: string;
      senderRole?: StaffRole | 'external';
      accessDenied?: boolean;
      options?: Array<{
        productId: string;
        label: string;
        packSize: string;
        sellingPrice: number;
        stockQuantity: number;
        unit: string;
      }>;
      pendingConfirmation?: PendingConfirmation;
      mutatedDatabase?: boolean;
      parsedIntent?: Record<string, unknown>;
    }>('/api/whatsapp/voice', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
