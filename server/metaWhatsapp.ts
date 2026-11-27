import crypto from 'crypto';
import type { PendingConfirmation, WhatsAppCandidateOption } from '../src/types.ts';

function cleanEnv(val?: string): string {
  return (val || '').trim().replace(/^["']|["']$/g, '').trim();
}

const META_GRAPH_VERSION = 'v21.0';

export interface MetaWhatsAppReadiness {
  accessTokenConfigured: boolean;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
  defaultPhoneNumberIdConfigured: boolean;
}

export interface ParsedMetaIncomingMessage {
  phoneNumberId: string;
  displayPhoneNumber: string;
  messageId: string;
  fromPhone: string;
  contactName?: string;
  kind: 'text' | 'interactive' | 'audio' | 'unsupported';
  text: string;
  interactiveReplyId?: string;
  audioId?: string;
  audioMimeType?: string;
}

export function getMetaWhatsAppReadiness(): MetaWhatsAppReadiness {
  const accessToken = cleanEnv(process.env.WHATSAPP_ACCESS_TOKEN);
  const verifyToken = cleanEnv(process.env.WHATSAPP_VERIFY_TOKEN);
  const appSecret = cleanEnv(process.env.WHATSAPP_APP_SECRET);
  const phoneId = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID);

  return {
    accessTokenConfigured: Boolean(accessToken && accessToken !== 'MY_WHATSAPP_ACCESS_TOKEN'),
    verifyTokenConfigured: Boolean(verifyToken && verifyToken !== 'MY_WHATSAPP_VERIFY_TOKEN'),
    appSecretConfigured: Boolean(appSecret && appSecret !== 'MY_WHATSAPP_APP_SECRET'),
    defaultPhoneNumberIdConfigured: Boolean(phoneId && phoneId !== 'MY_WHATSAPP_PHONE_NUMBER_ID'),
  };
}

export function verifyWebhookChallenge(
  mode: string | undefined,
  token: string | undefined,
  challenge: string | undefined
): { ok: boolean; challenge?: string } {
  const expectedToken = cleanEnv(process.env.WHATSAPP_VERIFY_TOKEN);
  if (
    !expectedToken ||
    expectedToken === 'MY_WHATSAPP_VERIFY_TOKEN' ||
    mode !== 'subscribe' ||
    !token ||
    !challenge
  ) {
    return { ok: false };
  }

  const expectedDigest = crypto.createHash('sha256').update(expectedToken).digest();
  const actualDigest = crypto.createHash('sha256').update(token).digest();
  if (!crypto.timingSafeEqual(expectedDigest, actualDigest)) {
    return { ok: false };
  }

  return { ok: true, challenge };
}

export function verifyMetaSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined
): { enforced: boolean; valid: boolean } {
  const appSecret = cleanEnv(process.env.WHATSAPP_APP_SECRET);
  if (!appSecret || appSecret === 'MY_WHATSAPP_APP_SECRET') {
    return { enforced: false, valid: true };
  }

  if (!rawBody || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return { enforced: true, valid: false };
  }

  const expectedHex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const providedHex = signatureHeader.slice('sha256='.length).trim().toLowerCase();

  if (expectedHex.length !== providedHex.length) {
    return { enforced: true, valid: false };
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(expectedHex, 'utf8'),
    Buffer.from(providedHex, 'utf8')
  );
  return { enforced: true, valid };
}

export function parseMetaWebhookPayload(body: unknown): ParsedMetaIncomingMessage[] {
  if (!body || typeof body !== 'object') return [];
  const root = body as {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: {
          metadata?: {
            phone_number_id?: string;
            display_phone_number?: string;
          };
          contacts?: Array<{
            wa_id?: string;
            profile?: { name?: string };
          }>;
          messages?: Array<{
            id?: string;
            from?: string;
            type?: string;
            text?: { body?: string };
            button?: { payload?: string; text?: string };
            interactive?: {
              type?: string;
              button_reply?: { id?: string; title?: string };
              list_reply?: { id?: string; title?: string };
            };
            audio?: { id?: string; mime_type?: string };
          }>;
        };
      }>;
    }>;
  };

  if (root.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) {
    return [];
  }

  const parsed: ParsedMetaIncomingMessage[] = [];

  for (const entry of root.entry) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value || !Array.isArray(value.messages)) continue;

      const phoneNumberId = String(value.metadata?.phone_number_id || '').trim();
      const displayPhoneNumber = String(value.metadata?.display_phone_number || '').trim();
      const contactMap = new Map<string, string>();
      for (const c of value.contacts || []) {
        if (c.wa_id && c.profile?.name) {
          contactMap.set(c.wa_id, c.profile.name);
        }
      }

      for (const msg of value.messages) {
        if (!msg.id || !msg.from) continue;

        const contactName = contactMap.get(msg.from);
        if (msg.type === 'text' && msg.text?.body) {
          parsed.push({
            phoneNumberId,
            displayPhoneNumber,
            messageId: msg.id,
            fromPhone: msg.from,
            contactName,
            kind: 'text',
            text: msg.text.body,
          });
        } else if (msg.type === 'interactive' && msg.interactive) {
          const reply = msg.interactive.button_reply || msg.interactive.list_reply;
          if (reply?.id) {
            parsed.push({
              phoneNumberId,
              displayPhoneNumber,
              messageId: msg.id,
              fromPhone: msg.from,
              contactName,
              kind: 'interactive',
              text: reply.title || reply.id,
              interactiveReplyId: reply.id,
            });
          }
        } else if (msg.type === 'button' && msg.button?.payload) {
          parsed.push({
            phoneNumberId,
            displayPhoneNumber,
            messageId: msg.id,
            fromPhone: msg.from,
            contactName,
            kind: 'interactive',
            text: msg.button.text || msg.button.payload,
            interactiveReplyId: msg.button.payload,
          });
        } else if (msg.type === 'audio' && msg.audio?.id) {
          parsed.push({
            phoneNumberId,
            displayPhoneNumber,
            messageId: msg.id,
            fromPhone: msg.from,
            contactName,
            kind: 'audio',
            text: '',
            audioId: msg.audio.id,
            audioMimeType: msg.audio.mime_type || 'audio/ogg',
          });
        } else {
          parsed.push({
            phoneNumberId,
            displayPhoneNumber,
            messageId: msg.id,
            fromPhone: msg.from,
            contactName,
            kind: 'unsupported',
            text: '',
          });
        }
      }
    }
  }

  return parsed;
}

function isAllowedMetaMediaHost(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'lookaside.fbsbx.com' ||
      host.endsWith('.fbsbx.com') ||
      host.endsWith('.facebook.com') ||
      host.endsWith('.fbcdn.net') ||
      host.endsWith('.whatsapp.net')
    );
  } catch {
    return false;
  }
}

export async function downloadMetaMediaAsBase64(
  mediaId: string
): Promise<{ base64: string; mimeType: string } | null> {
  const accessToken = cleanEnv(process.env.WHATSAPP_ACCESS_TOKEN);
  if (!accessToken || accessToken === 'MY_WHATSAPP_ACCESS_TOKEN') {
    return null;
  }

  const metaRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(mediaId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!metaRes.ok) {
    console.warn(`Meta media metadata lookup failed (${metaRes.status})`);
    return null;
  }

  const metaJson = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!metaJson.url || !isAllowedMetaMediaHost(metaJson.url)) {
    console.warn('Meta media URL failed trusted host check.');
    return null;
  }

  const binRes = await fetch(metaJson.url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!binRes.ok) {
    console.warn(`Meta media binary download failed (${binRes.status})`);
    return null;
  }

  const arrayBuffer = await binRes.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return {
    base64,
    mimeType: metaJson.mime_type || 'audio/ogg',
  };
}

function clipText(text: string, maxLen: number): string {
  const clean = text.trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trim()}…`;
}

export async function sendMetaWhatsAppReply(params: {
  phoneNumberId?: string | null;
  to: string;
  replyText: string;
  options?: WhatsAppCandidateOption[];
  pendingConfirmation?: PendingConfirmation;
}): Promise<{ sent: boolean; reason?: string }> {
  const accessToken = cleanEnv(process.env.WHATSAPP_ACCESS_TOKEN);
  if (!accessToken || accessToken === 'MY_WHATSAPP_ACCESS_TOKEN') {
    return { sent: false, reason: 'WHATSAPP_ACCESS_TOKEN not configured' };
  }

  const targetPhoneNumberId =
    cleanEnv(params.phoneNumberId || undefined) ||
    cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID);

  if (!targetPhoneNumberId || targetPhoneNumberId === 'MY_WHATSAPP_PHONE_NUMBER_ID') {
    return { sent: false, reason: 'No Meta Phone Number ID configured for shop' };
  }

  const recipient = params.to.replace(/\D/g, '');
  if (!recipient) {
    return { sent: false, reason: 'Invalid recipient phone number' };
  }

  let messageBody: Record<string, unknown>;

  if (params.pendingConfirmation) {
    messageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: clipText(params.replyText, 1024),
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: 'confirm:apply',
                title: 'Confirm Update',
              },
            },
            {
              type: 'reply',
              reply: {
                id: 'cancel_action',
                title: 'Cancel',
              },
            },
          ],
        },
      },
    };
  } else if (params.options && params.options.length >= 2 && params.options.length <= 3) {
    messageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: clipText(params.replyText, 1024),
        },
        action: {
          buttons: params.options.map((opt) => ({
            type: 'reply',
            reply: {
              id: `pick:${opt.productId}`,
              title: clipText(opt.packSize || opt.label, 20),
            },
          })),
        },
      },
    };
  } else if (params.options && params.options.length > 3) {
    messageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: clipText(params.replyText, 1024),
        },
        action: {
          button: 'Choose Size',
          sections: [
            {
              title: 'Available Sizes',
              rows: params.options.slice(0, 10).map((opt) => ({
                id: `pick:${opt.productId}`,
                title: clipText(opt.packSize || opt.label, 24),
                description: clipText(
                  `₦${opt.sellingPrice.toLocaleString('en-NG')} · ${opt.stockQuantity} ${opt.unit}`,
                  72
                ),
              })),
            },
          ],
        },
      },
    };
  } else {
    messageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: false,
        body: clipText(params.replyText, 4096),
      },
    };
  }

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(targetPhoneNumberId)}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(messageBody),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Meta WhatsApp send failed (${res.status}):`, errText);
    return { sent: false, reason: `Meta API ${res.status}` };
  }

  return { sent: true };
}
