import { GoogleGenAI, Type } from '@google/genai';
import type { Product, Shop, StaffRole } from '../src/types.ts';

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface RequestedMutationAction {
  type: 'PRICE_UPDATE' | 'STOCK_ADJUST';
  productId: string;
  newPrice?: number;
  stockDelta?: number;
  reason?: string;
}

export interface GroundedWhatsAppAIResult {
  replyText: string;
  referencedProductIds: string[];
  ambiguousProductIds: string[];
  requestedAction: RequestedMutationAction | null;
  provider: 'groq' | 'gemini';
  model: string;
}

const PREFERRED_GROQ_CHAT_MODELS = [
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'qwen/qwen3-32b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
];

const PREFERRED_GROQ_AUDIO_MODELS = [
  'whisper-large-v3-turbo',
  'whisper-large-v3',
  'distil-whisper-large-v3-en',
];

let cachedGroqModels: { fetchedAt: number; ids: string[] } | null = null;
let lastWorkingGroqChatModel: string | null = null;
let lastWorkingGroqAudioModel: string | null = null;

function buildGroundedSystemPrompt(
  shop: Shop,
  products: Product[],
  staffName: string,
  staffRole: StaffRole
): string {
  const canViewCosts = staffRole === 'owner' || staffRole === 'manager';
  const todayStr = new Date().toISOString().slice(0, 10);

  const catalogueLines = products.map((p) => {
    const stockStatus =
      p.stockQuantity === 0
        ? 'OUT OF STOCK'
        : p.stockQuantity <= p.reorderLevel
        ? 'LOW STOCK'
        : 'IN STOCK';
    const expiryInfo = p.expiryDate ? ` | Exp:${p.expiryDate}` : '';
    const costInfo = canViewCosts
      ? ` | Cost:₦${p.costPrice.toLocaleString('en-NG')} | Margin:${
          p.sellingPrice > 0
            ? (((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(1)
            : '0.0'
        }% | Supplier:${p.supplierName}${p.priceReviewFlag ? ' | NEEDS_PRICE_REVIEW' : ''}`
      : '';
    return `- ID:${p.id} | ${p.name} (${p.packSize}) | SKU:${p.sku} | Cat:${p.category} | Price:₦${p.sellingPrice.toLocaleString('en-NG')} | Stock:${p.stockQuantity} ${p.unit} (${stockStatus}, reorder≤${p.reorderLevel})${expiryInfo}${costInfo}`;
  });

  return `You are Sabi AI, a sharp, helpful, conversational WhatsApp shop assistant for "${shop.name}" (${shop.location}).
Today's date: ${todayStr}.
You are currently chatting with staff member: ${staffName} (Role: ${staffRole.toUpperCase()}).

AUTHORITATIVE SHOP DATABASE (ONLY SOURCE OF TRUTH):
${catalogueLines.length > 0 ? catalogueLines.join('\n') : '(No products registered in this shop yet.)'}

YOUR CAPABILITIES & RULES:
1. Answer naturally, warmly, and concisely like a real, capable Nigerian supermarket assistant on WhatsApp. Understand standard English, retail shorthand ("2 cartons", "how much for 3"), typos, and Nigerian Pidgin ("abeg how much be...", "wetin remain").
2. Use the conversation history to resolve follow-ups like "what about the 900g?", "make it 3", "and Peak milk?", or "the sachet one".
3. Support rich queries using ONLY the database above:
   - Single product price & stock lookups
   - Multi-item basket calculations (show itemized breakdown + exact ₦ total!)
   - Category browsing ("what beverages do we have?", "show all Indomie sizes")
   - Low-stock / out-of-stock / expiry summaries ("what is running low?", "anything expiring soon or expired?")
   - Price comparisons ("cheapest Milo", "difference between 400g and 900g")
   ${
     canViewCosts
       ? '- Cost price, gross margin %, and flagged price-review recommendations (available because caller is Owner/Manager).'
       : '- CONFIDENTIALITY: Caller is an Attendant. NEVER share supplier cost prices or profit margins—stick strictly to selling prices, stock quantities, and expiry dates.'
   }
4. STRICT TRUTHFULNESS: NEVER invent, estimate, or guess any price, SKU, or stock number for a product not listed in the database above. If an item is not in the database, clearly say it is not recorded in ${shop.name}'s catalogue and suggest checking with the shop owner.
5. DISAMBIGUATION: If the user asks about a product name that has multiple sizes/variants in the database (e.g., "How much is Milo?") and did NOT specify a size or ask to list all sizes, ask which size they mean and put the matching product IDs in "ambiguousProductIds" so clickable size buttons appear.
6. MUTATIONS (PRICE_UPDATE / STOCK_ADJUST):
   - If the staff member asks to change a price (e.g. "change Milo 400g to 5200") or adjust stock (e.g. "add 5 tins to Milo 400g" or "I just sold 2 bags of Semovita"), set "requestedAction" with exact "productId" from the database, "type", and either "newPrice" or "stockDelta" (negative when sold/deducted, positive when restocked).
   - Note: If staffRole is "attendant", they are NOT permitted to change prices or adjust stock—still populate "requestedAction" so the server enforces and logs the security rule, or explain politely.

OUTPUT FORMAT:
Return ONLY a valid JSON object (no markdown fences) with these exact keys:
{
  "replyText": string,
  "referencedProductIds": string[],
  "ambiguousProductIds": string[],
  "requestedAction": null | {
    "type": "PRICE_UPDATE" | "STOCK_ADJUST",
    "productId": string,
    "newPrice": number | null,
    "stockDelta": number | null,
    "reason": string
  }
}`;
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  }
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function normalizeGroundedResult(
  rawObj: Record<string, unknown>,
  validProductIds: Set<string>,
  provider: 'groq' | 'gemini',
  model: string
): GroundedWhatsAppAIResult {
  const replyText = String(rawObj.replyText ?? '').trim() || 'Could you please repeat that product question?';

  const referencedProductIds = Array.isArray(rawObj.referencedProductIds)
    ? rawObj.referencedProductIds.map(String).filter((id) => validProductIds.has(id))
    : [];

  const ambiguousProductIds = Array.isArray(rawObj.ambiguousProductIds)
    ? rawObj.ambiguousProductIds.map(String).filter((id) => validProductIds.has(id))
    : [];

  let requestedAction: RequestedMutationAction | null = null;
  if (rawObj.requestedAction && typeof rawObj.requestedAction === 'object') {
    const act = rawObj.requestedAction as Record<string, unknown>;
    const productId = String(act.productId ?? '');
    const type = act.type === 'PRICE_UPDATE' || act.type === 'STOCK_ADJUST' ? act.type : null;
    if (type && validProductIds.has(productId)) {
      requestedAction = {
        type,
        productId,
        newPrice:
          typeof act.newPrice === 'number' && !Number.isNaN(act.newPrice)
            ? act.newPrice
            : undefined,
        stockDelta:
          typeof act.stockDelta === 'number' && !Number.isNaN(act.stockDelta)
            ? Math.round(act.stockDelta)
            : undefined,
        reason: act.reason ? String(act.reason) : undefined,
      };
    }
  }

  return {
    replyText,
    referencedProductIds,
    ambiguousProductIds,
    requestedAction,
    provider,
    model,
  };
}

function isGroqConfigured(): boolean {
  const key = process.env.GROQ_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GROQ_API_KEY');
}

async function fetchAvailableGroqModels(apiKey: string): Promise<string[]> {
  if (cachedGroqModels && Date.now() - cachedGroqModels.fetchedAt < 5 * 60_000) {
    return cachedGroqModels.ids;
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id?: string; active?: boolean }> };
    const ids = (data.data ?? [])
      .filter((m) => m.id && m.active !== false)
      .map((m) => m.id as string);
    cachedGroqModels = { fetchedAt: Date.now(), ids };
    return ids;
  } catch {
    return [];
  }
}

function isNonChatGroqModel(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.includes('whisper') ||
    lower.includes('guard') ||
    lower.includes('tts') ||
    lower.includes('orpheus') ||
    lower.includes('playai') ||
    lower.includes('safeguard') ||
    lower.includes('compound')
  );
}

async function getGroqChatCandidates(apiKey: string): Promise<string[]> {
  const liveIds = await fetchAvailableGroqModels(apiKey);
  if (liveIds.length > 0) {
    const chatIds = liveIds.filter((id) => !isNonChatGroqModel(id));
    const ordered: string[] = [];
    for (const pref of PREFERRED_GROQ_CHAT_MODELS) {
      if (chatIds.includes(pref) && !ordered.includes(pref)) {
        ordered.push(pref);
      }
    }
    for (const id of chatIds) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    if (ordered.length > 0) return ordered;
  }
  return PREFERRED_GROQ_CHAT_MODELS;
}

async function getGroqAudioCandidates(apiKey: string): Promise<string[]> {
  const liveIds = await fetchAvailableGroqModels(apiKey);
  if (liveIds.length > 0) {
    const audioIds = liveIds.filter((id) => id.toLowerCase().includes('whisper'));
    const ordered: string[] = [];
    if (lastWorkingGroqAudioModel && audioIds.includes(lastWorkingGroqAudioModel)) {
      ordered.push(lastWorkingGroqAudioModel);
    }
    for (const pref of PREFERRED_GROQ_AUDIO_MODELS) {
      if (audioIds.includes(pref) && !ordered.includes(pref)) {
        ordered.push(pref);
      }
    }
    for (const id of audioIds) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    if (ordered.length > 0) return ordered;
  }
  return PREFERRED_GROQ_AUDIO_MODELS;
}

export async function getActiveAiInfo(): Promise<{
  provider: 'groq' | 'gemini';
  textModel: string;
  audioModel: string;
}> {
  if (isGroqConfigured()) {
    const apiKey = process.env.GROQ_API_KEY!.trim();
    const chatCandidates = await getGroqChatCandidates(apiKey);
    const audioCandidates = await getGroqAudioCandidates(apiKey);
    return {
      provider: 'groq',
      textModel: lastWorkingGroqChatModel || chatCandidates[0] || 'openai/gpt-oss-120b',
      audioModel: lastWorkingGroqAudioModel || audioCandidates[0] || 'whisper-large-v3-turbo',
    };
  }
  return {
    provider: 'gemini',
    textModel: 'gemini-4-hydrogen',
    audioModel: 'gemini-3.5-transcribe',
  };
}

export async function generateGroundedWhatsAppReply(params: {
  shop: Shop;
  products: Product[];
  staffName: string;
  staffRole: StaffRole;
  messageText: string;
  history?: ChatHistoryTurn[];
}): Promise<GroundedWhatsAppAIResult> {
  const { shop, products, staffName, staffRole, messageText, history = [] } = params;
  const validIds = new Set(products.map((p) => p.id));
  const systemPrompt = buildGroundedSystemPrompt(shop, products, staffName, staffRole);
  const recentHistory = history.slice(-8);

  if (isGroqConfigured()) {
    const apiKey = process.env.GROQ_API_KEY!.trim();
    const candidates = await getGroqChatCandidates(apiKey);
    let lastError = 'No accessible Groq chat model found.';

    for (const model of candidates) {
      for (const useJsonFormat of [true, false]) {
        const messages = [
          { role: 'system', content: systemPrompt },
          ...recentHistory.map((h) => ({
            role: h.role,
            content: h.text,
          })),
          { role: 'user', content: messageText },
        ];

        const body: Record<string, unknown> = {
          model,
          temperature: 0.2,
          messages,
        };
        if (useJsonFormat) {
          body.response_format = { type: 'json_object' };
        }

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const raw = data.choices?.[0]?.message?.content ?? '{}';
          try {
            const parsed = extractJsonObject(raw);
            lastWorkingGroqChatModel = model;
            return normalizeGroundedResult(parsed, validIds, 'groq', model);
          } catch {
            // If model returned conversational text instead of JSON, wrap cleanly
            if (!useJsonFormat && raw.trim()) {
              lastWorkingGroqChatModel = model;
              return {
                replyText: raw.trim(),
                referencedProductIds: [],
                ambiguousProductIds: [],
                requestedAction: null,
                provider: 'groq',
                model,
              };
            }
          }
        } else {
          const errText = await res.text();
          lastError = `Groq API error (${res.status} on ${model}): ${errText}`;
          if (res.status === 404 || errText.includes('model_not_found')) {
            cachedGroqModels = null;
            break;
          }
          if (res.status !== 400) {
            break;
          }
        }
      }
    }

    throw new Error(lastError);
  }

  // Gemini fallback when GROQ_API_KEY is not configured
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Neither GROQ_API_KEY nor GEMINI_API_KEY is configured on the server.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const model = 'gemini-4-hydrogen';
  const conversationText = [
    ...recentHistory.map((h) => `${h.role === 'user' ? staffName : 'Assistant'}: ${h.text}`),
    `${staffName}: ${messageText}`,
  ].join('\n');

  const response = await ai.models.generateContent({
    model,
    contents: conversationText,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          replyText: { type: Type.STRING },
          referencedProductIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          ambiguousProductIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          requestedAction: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              type: { type: Type.STRING },
              productId: { type: Type.STRING },
              newPrice: { type: Type.NUMBER, nullable: true },
              stockDelta: { type: Type.NUMBER, nullable: true },
              reason: { type: Type.STRING, nullable: true },
            },
          },
        },
        required: ['replyText', 'referencedProductIds', 'ambiguousProductIds'],
      },
    },
  });

  const raw = (response.text ?? '{}').trim();
  const parsed = extractJsonObject(raw);
  return normalizeGroundedResult(parsed, validIds, 'gemini', model);
}

export async function transcribeVoiceNote(
  base64Audio: string,
  mimeType: string
): Promise<string> {
  if (isGroqConfigured()) {
    const apiKey = process.env.GROQ_API_KEY!.trim();
    const candidates = await getGroqAudioCandidates(apiKey);
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    const extension = mimeType.includes('mp4')
      ? 'm4a'
      : mimeType.includes('ogg')
      ? 'ogg'
      : mimeType.includes('wav')
      ? 'wav'
      : 'webm';

    let lastError = 'No accessible Groq Whisper model found.';
    for (const model of candidates) {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([audioBuffer], { type: mimeType || 'audio/webm' }),
        `voice_note.${extension}`
      );
      formData.append('model', model);
      formData.append('language', 'en');
      formData.append(
        'prompt',
        'Nigerian retail supermarket product enquiry: Milo, Peak milk, Indomie, Semovita, Royal Stallion rice, Naira prices.'
      );

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        lastWorkingGroqAudioModel = model;
        return (data.text ?? '').trim();
      }

      const errText = await res.text();
      lastError = `Groq Whisper error (${res.status} on ${model}): ${errText}`;
      if (res.status !== 404 && !errText.includes('model_not_found')) {
        break;
      }
    }
    throw new Error(lastError);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Neither GROQ_API_KEY nor GEMINI_API_KEY is configured on the server.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: base64Audio,
          },
        },
        {
          text: 'Transcribe this Nigerian retail shop voice note accurately into plain English text. Return only the spoken words.',
        },
      ],
    },
  });

  return (response.text ?? '').trim();
}
