import crypto from 'crypto';
import express from 'express';
import type { Request, Response } from 'express';
import { store } from './store.ts';
import { isSupabaseConfigured } from './supabaseClient.ts';
import {
  downloadMetaMediaAsBase64,
  getMetaWhatsAppReadiness,
  parseMetaWebhookPayload,
  sendMetaWhatsAppReply,
  verifyMetaSignature,
  verifyWebhookChallenge,
} from './metaWhatsapp.ts';
import { processIncomingWhatsAppEvent } from './whatsappProcessor.ts';
import { getActiveAiInfo, transcribeVoiceNote } from './ai.ts';
import { generateWaitlistExcelBuffer } from './waitlistExcel.ts';
import type {
  AuthUser,
  StaffCountRange,
  StaffRole,
  StoreCategoryOption,
  SubscriptionPlanId,
} from '../src/types.ts';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  exp: number;
}

const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_SESSION_SECRET;
}

function createSessionToken(user: AuthUser): string {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function parseSessionToken(req: Request): SessionPayload | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;

  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'))) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function authorizeShopAccess(req: Request, res: Response, shopId: string) {
  const shop = await store.getShopById(shopId);
  if (!shop) {
    res.status(404).json({ error: 'Shop not found.' });
    return null;
  }

  // Demo shops are open for instant exploration; private user shops require owner auth.
  if (!shop.isDemo) {
    const session = parseSessionToken(req);
    if (!session) {
      res.status(401).json({ error: 'Sign in required to access this private shop.' });
      return null;
    }
    if (shop.ownerUserId && shop.ownerUserId !== session.userId) {
      res.status(403).json({ error: 'You do not have permission to access this shop.' });
      return null;
    }
  }

  return shop;
}

export function createApiApp() {
  const app = express();
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        (req as RequestWithRawBody).rawBody = buf;
      },
    })
  );

  // Health, Database, AI & Meta WhatsApp readiness endpoint (booleans only — no secrets)
  app.get('/api/health', async (_req, res) => {
    const ai = await getActiveAiInfo();
    const whatsapp = getMetaWhatsAppReadiness();
    res.json({
      ok: true,
      service: 'Sabi AI',
      database: isSupabaseConfigured() ? 'supabase' : 'local',
      ai,
      whatsapp,
    });
  });

  // Owner Auth Endpoints (stored in Supabase `app_users` when configured)
  app.post('/api/auth/register', async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        shopName,
        location,
        category,
        whatsappNumber,
        whatsappPhoneNumberId,
        ownerPhone,
        planId,
      } = req.body || {};

      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }

      const result = await store.registerUserAccount({
        name: String(name || ''),
        email: cleanEmail,
        password: String(password || ''),
      });

      if (!result.user) {
        res.status(400).json({ error: result.error || 'Could not register account.' });
        return;
      }

      if (shopName && String(shopName).trim()) {
        await store.createShop({
          ownerUserId: result.user.id,
          isDemo: false,
          name: String(shopName),
          location: String(location || 'Lagos, Nigeria'),
          category: String(category || 'Supermarket & Provisions'),
          whatsappNumber: String(whatsappNumber || ownerPhone || '+234 800 000 0000'),
          whatsappPhoneNumberId: whatsappPhoneNumberId ? String(whatsappPhoneNumberId) : null,
          ownerName: result.user.name,
          ownerPhone: String(ownerPhone || whatsappNumber || '+2348000000000'),
          planId: (planId as SubscriptionPlanId) || 'starter',
        });
      }

      const token = createSessionToken(result.user);
      const shops = await store.getAccessibleShops(result.user.id);
      res.status(201).json({ token, user: result.user, shops });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const result = await store.loginUserAccount(String(email || ''), String(password || ''));
      if (!result.user) {
        res.status(401).json({ error: result.error || 'Invalid email or password.' });
        return;
      }
      const token = createSessionToken(result.user);
      const shops = await store.getAccessibleShops(result.user.id);
      res.json({ token, user: result.user, shops });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    const session = parseSessionToken(req);
    if (!session) {
      res.status(401).json({ error: 'Not signed in.' });
      return;
    }
    const user = await store.getUserById(session.userId);
    if (!user) {
      res.status(401).json({ error: 'Account no longer exists.' });
      return;
    }
    const shops = await store.getAccessibleShops(user.id);
    res.json({ user, shops });
  });

  // Public waitlist summary (returns aggregate count only — zero PII or user fields)
  app.get('/api/waitlist', async (_req, res) => {
    res.json(await store.getWaitlistSummary());
  });

  // Invisible private Excel export route configured strictly via server-side env vars.
  // Never referenced in client code and returns 404 unless both secret path & key match.
  const stripWrappingQuotes = (val?: string) =>
    (val || '').trim().replace(/^["']|["']$/g, '').trim();

  const rawSecretRoute = stripWrappingQuotes(process.env.WAITLIST_SECRET_ROUTE);
  const rawAdminKey = stripWrappingQuotes(process.env.WAITLIST_ADMIN_KEY);
  if (
    rawSecretRoute &&
    rawAdminKey &&
    rawSecretRoute !== 'MY_WAITLIST_SECRET_ROUTE' &&
    rawAdminKey !== 'MY_WAITLIST_ADMIN_KEY'
  ) {
    let routePath = rawSecretRoute;
    if (/^https?:\/\//i.test(routePath)) {
      try {
        routePath = new URL(routePath).pathname;
      } catch {
        // Keep raw value if URL parsing fails
      }
    }
    routePath = routePath.replace(/\/+$/, '');
    if (!routePath.startsWith('/')) {
      routePath = `/${routePath}`;
    }
    if (!routePath.startsWith('/api/')) {
      routePath = `/api${routePath}`;
    }

    app.get(routePath, async (req, res) => {
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

        const entries = await store.getWaitlistEntries();
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
  app.post('/api/waitlist', async (req, res) => {
    try {
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

      const result = await store.joinWaitlist({
        fullName: cleanName,
        shopName: cleanShop,
        city: cleanCity || 'Lagos, Nigeria',
        email: cleanEmail,
        whatsappNumber: cleanPhone,
        storeCategory: safeCategory,
        staffCountRange: safeRange,
      });

      res.status(result.alreadyJoined ? 200 : 201).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Waitlist signup failed.';
      res.status(500).json({ error: message });
    }
  });

  // List accessible shops (demo shops + authenticated owner's private shops)
  app.get('/api/shops', async (req, res) => {
    const session = parseSessionToken(req);
    const shops = await store.getAccessibleShops(session?.userId);
    res.json({ shops });
  });

  // Create a new isolated shop tenant
  app.post('/api/shops', async (req, res) => {
    const session = parseSessionToken(req);
    const {
      name,
      location,
      category,
      whatsappNumber,
      whatsappPhoneNumberId,
      ownerName,
      ownerPhone,
      planId,
    } = req.body || {};
    if (!name || !location || !whatsappNumber || !ownerName || !ownerPhone) {
      res.status(400).json({
        error: 'Shop name, location, WhatsApp number, owner name, and owner phone are required.',
      });
      return;
    }
    const shop = await store.createShop({
      ownerUserId: session?.userId || null,
      isDemo: !session,
      name: String(name),
      location: String(location),
      category: String(category || 'Supermarket & Provisions'),
      whatsappNumber: String(whatsappNumber),
      whatsappPhoneNumberId: whatsappPhoneNumberId ? String(whatsappPhoneNumberId) : null,
      ownerName: String(ownerName),
      ownerPhone: String(ownerPhone),
      planId: (planId as SubscriptionPlanId) || 'starter',
    });
    res.status(201).json({ shop });
  });

  // Get full dashboard snapshot for a single shop
  app.get('/api/shops/:shopId/dashboard', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    const session = parseSessionToken(req);
    const snapshot = await store.getDashboardSnapshot(shop.id, session?.userId);
    if (!snapshot) {
      res.status(404).json({ error: 'Shop not found.' });
      return;
    }
    res.json(snapshot);
  });

  // Update shop WhatsApp connection, Phone Number ID, or subscription plan
  app.patch('/api/shops/:shopId/config', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    const {
      whatsappNumber,
      whatsappPhoneNumberId,
      whatsappConnected,
      planId,
      name,
      location,
    } = req.body || {};

    const updated = await store.updateShopConfig(shop.id, {
      whatsappNumber,
      whatsappPhoneNumberId,
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
  app.post('/api/shops/:shopId/products', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

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
      res.status(400).json({
        error: 'Product name, pack size, selling price, and stock quantity are required.',
      });
      return;
    }

    const product = await store.createProduct(shop.id, {
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

  app.post('/api/shops/:shopId/products/import', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    const { items, actorName, actorRole } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Provide an array of products to import.' });
      return;
    }
    const imported = await store.bulkImportProducts(
      shop.id,
      items,
      String(actorName || 'Shop Owner'),
      (actorRole as StaffRole) || 'owner'
    );
    res.status(201).json({ importedCount: imported.length, products: imported });
  });

  app.patch('/api/shops/:shopId/products/:productId', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

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

    const updated = await store.updateProduct(shop.id, req.params.productId, {
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

  app.delete('/api/shops/:shopId/products/:productId', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    const deleted = await store.deleteProduct(shop.id, req.params.productId);
    if (!deleted) {
      res.status(404).json({ error: 'Product not found in this shop.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/shops/:shopId/products/:productId/dismiss-review', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    const { actorName, actorRole } = req.body || {};
    const updated = await store.dismissPriceReview(
      shop.id,
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

  app.post('/api/shops/:shopId/purchases', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    const { productId, supplierName, quantity, unitCost, expiryDate, note, actorName, actorRole } =
      req.body || {};
    if (!productId || !quantity || unitCost === undefined) {
      res.status(400).json({ error: 'productId, quantity, and unitCost are required.' });
      return;
    }
    const result = await store.recordPurchase(shop.id, {
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

  app.post('/api/shops/:shopId/stock-loss', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    const { productId, quantityDelta, reason, note, actorName, actorRole } = req.body || {};
    if (!productId || quantityDelta === undefined || !reason) {
      res.status(400).json({ error: 'productId, quantityDelta, and reason are required.' });
      return;
    }
    const result = await store.recordStockAdjustmentWithReason(shop.id, {
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

  app.post('/api/shops/:shopId/stock-count', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    const { counts, actorName, actorRole } = req.body || {};
    if (!Array.isArray(counts) || counts.length === 0) {
      res.status(400).json({ error: 'Provide counted quantities to reconcile.' });
      return;
    }
    const summary = await store.submitPhysicalStockCount(
      shop.id,
      counts,
      String(actorName || 'Shop Owner'),
      (actorRole as StaffRole) || 'owner'
    );
    res.json(summary);
  });

  app.post('/api/shops/:shopId/notifications/read', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    await store.markNotificationsRead(shop.id);
    res.json({ ok: true });
  });

  app.post('/api/shops/:shopId/staff', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    const { name, phone, role, actorName } = req.body || {};
    if (!name || !phone || !role) {
      res.status(400).json({ error: 'Staff name, phone number, and role are required.' });
      return;
    }
    const member = await store.addStaffMember(shop.id, {
      name: String(name),
      phone: String(phone),
      role: role as StaffRole,
      actorName: String(actorName || 'Shop Owner'),
    });
    res.status(201).json({ member });
  });

  app.patch('/api/shops/:shopId/staff/:staffId', async (req, res) => {
    const shop = await authorizeShopAccess(req, res, req.params.shopId);
    if (!shop) return;

    const { role, active, name, phone, actorName } = req.body || {};
    const updated = await store.updateStaffMember(shop.id, req.params.staffId, {
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

  // Meta WhatsApp Webhook Verification Handshake (GET)
  app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : undefined;
    const token =
      typeof req.query['hub.verify_token'] === 'string'
        ? req.query['hub.verify_token']
        : undefined;
    const challenge =
      typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : undefined;

    const verified = verifyWebhookChallenge(mode, token, challenge);
    if (!verified.ok || !verified.challenge) {
      res.status(403).send('Forbidden');
      return;
    }

    res.status(200).type('text/plain').send(verified.challenge);
  });

  // Dual WhatsApp Business Cloud API + Simulator Webhook (POST)
  app.post('/api/whatsapp/webhook', async (req: RequestWithRawBody, res) => {
    try {
      // Branch 1: Real Meta WhatsApp Cloud API payload
      if (req.body && req.body.object === 'whatsapp_business_account') {
        const sigCheck = verifyMetaSignature(req.rawBody, req.header('x-hub-signature-256'));
        if (!sigCheck.valid) {
          res.status(401).json({ error: 'Invalid Meta webhook signature.' });
          return;
        }

        const incomingMessages = parseMetaWebhookPayload(req.body);
        const results: Array<{ messageId: string; status: string; outboundSent: boolean }> = [];

        for (const msg of incomingMessages) {
          if (msg.kind === 'unsupported') {
            const sent = await sendMetaWhatsAppReply({
              phoneNumberId: msg.phoneNumberId,
              to: msg.fromPhone,
              replyText:
                'Sabi AI currently reads text messages and WhatsApp voice notes. Please type your product question or send a short voice note.',
            });
            results.push({
              messageId: msg.messageId,
              status: 'unsupported_type',
              outboundSent: sent.sent,
            });
            continue;
          }

          let textToProcess = msg.text;
          if (msg.kind === 'audio' && msg.audioId) {
            const media = await downloadMetaMediaAsBase64(msg.audioId);
            if (!media) {
              const sent = await sendMetaWhatsAppReply({
                phoneNumberId: msg.phoneNumberId,
                to: msg.fromPhone,
                replyText:
                  'Could not download that WhatsApp voice note. Please check your message or type the product name.',
              });
              results.push({
                messageId: msg.messageId,
                status: 'media_download_failed',
                outboundSent: sent.sent,
              });
              continue;
            }
            const transcript = await transcribeVoiceNote(media.base64, media.mimeType);
            if (!transcript) {
              const sent = await sendMetaWhatsAppReply({
                phoneNumberId: msg.phoneNumberId,
                to: msg.fromPhone,
                replyText:
                  'I could not hear that voice note clearly. Please try again or type the product name.',
              });
              results.push({
                messageId: msg.messageId,
                status: 'empty_transcript',
                outboundSent: sent.sent,
              });
              continue;
            }
            textToProcess = transcript;
          }

          const result = await processIncomingWhatsAppEvent({
            messageId: msg.messageId,
            phoneNumberId: msg.phoneNumberId,
            toBusinessPhone: msg.displayPhoneNumber,
            fromPhone: msg.fromPhone,
            messageText: textToProcess,
            interactiveReplyId: msg.interactiveReplyId,
          });

          if (result.status !== 'duplicate' && result.replyText) {
            const outbound = await sendMetaWhatsAppReply({
              phoneNumberId: result.whatsappPhoneNumberId || msg.phoneNumberId,
              to: msg.fromPhone,
              replyText: result.replyText,
              options: result.options,
              pendingConfirmation: result.pendingConfirmation,
            });
            results.push({
              messageId: msg.messageId,
              status: result.status,
              outboundSent: outbound.sent,
            });
          } else {
            results.push({
              messageId: msg.messageId,
              status: result.status,
              outboundSent: false,
            });
          }
        }

        res.status(200).json({ ok: true, processed: results });
        return;
      }

      // Branch 2: In-app WhatsApp Simulator JSON payload
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

  // Voice note transcription + WhatsApp lookup pipeline (Simulator)
  app.post('/api/whatsapp/voice', async (req, res) => {
    try {
      const { messageId, shopId, fromPhone, audioBase64, mimeType, history } = req.body || {};
      if (!fromPhone || !audioBase64) {
        res.status(400).json({ error: 'fromPhone and audioBase64 are required.' });
        return;
      }

      const transcript = await transcribeVoiceNote(
        String(audioBase64),
        String(mimeType || 'audio/webm')
      );
      if (!transcript) {
        res.status(422).json({
          error: 'Could not transcribe voice note clearly. Please try speaking closer to the mic.',
        });
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
