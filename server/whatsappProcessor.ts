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
  phoneNumberId?: string;
  toBusinessPhone?: string;
  fromPhone: string;
  messageText: string;
  history?: ChatHistoryTurn[];
  selectedProductId?: string;
  interactiveReplyId?: string;
  confirmedAction?: PendingConfirmation;
}

export interface WhatsAppProcessorResult {
  status: 'ok' | 'duplicate' | 'error';
  replyText: string;
  shopId?: string;
  whatsappPhoneNumberId?: string | null;
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
  if (payload.messageId && (await store.isMessageProcessed(payload.messageId))) {
    return {
      status: 'duplicate',
      replyText: 'Duplicate webhook event ignored safely.',
    };
  }

  // 2. Resolve Shop boundary (shopId, Meta phoneNumberId, or business WhatsApp number)
  const shop = await store.getShopByWhatsappIdentity({
    shopId: payload.shopId,
    phoneNumberId: payload.phoneNumberId,
    toBusinessPhone: payload.toBusinessPhone,
  });

  if (!shop) {
    return {
      status: 'error',
      replyText: 'No connected Sabi AI shop found for this WhatsApp number.',
      senderRole: 'external',
      accessDenied: true,
    };
  }

  if (!shop.whatsappConnected) {
    return {
      status: 'error',
      shopId: shop.id,
      whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
      replyText: `${shop.name}'s WhatsApp assistant is currently paused by the owner.`,
      senderRole: 'external',
      accessDenied: true,
    };
  }

  // 3. Verify staff membership strictly inside THIS shop
  const staffMember = await store.findStaffByPhoneInShop(shop.id, payload.fromPhone);
  if (!staffMember || !staffMember.active) {
    await store.logActivity({
      shopId: shop.id,
      type: 'access_denied',
      actorName: payload.fromPhone,
      actorRole: 'external',
      actorPhone: payload.fromPhone,
      summary: `Blocked WhatsApp message from unregistered/inactive number (${payload.fromPhone})`,
      detail: `Message: "${payload.messageText.slice(0, 80)}"`,
      channel: 'whatsapp',
    });

    if (payload.messageId) await store.markMessageProcessed(payload.messageId);

    return {
      status: 'ok',
      shopId: shop.id,
      whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
      senderName: 'Unregistered Number',
      senderRole: 'external',
      accessDenied: true,
      replyText: `Access denied. Your number (${payload.fromPhone}) is not authorised for ${shop.name}. Ask the shop owner to add your number in Staff & permissions.`,
    };
  }

  if (payload.messageId) await store.markMessageProcessed(payload.messageId);

  const thread = await store.getWhatsAppThread(shop.id, payload.fromPhone);
  const interactiveId = payload.interactiveReplyId?.trim() || '';
  const trimmedText = payload.messageText.trim();
  const normalizedCmd = trimmedText.toLowerCase();

  // Resolve interactive callbacks or text confirmations against stored pendingConfirmation
  let resolvedConfirmedAction = payload.confirmedAction;
  let resolvedSelectedProductId = payload.selectedProductId;

  if (!resolvedConfirmedAction && thread.pendingConfirmation) {
    if (
      interactiveId === 'confirm:apply' ||
      ['confirm', 'confirm update', 'yes', 'ok', 'proceed', 'approve'].includes(normalizedCmd)
    ) {
      resolvedConfirmedAction = thread.pendingConfirmation;
    } else if (
      interactiveId === 'cancel_action' ||
      ['cancel', 'no', 'stop', 'abort'].includes(normalizedCmd)
    ) {
      const cancelReply = 'Update cancelled. No prices or stock quantities were changed.';
      await store.saveWhatsAppThread(shop.id, payload.fromPhone, {
        history: [
          ...thread.history,
          { role: 'user', text: trimmedText || 'Cancel' },
          { role: 'assistant', text: cancelReply },
        ],
        pendingConfirmation: null,
      });
      return {
        status: 'ok',
        shopId: shop.id,
        whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
        senderName: staffMember.name,
        senderRole: staffMember.role,
        replyText: cancelReply,
      };
    }
  }

  if (!resolvedSelectedProductId && interactiveId.startsWith('pick:')) {
    resolvedSelectedProductId = interactiveId.slice('pick:'.length);
  }

  // 4. Handle explicit confirmation of a pending price/stock change
  if (resolvedConfirmedAction) {
    const action = resolvedConfirmedAction;
    if (staffMember.role === 'attendant') {
      await store.logActivity({
        shopId: shop.id,
        type: 'access_denied',
        actorName: staffMember.name,
        actorRole: staffMember.role,
        actorPhone: staffMember.phone,
        summary: `Denied ${action.actionType} permission for Attendant ${staffMember.name}`,
        channel: 'whatsapp',
      });
      await store.saveWhatsAppThread(shop.id, payload.fromPhone, {
        history: thread.history,
        pendingConfirmation: null,
      });
      return {
        status: 'ok',
        shopId: shop.id,
        whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
        senderName: staffMember.name,
        senderRole: staffMember.role,
        accessDenied: true,
        replyText:
          'Permission denied. Attendants can look up prices and stock, but only a Manager or Owner can modify inventory or selling prices.',
      };
    }

    const updated = await store.updateProduct(shop.id, action.productId, {
      sellingPrice: action.newPrice,
      stockQuantity: action.newStockQuantity,
      actorName: staffMember.name,
      actorRole: staffMember.role,
      channel: 'whatsapp',
      reason: action.reason || 'Confirmed via WhatsApp',
    });

    if (!updated) {
      await store.saveWhatsAppThread(shop.id, payload.fromPhone, {
        history: thread.history,
        pendingConfirmation: null,
      });
      return {
        status: 'ok',
        shopId: shop.id,
        whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
        senderName: staffMember.name,
        senderRole: staffMember.role,
        replyText: 'Could not apply update because the product was no longer found.',
      };
    }

    const replyText =
      action.actionType === 'price_change'
        ? `Confirmed & saved to ${shop.name}:\n${updated.name} (${updated.packSize})\nPrevious price: ${
            updated.previousSellingPrice !== null ? formatNaira(updated.previousSellingPrice) : '—'
          }\nNew selling price: ${formatNaira(updated.sellingPrice)}\nUpdated by ${staffMember.name} · Authorised staff notified & synced immediately.`
        : `Confirmed & saved to ${shop.name} database:\n${updated.name} (${updated.packSize})\nSelling price: ${formatNaira(updated.sellingPrice)}\nRecorded stock: ${updated.stockQuantity} ${updated.unit}`;

    await store.saveWhatsAppThread(shop.id, payload.fromPhone, {
      history: [
        ...thread.history,
        { role: 'user', text: trimmedText || 'Confirm update' },
        { role: 'assistant', text: replyText },
      ],
      pendingConfirmation: null,
    });

    return {
      status: 'ok',
      shopId: shop.id,
      whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
      senderName: staffMember.name,
      senderRole: staffMember.role,
      mutatedDatabase: true,
      replyText,
    };
  }

  // 5. Handle explicit product quick-reply selection (disambiguation)
  if (resolvedSelectedProductId) {
    const product = await store.getProductInShop(shop.id, resolvedSelectedProductId);
    if (!product) {
      return {
        status: 'ok',
        shopId: shop.id,
        whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
        senderName: staffMember.name,
        senderRole: staffMember.role,
        replyText: `That product could not be found in ${shop.name}'s catalogue.`,
      };
    }

    await store.logActivity({
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

    const answer = buildProductAnswer(product, shop.name);
    await store.saveWhatsAppThread(shop.id, payload.fromPhone, {
      history: [
        ...thread.history,
        { role: 'user', text: `${product.name} ${product.packSize}` },
        { role: 'assistant', text: answer },
      ],
      pendingConfirmation: null,
    });

    return {
      status: 'ok',
      shopId: shop.id,
      whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
      senderName: staffMember.name,
      senderRole: staffMember.role,
      replyText: answer,
    };
  }

  // 6. Grounded conversational AI using strictly this shop's live inventory + chat history
  const activeHistory =
    payload.history && payload.history.length > 0 ? payload.history : thread.history;
  const shopProducts = await store.getProductsForShop(shop.id);
  const aiResult = await generateGroundedWhatsAppReply({
    shop,
    products: shopProducts,
    staffName: staffMember.name,
    staffRole: staffMember.role,
    messageText: payload.messageText,
    history: activeHistory,
  });

  // 7. Enforce deterministic RBAC if the user requested a price or stock mutation
  if (aiResult.requestedAction) {
    const act = aiResult.requestedAction;
    const target = await store.getProductInShop(shop.id, act.productId);

    if (target) {
      if (staffMember.role === 'attendant') {
        await store.logActivity({
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

        const deniedText = `Permission denied. Attendants can look up prices and stock, but only a Manager or Owner can modify ${target.name} (${target.packSize}).\nCurrent price: ${formatNaira(target.sellingPrice)} · Stock: ${target.stockQuantity} ${target.unit}.`;
        await store.saveWhatsAppThread(shop.id, payload.fromPhone, {
          history: [
            ...activeHistory,
            { role: 'user', text: trimmedText },
            { role: 'assistant', text: deniedText },
          ],
          pendingConfirmation: null,
        });

        return {
          status: 'ok',
          shopId: shop.id,
          whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
          senderName: staffMember.name,
          senderRole: staffMember.role,
          accessDenied: true,
          parsedIntent: {
            provider: aiResult.provider,
            model: aiResult.model,
            requestedAction: act,
          },
          replyText: deniedText,
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

        const confirmText = `Confirm price change for ${target.name} (${target.packSize})?\nCurrent price: ${formatNaira(target.sellingPrice)}\nNew price: ${formatNaira(pending.newPrice ?? target.sellingPrice)}\n\nTap "Confirm Update" (or reply YES) to save to ${shop.name}.`;
        await store.saveWhatsAppThread(shop.id, payload.fromPhone, {
          history: [
            ...activeHistory,
            { role: 'user', text: trimmedText },
            { role: 'assistant', text: confirmText },
          ],
          pendingConfirmation: pending,
        });

        return {
          status: 'ok',
          shopId: shop.id,
          whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
          senderName: staffMember.name,
          senderRole: staffMember.role,
          parsedIntent: {
            provider: aiResult.provider,
            model: aiResult.model,
            requestedAction: act,
          },
          pendingConfirmation: pending,
          replyText: confirmText,
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

        const confirmText = `Confirm stock update for ${target.name} (${target.packSize})?\nCurrent stock: ${target.stockQuantity} ${target.unit}\nNew stock: ${nextStock} ${target.unit}\n\nTap "Confirm Update" (or reply YES) to save.`;
        await store.saveWhatsAppThread(shop.id, payload.fromPhone, {
          history: [
            ...activeHistory,
            { role: 'user', text: trimmedText },
            { role: 'assistant', text: confirmText },
          ],
          pendingConfirmation: pending,
        });

        return {
          status: 'ok',
          shopId: shop.id,
          whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
          senderName: staffMember.name,
          senderRole: staffMember.role,
          parsedIntent: {
            provider: aiResult.provider,
            model: aiResult.model,
            requestedAction: act,
          },
          pendingConfirmation: pending,
          replyText: confirmText,
        };
      }
    }
  }

  // 8. Build clickable disambiguation options if AI flagged multiple candidate sizes
  let options: WhatsAppCandidateOption[] | undefined;
  if (aiResult.ambiguousProductIds.length > 1) {
    const candidateResults = await Promise.all(
      aiResult.ambiguousProductIds.map((id) => store.getProductInShop(shop.id, id))
    );
    const candidates = candidateResults.filter((p): p is Product => Boolean(p));

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
      ? await store.getProductInShop(shop.id, aiResult.referencedProductIds[0])
      : undefined;

  await store.logActivity({
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

  await store.saveWhatsAppThread(shop.id, payload.fromPhone, {
    history: [
      ...activeHistory,
      { role: 'user', text: trimmedText },
      { role: 'assistant', text: aiResult.replyText },
    ],
    pendingConfirmation: null,
  });

  return {
    status: 'ok',
    shopId: shop.id,
    whatsappPhoneNumberId: shop.whatsappPhoneNumberId,
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
