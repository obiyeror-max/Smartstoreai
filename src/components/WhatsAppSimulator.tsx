import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Mic,
  RotateCcw,
  Send,
  ShieldAlert,
  Square,
} from 'lucide-react';
import type {
  PendingConfirmation,
  Shop,
  StaffMember,
  StaffNotification,
  WhatsAppChatMessage,
} from '../types';
import { api } from '../lib/api';
import { formatNaira, formatTimeShort } from '../lib/format';

interface WhatsAppSimulatorProps {
  shop: Shop;
  staff: StaffMember[];
  notifications?: StaffNotification[];
  externalPrompt: { id: number; text: string } | null;
  onDatabaseUpdated: () => Promise<void>;
}

const UNKNOWN_PHONE = '+2348120009999';

export function WhatsAppSimulator({
  shop,
  staff,
  notifications = [],
  externalPrompt,
  onDatabaseUpdated,
}: WhatsAppSimulatorProps) {
  const defaultSenderPhone = useMemo(() => {
    const attendant = staff.find((s) => s.role === 'attendant' && s.active);
    return attendant?.phone || staff[0]?.phone || UNKNOWN_PHONE;
  }, [staff]);

  const [selectedPhone, setSelectedPhone] = useState<string>(defaultSenderPhone);
  const [messagesByShop, setMessagesByShop] = useState<Record<string, WhatsAppChatMessage[]>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showWebhookJson, setShowWebhookJson] = useState(false);
  const [lastWebhookDebug, setLastWebhookDebug] = useState<{
    request: Record<string, unknown>;
    response: Record<string, unknown>;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const handledPromptIdRef = useRef<number | null>(null);

  // Keep selected phone synced when switching shops
  useEffect(() => {
    setSelectedPhone(defaultSenderPhone);
  }, [shop.id, defaultSenderPhone]);

  const activeMessages: WhatsAppChatMessage[] = useMemo(() => {
    const existing = messagesByShop[shop.id];
    if (existing && existing.length > 0) return existing;
    return [
      {
        id: `welcome_${shop.id}`,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        text: `Good afternoon. You are chatting with ${shop.name}'s SmartStore AI assistant.\nAsk naturally for any price or stock level—no special commands needed.`,
      },
    ];
  }, [messagesByShop, shop.id, shop.name]);

  const selectedPersona = useMemo(() => {
    const match = staff.find((s) => s.phone === selectedPhone);
    if (match) return match;
    return {
      id: 'unknown',
      name: 'Unregistered Number',
      phone: UNKNOWN_PHONE,
      role: 'external' as const,
      active: false,
    };
  }, [staff, selectedPhone]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, sending]);

  function appendMessage(shopId: string, msg: WhatsAppChatMessage) {
    setMessagesByShop((prev) => {
      const current = prev[shopId] || [
        {
          id: `welcome_${shopId}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Good afternoon. You are chatting with ${shop.name}'s SmartStore AI assistant.\nAsk naturally for any price or stock level—no special commands needed.`,
        },
      ];
      return { ...prev, [shopId]: [...current, msg] };
    });
  }

  async function sendTextMessage(
    text: string,
    opts?: { selectedProductId?: string; confirmedAction?: PendingConfirmation }
  ) {
    const trimmed = text.trim();
    if (!trimmed && !opts?.selectedProductId && !opts?.confirmedAction) return;

    const now = new Date().toISOString();
    const messageId = `wamid.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    const recentHistory = activeMessages
      .filter((m) => !m.id.startsWith('welcome_'))
      .slice(-8)
      .map((m) => ({
        role: (m.sender === 'attendant' ? 'user' : 'assistant') as 'user' | 'assistant',
        text: m.text,
      }));

    appendMessage(shop.id, {
      id: messageId,
      sender: 'attendant',
      text: trimmed,
      timestamp: now,
      senderName: selectedPersona.name,
      senderRole: selectedPersona.role,
    });

    setSending(true);
    const requestPayload = {
      messageId,
      shopId: shop.id,
      toBusinessPhone: shop.whatsappNumber,
      fromPhone: selectedPhone,
      messageText: trimmed,
      history: recentHistory,
      ...(opts?.selectedProductId ? { selectedProductId: opts.selectedProductId } : {}),
      ...(opts?.confirmedAction ? { confirmedAction: opts.confirmedAction } : {}),
    };

    try {
      const res = await api.sendWhatsAppMessage(requestPayload);
      setLastWebhookDebug({
        request: requestPayload,
        response: res as unknown as Record<string, unknown>,
      });

      appendMessage(shop.id, {
        id: `reply_${messageId}`,
        sender: 'assistant',
        text: res.replyText,
        timestamp: new Date().toISOString(),
        accessDenied: res.accessDenied,
        options: res.options,
        pendingConfirmation: res.pendingConfirmation,
      });

      await onDatabaseUpdated();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unable to reach SmartStore backend.';
      appendMessage(shop.id, {
        id: `err_${messageId}`,
        sender: 'assistant',
        text: `Error: ${errMsg}`,
        timestamp: new Date().toISOString(),
        accessDenied: true,
      });
    } finally {
      setSending(false);
    }
  }

  // Triggered when clicking a quick demo prompt in the Owner Dashboard
  useEffect(() => {
    if (externalPrompt && externalPrompt.id !== handledPromptIdRef.current) {
      handledPromptIdRef.current = externalPrompt.id;
      void sendTextMessage(externalPrompt.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt]);

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input;
    setInput('');
    await sendTextMessage(text);
  }

  async function toggleVoiceRecording() {
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1] || '';
          if (!base64) return;

          const recentHistory = activeMessages
            .filter((m) => !m.id.startsWith('welcome_'))
            .slice(-8)
            .map((m) => ({
              role: (m.sender === 'attendant' ? 'user' : 'assistant') as 'user' | 'assistant',
              text: m.text,
            }));

          const messageId = `wamid.voice.${Date.now()}`;
          setSending(true);
          try {
            const res = await api.sendWhatsAppVoice({
              messageId,
              shopId: shop.id,
              fromPhone: selectedPhone,
              audioBase64: base64,
              mimeType: blob.type || 'audio/webm',
              history: recentHistory,
            });

            appendMessage(shop.id, {
              id: messageId,
              sender: 'attendant',
              text: res.transcript,
              isAudio: true,
              transcript: res.transcript,
              timestamp: new Date().toISOString(),
              senderName: selectedPersona.name,
              senderRole: selectedPersona.role,
            });

            appendMessage(shop.id, {
              id: `reply_${messageId}`,
              sender: 'assistant',
              text: res.replyText,
              timestamp: new Date().toISOString(),
              accessDenied: res.accessDenied,
              options: res.options,
              pendingConfirmation: res.pendingConfirmation,
            });

            setLastWebhookDebug({
              request: {
                endpoint: '/api/whatsapp/voice',
                shopId: shop.id,
                fromPhone: selectedPhone,
                transcript: res.transcript,
              },
              response: res as unknown as Record<string, unknown>,
            });

            await onDatabaseUpdated();
          } catch (err) {
            appendMessage(shop.id, {
              id: `err_${messageId}`,
              sender: 'assistant',
              text: `Voice note error: ${err instanceof Error ? err.message : 'Transcription failed'}`,
              timestamp: new Date().toISOString(),
              accessDenied: true,
            });
          } finally {
            setSending(false);
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      appendMessage(shop.id, {
        id: `mic_err_${Date.now()}`,
        sender: 'assistant',
        text: 'Microphone access is unavailable in this browser. Type your message below instead.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  function clearConversation() {
    setMessagesByShop((prev) => ({
      ...prev,
      [shop.id]: [
        {
          id: `welcome_${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Chat cleared. Connected to ${shop.name} (${shop.whatsappNumber}).`,
        },
      ],
    }));
  }

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Simulator Top Controls */}
      <div className="bg-[#075E54] text-white px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">WhatsApp Attendant Simulator</p>
            <p className="text-[11px] text-emerald-100 truncate font-mono tabular-nums">
              {shop.name} · {shop.whatsappNumber}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowWebhookJson((v) => !v)}
              title="Inspect webhook JSON"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                showWebhookJson ? 'bg-white/20 text-white' : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              <Code2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={clearConversation}
              title="Reset chat thread"
              className="p-1.5 text-emerald-100 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sender Persona Switcher */}
        <div className="mt-2.5 flex items-center gap-2">
          <label htmlFor="wa-persona" className="text-[11px] text-emerald-100 whitespace-nowrap">
            Send as:
          </label>
          <select
            id="wa-persona"
            value={selectedPhone}
            onChange={(e) => setSelectedPhone(e.target.value)}
            className="flex-1 min-w-0 bg-[#064E46] text-white text-xs rounded-md px-2 py-1 border border-emerald-400/30 focus:outline-none"
          >
            {staff.map((member) => (
              <option key={member.id} value={member.phone}>
                {member.name} ({member.role}
                {member.active ? '' : ' · suspended'})
              </option>
            ))}
            <option value={UNKNOWN_PHONE}>Unregistered Number ({UNKNOWN_PHONE})</option>
          </select>
        </div>
      </div>

      {/* Expandable Webhook Payload Inspector */}
      {showWebhookJson && (
        <div className="bg-slate-900 text-slate-200 p-3 text-[11px] font-mono border-b border-slate-700 max-h-48 overflow-y-auto shrink-0">
          <p className="text-emerald-400 font-semibold mb-1">
            POST /api/whatsapp/webhook (Meta Cloud API Adapter)
          </p>
          {lastWebhookDebug ? (
            <pre className="whitespace-pre-wrap break-all leading-relaxed text-slate-300">
              {JSON.stringify(lastWebhookDebug, null, 2)}
            </pre>
          ) : (
            <p className="text-slate-400">Send a message to inspect the live webhook payload and parsed Gemini NLU intent.</p>
          )}
        </div>
      )}

      {/* Latest Authorised Staff Price-Change Broadcast */}
      {(() => {
        const latestPriceNotif = notifications.find((n) => n.type === 'price_change');
        if (!latestPriceNotif) return null;
        return (
          <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-2 text-[11px] text-emerald-900 shrink-0">
            <span className="font-semibold">{latestPriceNotif.title}</span>
            <span className="text-emerald-700"> · {latestPriceNotif.message}</span>
          </div>
        );
      })()}

      {/* WhatsApp Chat Thread */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#EFEAE2] p-3.5 space-y-2.5">
        {activeMessages.map((msg) => {
          const isOut = msg.sender === 'attendant';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isOut ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-relaxed shadow-xs ${
                  isOut
                    ? 'bg-[#D9FDD3] text-slate-900 rounded-tr-none'
                    : msg.accessDenied
                    ? 'bg-red-50 border border-red-200 text-red-900 rounded-tl-none'
                    : 'bg-white text-slate-900 rounded-tl-none'
                }`}
              >
                {isOut && msg.senderName && (
                  <p className="text-[10px] font-medium text-emerald-800 mb-0.5">
                    {msg.senderName} ({msg.senderRole})
                    {msg.isAudio ? ' · Voice Note' : ''}
                  </p>
                )}

                {msg.accessDenied && (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-red-700 mb-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>Security boundary enforced</span>
                  </div>
                )}

                <p className="whitespace-pre-line break-words">{msg.text}</p>

                {/* Disambiguation option buttons */}
                {msg.options && msg.options.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2">
                    {msg.options.map((opt) => (
                      <button
                        key={opt.productId}
                        type="button"
                        disabled={sending}
                        onClick={() =>
                          sendTextMessage(opt.label, { selectedProductId: opt.productId })
                        }
                        className="w-full text-left px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="truncate">{opt.label}</span>
                        <span className="font-mono text-[11px] text-emerald-700 shrink-0 tabular-nums">
                          {formatNaira(opt.sellingPrice)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Pending confirmation button for Manager / Owner updates */}
                {msg.pendingConfirmation && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() =>
                        sendTextMessage(`Confirm: ${msg.pendingConfirmation?.productLabel}`, {
                          confirmedAction: msg.pendingConfirmation,
                        })
                      }
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Confirm Update
                    </button>
                  </div>
                )}

                <p className="mt-1 text-[10px] text-slate-400 text-right font-mono tabular-nums">
                  {formatTimeShort(msg.timestamp)}
                </p>
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex items-start">
            <div className="bg-white rounded-xl rounded-tl-none px-3 py-2 text-xs text-slate-500 shadow-xs">
              Checking {shop.name} inventory...
            </div>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Quick Role & Edge-Case Test Bar */}
      <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
        {[
          { label: 'Milo?', text: 'How much is Milo?' },
          {
            label: 'Basket quote',
            text: 'Customer wants 2 Milo 400g and 1 carton of Indomie Onion, how much total?',
          },
          { label: 'Low stock?', text: 'Which items are running low right now?' },
          { label: 'Set price ₦5,200', text: 'Change Milo 400g price to 5200' },
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            disabled={sending}
            onClick={() => sendTextMessage(chip.text)}
            className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-emerald-300 hover:text-emerald-800 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Message Input Bar */}
      <form
        onSubmit={handleFormSubmit}
        className="bg-[#F0F2F5] px-3 py-2.5 flex items-center gap-2 border-t border-slate-200 shrink-0"
      >
        <button
          type="button"
          onClick={toggleVoiceRecording}
          disabled={sending}
          title={recording ? 'Stop recording voice note' : 'Record WhatsApp voice note'}
          className={`p-2 rounded-full transition-colors shrink-0 cursor-pointer ${
            recording
              ? 'bg-red-600 text-white'
              : 'bg-white text-slate-600 hover:text-emerald-700 border border-slate-200'
          }`}
        >
          {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={recording || sending}
          placeholder={
            recording
              ? 'Recording voice note... tap stop to send'
              : 'Ask for any price or stock...'
          }
          className="flex-1 min-w-0 bg-white border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
        />

        <button
          type="submit"
          disabled={!input.trim() || sending || recording}
          aria-label="Send WhatsApp message"
          className="p-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 shrink-0 transition-colors cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
