import crypto from 'crypto';
import express from 'express';
import { store } from './store.ts';
import { processIncomingWhatsAppEvent } from './whatsappProcessor.ts';
import { getActiveAiInfo, transcribeVoiceNote } from './ai.ts';
import { generateWaitlistExcelBuffer } from './waitlistExcel.ts';
import type {
  StaffCountRange,
  StaffRole,
  StoreCategoryOption,
  SubscriptionPlanId,
} from '../src/types.ts';

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health & active AI engine info endpoint
  app.get('/api/health', async (_req, res) => {
    const ai = await getActiveAiInfo();
    res.json({ ok: true, service: 'Sabi AI', ai });
  });

  // Public waitlist summary (returns aggregate count only — zero PII or user fields)
  app.get('/api/waitlist', (_req, res) => {
    res.json(store.getWaitlistSummary());
  });

  // Invisible private Excel export route configured strictly via server-side env vars.
  // Never referenced in client code and returns 404 unless both secret path & key match.
  const rawSecretRoute = process.env.WAITLIST_SECRET_ROUTE?.trim();
  const rawAdminKey = process.env.WAITLIST_ADMIN_KEY?.trim();
  if (
    rawSecretRoute &&
    rawAdminKey &&
    rawSecretRoute !== 'MY_WAITLIST_SECRET_ROUTE' &&
    rawAdminKey !== 'MY_WAITLIST_ADMIN_KEY'
  ) {
    const normalizedRoute = rawSecretRoute.startsWith('/')
      ? rawSecretRoute
      : `/${rawSecretRoute}`;

    app.get(normalizedRoute, async (req, res) => {
      try {
        const bearerHeader = req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.slice(7)
          : '';
        const providedKey = String(
          req.headers['x-admin-key'] || bearerHeader || req.query.key || ''
        ).trim();

        const expectedDigest = crypto.createHash('sha256').update(rawAdminKey).digest();
        const providedDigest = crypto.createHash('sha256').update(providedKey).digest();
        if (!providedKey || !crypto.timingSafeEqual(expectedDigest, providedDigest)) {
          res.status(404).send('Not found');
          return;
        }

        const entries = store.getWaitlistEntries();
        const buffer = await generateWaitlistExcelBuffer(entries);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename="sabi-ai-waitlist.xlsx"');
        res.setHeader('Cache-Control', 'no-store');
        res.send(buffer);
      } catch (err) {
        console.error('Private waitlist export error:', err);
        res.status(500).json({ error: 'Could not generate waitlist Excel file.' });
      }
    });
  }

  // Join the Sabi AI waitlist
  app.post('/api/waitlist', (req, res) => {
    const {
      fullName,
      shopName,
      city,
      email,
      whatsappNumber,
      storeCategory,
      staffCountRange,
    } = req.body || {};

    const cleanName = String(fullName || '').trim();
    const cleanShop = String(shopName || '').trim();
    const cleanCity = String(city || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(whatsappNumber || '').trim();

    if (!cleanName || !cleanShop) {
      res.status(400).json({ error: 'Please enter your full name and shop name.' });
      return;
    }

    if (!cleanEmail && !cleanPhone) {
      res.status(400).json({ error: 'Please provide an email address or WhatsApp number.' });
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const phoneDigits = cleanPhone.replace(/\D/g, '');
    if (cleanPhone && phoneDigits.length < 8) {
      res.status(400).json({ error: 'Please enter a valid WhatsApp phone number.' });
      return;
    }

    const allowedCategories: StoreCategoryOption[] = [
      'Supermarket',
      'Provision store',
      'Mini-mart',
      'Wholesale',
      'Pharmacy',
      'Other retail',
    ];
    const safeCategory: StoreCategoryOption = allowedCategories.includes(
      storeCategory as StoreCategoryOption
    )
      ? (storeCategory as StoreCategoryOption)
      : 'Supermarket';

    const allowedRanges: StaffCountRange[] = ['1-3', '4-10', '11+'];
    const safeRange: StaffCountRange = allowedRanges.includes(staffCountRange as StaffCountRange)
      ? (staffCountRange as StaffCountRange)
      : '1-3';

    const result = store.joinWaitlist({
      fullName: cleanName,
      shopName: cleanShop,
      city: cleanCity || 'Lagos, Nigeria',
      email: cleanEmail,
      whatsappNumber: cleanPhone,
      storeCategory: safeCategory,
      staffCountRange: safeRange,
    });

    res.status(result.alreadyJoined ? 200 : 201).json(result);
  });

  // List all shops (for tenant switcher)
  app.get('/api/shops', (_req, res) => {
    res.json({ shops: store.getAllShops() });
  });

  // Create a new isolated shop tenant
  app.post('/api/shops', (req, res) => {
    const { name, location, category, whatsappNumber, ownerName, ownerPhone, planId } = req.body || {};
    if (!name || !location || !whatsappNumber || !ownerName || !ownerPhone) {
      res.status(400).json({ error: 'Shop name, location, WhatsApp number, owner name, and owner phone are required.' });
      return;
    }
    const shop = store.createShop({
      name: String(name),
      location: String(location),
      category: String(category || 'Supermarket & Provisions'),
      whatsappNumber: String(whatsappNumber),
      ownerName: String(ownerName),
      ownerPhone: String(ownerPhone),
      planId: (planId as SubscriptionPlanId) || 'starter',
    });
    res.status(201).json({ shop });
  });

  // Get full dashboard snapshot for a single shop
  app.get('/api/shops/:shopId/dashboard', (req, res) => {
    const snapshot = store.getDashboardSnapshot(req.params.shopId);
    if (!snapshot) {
      res.status(404).json({ error: 'Shop not found.' });
      return;
    }
    res.json(snapshot);
  });

  // Update shop WhatsApp connection or subscription plan
  app.patch('/api/shops/:shopId/config', (req, res) => {
    const { whatsappNumber, whatsappConnected, planId, name, location } = req.body || {};
    const updated = store.updateShopConfig(req.params.shopId, {
      whatsappNumber,
      whatsappConnected,
      planId,
      name,
      location,
    });
    if (!updated) {
      res.status(404).json({ error: 'Shop not found.' });
      return;
    }
    res.json({ shop: updated });
  });

  // Product CRUD scoped strictly to shopId
  app.post('/api/shops/:shopId/products', (req, res) => {
    const shop = store.getShopById(req.params.shopId);
    if (!shop) {
      res.status(404).json({ error: 'Shop not found.' });
      return;
    }
    const {
      name,
      packSize,
      sku,
      category,
      costPrice,
      sellingPrice,
      supplierName,
      stockQuantity,
      unit,
      reorderLevel,
      expiryDate,
      actorName,
      actorRole,
    } = req.body || {};

    if (!name || !packSize || sellingPrice === undefined || stockQuantity === undefined) {
      res.status(400).json({ error: 'Product name, pack size, selling price, and stock quantity are required.' });
      return;
    }

    const product = store.createProduct(shop.id, {
      name: String(name),
      packSize: String(packSize),
      sku: String(sku || `${String(name).slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`),
      category: String(category || 'General'),
      costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
      sellingPrice: Number(sellingPrice),
      supplierName: supplierName ? String(supplierName) : undefined,
      stockQuantity: Number(stockQuantity),
      unit: String(unit || 'units'),
      reorderLevel: Number(reorderLevel ?? 5),
      expiryDate: expiryDate ? String(expiryDate) : null,
      actorName: String(actorName || 'Shop Owner'),
      actorRole: (actorRole as StaffRole) || 'owner',
    });
    res.status(201).json({ product });
  });

  app.post('/api/shops/:shopId/products/import', (req, res) => {
    const shop = store.getShopById(req.params.shopId);
    if (!shop) {
      res.status(404).json({ error: 'Shop not found.' });
      return;
    }
    const { items, actorName, actorRole } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Provide an array of products to import.' });
      return;
    }
    const imported = store.bulkImportProducts(
      shop.id,
      items,
      String(actorName || 'Shop Owner'),
      (actorRole as StaffRole) || 'owner'
    );
    res.status(201).json({ importedCount: imported.length, products: imported });
  });

  app.patch('/api/shops/:shopId/products/:productId', (req, res) => {
    const {
      name,
      packSize,
      sku,
      category,
      costPrice,
      sellingPrice,
      supplierName,
      stockQuantity,
      unit,
      reorderLevel,
      expiryDate,
      actorName,
      actorRole,
      reason,
    } = req.body || {};

    const updated = store.updateProduct(req.params.shopId, req.params.productId, {
      name,
      packSize,
      sku,
      category,
      costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
      sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : undefined,
      supplierName,
      stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : undefined,
      unit,
      reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : undefined,
      expiryDate,
      actorName: String(actorName || 'Shop Owner'),
      actorRole: (actorRole as StaffRole) || 'owner',
      channel: 'dashboard',
      reason: reason ? String(reason) : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: 'Product not found in this shop.' });
      return;
    }
    res.json({ product: updated });
  });

  app.delete('/api/shops/:shopId/products/:productId', (req, res) => {
    const deleted = store.deleteProduct(req.params.shopId, req.params.productId);
    if (!deleted) {
      res.status(404).json({ error: 'Product not found in this shop.' });
      return;
    }
    res.json({ ok: true });
  });

  // Dismiss price review flag after reviewing margin
  app.post('/api/shops/:shopId/products/:productId/dismiss-review', (req, res) => {
    const { actorName, actorRole } = req.body || {};
    const updated = store.dismissPriceReview(
      req.params.shopId,
      req.params.productId,
      String(actorName || 'Shop Owner'),
      (actorRole as StaffRole) || 'owner'
    );
    if (!updated) {
      res.status(404).json({ error: 'Product not found in this shop.' });
      return;
    }
    res.json({ product: updated });
  });

  // Record supplier purchase & flag selling price review if supplier cost increased
  app.post('/api/shops/:shopId/purchases', (req, res) => {
    const { productId, supplierName, quantity, unitCost, expiryDate, note, actorName, actorRole } =
      req.body || {};
    if (!productId || !quantity || unitCost === undefined) {
      res.status(400).json({ error: 'productId, quantity, and unitCost are required.' });
      return;
    }
    const result = store.recordPurchase(req.params.shopId, {
      productId: String(productId),
      supplierName: String(supplierName || ''),
      quantity: Number(quantity),
      unitCost: Number(unitCost),
      expiryDate: expiryDate ? String(expiryDate) : null,
      note: note ? String(note) : undefined,
      actorName: String(actorName || 'Shop Owner'),
      actorRole: (actorRole as StaffRole) || 'owner',
    });
    if (!result) {
      res.status(404).json({ error: 'Product not found in this shop.' });
      return;
    }
    res.status(201).json(result);
  });

  // Record stock loss (damaged, expired, missing) or reasoned adjustment
  app.post('/api/shops/:shopId/stock-loss', (req, res) => {
    const { productId, quantityDelta, reason, note, actorName, actorRole } = req.body || {};
    if (!productId || quantityDelta === undefined || !reason) {
      res.status(400).json({ error: 'productId, quantityDelta, and reason are required.' });
      return;
    }
    const result = store.recordStockAdjustmentWithReason(req.params.shopId, {
      productId: String(productId),
      quantityDelta: Number(quantityDelta),
      reason,
      note: note ? String(note) : undefined,
      actorName: String(actorName || 'Shop Owner'),
      actorRole: (actorRole as StaffRole) || 'owner',
    });
    if (!result) {
      res.status(404).json({ error: 'Product not found in this shop.' });
      return;
    }
    res.status(201).json(result);
  });

  // Commit physical stock-counting session
  app.post('/api/shops/:shopId/stock-count', (req, res) => {
    const { counts, actorName, actorRole } = req.body || {};
    if (!Array.isArray(counts) || counts.length === 0) {
      res.status(400).json({ error: 'Provide counted quantities to reconcile.' });
      return;
    }
    const summary = store.submitPhysicalStockCount(
      req.params.shopId,
      counts,
      String(actorName || 'Shop Owner'),
      (actorRole as StaffRole) || 'owner'
    );
    res.json(summary);
  });

  // Mark shop notifications as read
  app.post('/api/shops/:shopId/notifications/read', (req, res) => {
    store.markNotificationsRead(req.params.shopId);
    res.json({ ok: true });
  });

  // Staff management scoped strictly to shopId
  app.post('/api/shops/:shopId/staff', (req, res) => {
    const shop = store.getShopById(req.params.shopId);
    if (!shop) {
      res.status(404).json({ error: 'Shop not found.' });
      return;
    }
    const { name, phone, role, actorName } = req.body || {};
    if (!name || !phone || !role) {
      res.status(400).json({ error: 'Staff name, phone number, and role are required.' });
      return;
    }
    const member = store.addStaffMember(shop.id, {
      name: String(name),
      phone: String(phone),
      role: role as StaffRole,
      actorName: String(actorName || 'Shop Owner'),
    });
    res.status(201).json({ member });
  });

  app.patch('/api/shops/:shopId/staff/:staffId', (req, res) => {
    const { role, active, name, phone, actorName } = req.body || {};
    const updated = store.updateStaffMember(req.params.shopId, req.params.staffId, {
      role,
      active,
      name,
      phone,
      actorName: String(actorName || 'Shop Owner'),
    });
    if (!updated) {
      res.status(404).json({ error: 'Staff member not found in this shop.' });
      return;
    }
    res.json({ member: updated });
  });

  // Official-shaped WhatsApp Business Platform webhook processor
  app.post('/api/whatsapp/webhook', async (req, res) => {
    try {
      const {
        messageId,
        shopId,
        toBusinessPhone,
        fromPhone,
        messageText,
        history,
        selectedProductId,
        confirmedAction,
      } = req.body || {};

      if (!fromPhone || (!messageText && !selectedProductId && !confirmedAction)) {
        res.status(400).json({ error: 'fromPhone and messageText (or action) are required.' });
        return;
      }

      const result = await processIncomingWhatsAppEvent({
        messageId: String(messageId || `wamid.${Date.now()}`),
        shopId: shopId ? String(shopId) : undefined,
        toBusinessPhone: toBusinessPhone ? String(toBusinessPhone) : undefined,
        fromPhone: String(fromPhone),
        messageText: String(messageText || ''),
        history: Array.isArray(history) ? history : undefined,
        selectedProductId: selectedProductId ? String(selectedProductId) : undefined,
        confirmedAction,
      });

      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process WhatsApp message.';
      console.error('WhatsApp webhook error:', err);
      res.status(500).json({ status: 'error', error: message });
    }
  });

  // Voice note transcription + WhatsApp lookup pipeline
  app.post('/api/whatsapp/voice', async (req, res) => {
    try {
      const { messageId, shopId, fromPhone, audioBase64, mimeType, history } = req.body || {};
      if (!fromPhone || !audioBase64) {
        res.status(400).json({ error: 'fromPhone and audioBase64 are required.' });
        return;
      }

      const transcript = await transcribeVoiceNote(String(audioBase64), String(mimeType || 'audio/webm'));
      if (!transcript) {
        res.status(422).json({ error: 'Could not transcribe voice note clearly. Please try speaking closer to the mic.' });
        return;
      }

      const result = await processIncomingWhatsAppEvent({
        messageId: String(messageId || `wamid.voice.${Date.now()}`),
        shopId: shopId ? String(shopId) : undefined,
        fromPhone: String(fromPhone),
        messageText: transcript,
        history: Array.isArray(history) ? history : undefined,
      });

      res.json({ ...result, transcript });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process voice note.';
      console.error('Voice note error:', err);
      res.status(500).json({ status: 'error', error: message });
    }
  });

  // Never fall through unmatched /api/* routes to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
