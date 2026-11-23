import { store } from './store.ts';
import { generateGroundedWhatsAppReply } from './ai.ts';
import type { ChatHistoryTurn } from './ai.ts';
import type {
  PendingConfirmation,
  Product,
  WhatsAppCandidateOption,
} from '../src/types.ts';

export interface IncomingWhatsAppWebhook {
  messageId: string;
  shopId?: string;
  toBusinessPhone?: string;
  fromPhone: string;
  messageText: string;
  history?: ChatHistoryTurn[];
  selectedProductId?: string;
  confirmedAction?: PendingConfirmation;
}

export interface WhatsAppProcessorResult {
  status: 'ok' | 'duplicate' | 'error';
  replyText: string;
  senderName?: string;
  senderRole?: 'owner' | 'manager' | 'attendant' | 'external';
  accessDenied?: boolean;
  options?: WhatsAppCandidateOption[];
  pendingConfirmation?: PendingConfirmation;
  mutatedDatabase?: boolean;
  parsedIntent?: Record<string, unknown>;
}

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

function buildProductAnswer(product: Product, shopName: string): string {
  const unitPrice = formatNaira(product.sellingPrice);
  const stockLine =
    product.stockQuantity === 0
      ? `Recorded stock: 0 ${product.unit} (Out of stock)`
      : product.stockQuantity <= product.reorderLevel
      ? `Recorded stock: ${product.stockQuantity} ${product.unit} (Low stock — reorder level is ${product.reorderLevel})`
      : `Recorded stock: ${product.stockQuantity} ${product.unit}`;

  return [
    `${product.name} — ${product.packSize}`,
    `Selling price: ${unitPrice}`,
    stockLine,
    `SKU: ${product.sku} · ${shopName}`,
  ].join('\n');
}

export async function processIncomingWhatsAppEvent(
  payload: IncomingWhatsAppWebhook
): Promise<WhatsAppProcessorResult> {
  // 1. Duplicate webhook idempotency check
  if (payload.messageId && store.isMessageProcessed(payload.messageId)) {
    return {
      status: 'duplicate',
      replyText: 'Duplicate webhook event ignored safely.',
    };
  }

  // 2. Resolve Shop boundary
  const shop = payload.shopId
    ? store.getShopById(payload.shopId)
    : payload.toBusinessPhone
    ? store.getShopByWhatsappNumber(payload.toBusinessPhone)
    : undefined;

  if (!shop) {
    return {
      status: 'error',
      replyText: 'No connected SmartStore shop found for this WhatsApp number.',
      senderRole: 'external',
      accessDenied: true,
    };
  }

  if (!shop.whatsappConnected) {
    return {
      status: 'error',
      replyText: `${shop.name}'s WhatsApp assistant is currently paused by the owner.`,
      senderRole: 'external',
      accessDenied: true,
    };
  }

  // 3. Verify staff membership strictly inside THIS shop
  const staffMember = store.findStaffByPhoneInShop(shop.id, payload.fromPhone);
  if (!staffMember || !staffMember.active) {
    store.logActivity({
      shopId: shop.id,
      type: 'access_denied',
      actorName: payload.fromPhone,
      actorRole: 'external',
      actorPhone: payload.fromPhone,
      summary: `Blocked WhatsApp message from unregistered/inactive number (${payload.fromPhone})`,
      detail: `Message: "${payload.messageText.slice(0, 80)}"`,
      channel: 'whatsapp',
    });

    if (payload.messageId) store.markMessageProcessed(payload.messageId);

    return {
      status: 'ok',
      senderName: 'Unregistered Number',
      senderRole: 'external',
      accessDenied: true,
      replyText: `Access denied. Your number (${payload.fromPhone}) is not authorised for ${shop.name}. Ask the shop owner to add your number in Staff & permissions.`,
    };
  }

  if (payload.messageId) store.markMessageProcessed(payload.messageId);

  // 4. Handle explicit confirmation of a pending price/stock change
  if (payload.confirmedAction) {
    const action = payload.confirmedAction;
    if (staffMember.role === 'attendant') {
      store.logActivity({
        shopId: shop.id,
        type: 'access_denied',
        actorName: staffMember.name,
        actorRole: staffMember.role,
        actorPhone: staffMember.phone,
        summary: `Denied ${action.actionType} permission for Attendant ${staffMember.name}`,
        channel: 'whatsapp',
      });
      return {
        status: 'ok',
        senderName: staffMember.name,
        senderRole: staffMember.role,
        accessDenied: true,
        replyText: `Permission denied. Attendants can look up prices and stock, but only a Manager or Owner can modify inventory or selling prices.`,
      };
    }

    const updated = store.updateProduct(shop.id, action.productId, {
      sellingPrice: action.newPrice,
      stockQuantity: action.newStockQuantity,
      actorName: staffMember.name,
      actorRole: staffMember.role,
      channel: 'whatsapp',
      reason: action.reason || 'Confirmed via WhatsApp',
    });

    if (!updated) {
      return {
        status: 'ok',
        senderName: staffMember.name,
        senderRole: staffMember.role,
        replyText: 'Could not apply update because the product was no longer found.',
      };
    }

    return {
      status: 'ok',
      senderName: staffMember.name,
      senderRole: staffMember.role,
      mutatedDatabase: true,
      replyText:
        action.actionType === 'price_change'
          ? `Confirmed & saved to ${shop.name}:\n${updated.name} (${updated.packSize})\nPrevious price: ${
              updated.previousSellingPrice !== null ? formatNaira(updated.previousSellingPrice) : '—'
            }\nNew selling price: ${formatNaira(updated.sellingPrice)}\nUpdated by ${staffMember.name} · Authorised staff notified & synced immediately.`
          : `Confirmed & saved to ${shop.name} database:\n${updated.name} (${updated.packSize})\nSelling price: ${formatNaira(updated.sellingPrice)}\nRecorded stock: ${updated.stockQuantity} ${updated.unit}`,
    };
  }

  // 5. Handle explicit product quick-reply selection (disambiguation)
  if (payload.selectedProductId) {
    const product = store.getProductInShop(shop.id, payload.selectedProductId);
    if (!product) {
      return {
        status: 'ok',
        senderName: staffMember.name,
        senderRole: staffMember.role,
        replyText: `That product could not be found in ${shop.name}'s catalogue.`,
      };
    }

    store.logActivity({
      shopId: shop.id,
      type: 'enquiry',
      actorName: staffMember.name,
      actorRole: staffMember.role,
      actorPhone: staffMember.phone,
      productId: product.id,
      productName: `${product.name} (${product.packSize})`,
      summary: `Looked up ${product.name} (${product.packSize})`,
      detail: `Returned ${formatNaira(product.sellingPrice)} · ${product.stockQuantity} ${product.unit}`,
      channel: 'whatsapp',
    });

    return {
      status: 'ok',
      senderName: staffMember.name,
      senderRole: staffMember.role,
      replyText: buildProductAnswer(product, shop.name),
    };
  }

  // 6. Grounded conversational AI using strictly this shop's live inventory + chat history
  const shopProducts = store.getProductsForShop(shop.id);
  const aiResult = await generateGroundedWhatsAppReply({
    shop,
    products: shopProducts,
    staffName: staffMember.name,
    staffRole: staffMember.role,
    messageText: payload.messageText,
    history: payload.history,
  });

  // 7. Enforce deterministic RBAC if the user requested a price or stock mutation
  if (aiResult.requestedAction) {
    const act = aiResult.requestedAction;
    const target = store.getProductInShop(shop.id, act.productId);

    if (target) {
      if (staffMember.role === 'attendant') {
        store.logActivity({
          shopId: shop.id,
          type: 'access_denied',
          actorName: staffMember.name,
          actorRole: staffMember.role,
          actorPhone: staffMember.phone,
          productId: target.id,
          productName: `${target.name} (${target.packSize})`,
          summary: `Blocked ${act.type === 'PRICE_UPDATE' ? 'price change' : 'stock adjustment'} attempt by Attendant ${staffMember.name}`,
          detail: `Message: "${payload.messageText.slice(0, 80)}"`,
          channel: 'whatsapp',
        });

        return {
          status: 'ok',
          senderName: staffMember.name,
          senderRole: staffMember.role,
          accessDenied: true,
          parsedIntent: {
            provider: aiResult.provider,
            model: aiResult.model,
            requestedAction: act,
          },
          replyText: `Permission denied. Attendants can look up prices and stock, but only a Manager or Owner can modify ${target.name} (${target.packSize}).\nCurrent price: ${formatNaira(target.sellingPrice)} · Stock: ${target.stockQuantity} ${target.unit}.`,
        };
      }

      if (act.type === 'PRICE_UPDATE' && typeof act.newPrice === 'number') {
        const pending: PendingConfirmation = {
          actionType: 'price_change',
          productId: target.id,
          productLabel: `${target.name} (${target.packSize})`,
          newPrice: Math.max(0, act.newPrice),
          reason: act.reason || `Requested via WhatsApp by ${staffMember.name}`,
        };

        return {
          status: 'ok',
          senderName: staffMember.name,
          senderRole: staffMember.role,
          parsedIntent: {
            provider: aiResult.provider,
            model: aiResult.model,
            requestedAction: act,
          },
          pendingConfirmation: pending,
          replyText: `Confirm price change for ${target.name} (${target.packSize})?\nCurrent price: ${formatNaira(target.sellingPrice)}\nNew price: ${formatNaira(pending.newPrice ?? target.sellingPrice)}\n\nTap "Confirm Update" below to save to ${shop.name}.`,
        };
      }

      if (act.type === 'STOCK_ADJUST' && typeof act.stockDelta === 'number') {
        const nextStock = Math.max(0, target.stockQuantity + act.stockDelta);
        const pending: PendingConfirmation = {
          actionType: 'stock_adjustment',
          productId: target.id,
          productLabel: `${target.name} (${target.packSize})`,
          stockDelta: act.stockDelta,
          newStockQuantity: nextStock,
          reason: act.reason || `Adjusted via WhatsApp by ${staffMember.name}`,
        };

        return {
          status: 'ok',
          senderName: staffMember.name,
          senderRole: staffMember.role,
          parsedIntent: {
            provider: aiResult.provider,
            model: aiResult.model,
            requestedAction: act,
          },
          pendingConfirmation: pending,
          replyText: `Confirm stock update for ${target.name} (${target.packSize})?\nCurrent stock: ${target.stockQuantity} ${target.unit}\nNew stock: ${nextStock} ${target.unit}\n\nTap "Confirm Update" below to save.`,
        };
      }
    }
  }

  // 8. Build clickable disambiguation options if AI flagged multiple candidate sizes
  let options: WhatsAppCandidateOption[] | undefined;
  if (aiResult.ambiguousProductIds.length > 1) {
    const candidates = aiResult.ambiguousProductIds
      .map((id) => store.getProductInShop(shop.id, id))
      .filter((p): p is Product => Boolean(p));

    if (candidates.length > 1) {
      options = candidates.map((p) => ({
        productId: p.id,
        label: `${p.name} — ${p.packSize}`,
        packSize: p.packSize,
        sellingPrice: p.sellingPrice,
        stockQuantity: p.stockQuantity,
        unit: p.unit,
      }));
    }
  }

  // 9. Log enquiry in shop activity history
  const firstRefProduct =
    aiResult.referencedProductIds.length > 0
      ? store.getProductInShop(shop.id, aiResult.referencedProductIds[0])
      : undefined;

  store.logActivity({
    shopId: shop.id,
    type: 'enquiry',
    actorName: staffMember.name,
    actorRole: staffMember.role,
    actorPhone: staffMember.phone,
    productId: firstRefProduct?.id,
    productName: firstRefProduct
      ? `${firstRefProduct.name} (${firstRefProduct.packSize})`
      : undefined,
    summary: `WhatsApp query: "${payload.messageText.slice(0, 70)}${
      payload.messageText.length > 70 ? '...' : ''
    }"`,
    detail:
      aiResult.referencedProductIds.length > 0
        ? `Referenced ${aiResult.referencedProductIds.length} catalogue item(s)`
        : 'Conversational enquiry',
    channel: 'whatsapp',
  });

  return {
    status: 'ok',
    senderName: staffMember.name,
    senderRole: staffMember.role,
    options,
    parsedIntent: {
      provider: aiResult.provider,
      model: aiResult.model,
      referencedProductIds: aiResult.referencedProductIds,
      ambiguousProductIds: aiResult.ambiguousProductIds,
    },
    replyText: aiResult.replyText,
  };
}
