'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Send,
  Bot,
  Loader2,
  Sparkles,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ══════════════════════════════════════════════════════════════════════
// ChatClient — UI del Chat IA en el CRM Web.
//
// REPLICA EL PATRÓN DE LA APP MÓVIL (settings/support-chat.tsx):
//   • Memoria por sesión (no persiste al recargar)
//   • Sugerencias iniciales clickeables
//   • Burbujas verde (usuario) / gris (asistente)
//   • Timestamp en cada mensaje
//   • Loading indicator mientras espera respuesta
//   • Manejo de errores PLAN_REQUIRED y RATE_LIMITED
//   • Llama a Edge Function `ai-chat` (ya deployada en Supabase)
//
// ESPECÍFICO DE WEB (vs móvil):
//   • Layout responsive con scroll interno (no fullscreen como móvil)
//   • Input en el footer fijo
//   • No requiere ajustes de teclado (es web)
//   • Enter envía mensaje, Shift+Enter agrega nueva línea
// ══════════════════════════════════════════════════════════════════════

type Role = 'user' | 'assistant';

interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  '¿Cómo agrego un servicio nuevo?',
  '¿Cómo configuro mi horario de comida?',
  '¿Qué incluye cada plan?',
  '¿Cómo comparto mi link de citas?',
];

export function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll al fondo cuando llegan mensajes nuevos o cuando empieza loading
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, loading]);

  // Auto-resize del textarea según el contenido
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  async function callAIChat(history: Message[], userText: string): Promise<string> {
    const apiMessages = history
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    apiMessages.push({ role: 'user', content: userText });

    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: { messages: apiMessages },
    });

    // Manejo de errores específicos retornados por la Edge Function.
    // Importante: supabase.functions.invoke devuelve `data` aunque haya error
    // HTTP, porque la Edge Function nos devuelve JSON con `code` y `error`.
    if (data?.code === 'PLAN_REQUIRED') {
      throw new Error(
        'El asistente IA está disponible en Plan Premium y Luxury. Actualiza tu plan en Configuración.',
      );
    }
    if (data?.code === 'RATE_LIMITED') {
      throw new Error(
        data.error || 'Has alcanzado el límite de mensajes hoy. Intenta de nuevo mañana.',
      );
    }
    if (data?.error) {
      throw new Error(data.error);
    }
    if (error && !data) {
      throw new Error('No se pudo conectar con el asistente. Verifica tu conexión.');
    }
    if (error) {
      throw new Error(error.message || 'Error al procesar tu mensaje.');
    }

    return data?.reply ?? 'No pude procesar la respuesta. Intenta de nuevo.';
  }

  async function sendMessage(text?: string) {
    const msgText = (text ?? input).trim();
    if (!msgText || loading) return;
    setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msgText,
      timestamp: new Date(),
    };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setLoading(true);

    try {
      const reply = await callAIChat(messages, msgText);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
        },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content:
            e?.message ||
            'Hubo un problema al conectar. Intenta de nuevo o escríbenos a soporte@vylta.lat',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía, Shift+Enter agrega nueva línea
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleClearConversation() {
    if (messages.length === 0) return;
    if (confirm('¿Seguro que quieres limpiar la conversación? Esta acción no se puede deshacer.')) {
      setMessages([]);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vylta-green/10 ring-1 ring-vylta-green/20">
            <Bot className="h-5 w-5 text-vylta-green" strokeWidth={2} />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-vylta-green ring-2 ring-background" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tightest text-vylta-bone">Asistente VYLTA</h1>
            <p className="text-xs text-vylta-green font-semibold">
              ● Activo · Disponible 24/7
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClearConversation}
          disabled={messages.length === 0 || loading}
        >
          <Trash2 className="h-4 w-4" />
          Limpiar
        </Button>
      </div>

      {/* MENSAJES (scroll interno) */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-6 space-y-4"
      >
        {messages.length === 0 && <WelcomeScreen onSelectQuestion={sendMessage} />}

        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}

        {loading && <TypingIndicator />}
      </div>

      {/* INPUT BAR */}
      <div className="border-t border-border pt-4 pb-2">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-vylta-card/60 px-3 py-2 focus-within:border-vylta-green/50 focus-within:ring-2 focus-within:ring-vylta-green/15 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta sobre VYLTA... (Shift+Enter para nueva línea)"
            disabled={loading}
            rows={1}
            maxLength={500}
            className="flex-1 resize-none bg-transparent text-sm text-vylta-bone outline-none placeholder:text-vylta-subtle min-h-[24px] max-h-[120px] leading-6 py-1"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
              !input.trim() || loading
                ? 'bg-vylta-card text-vylta-subtle cursor-not-allowed'
                : 'bg-vylta-green text-white hover:bg-vylta-green/90 cursor-pointer',
            )}
            aria-label="Enviar mensaje"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-vylta-subtle mt-2 text-center">
          El asistente solo responde dudas sobre VYLTA. Máximo 50 mensajes por día.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// WelcomeScreen — pantalla de bienvenida cuando no hay mensajes
// ─────────────────────────────────────────────────────────────────────
function WelcomeScreen({ onSelectQuestion }: { onSelectQuestion: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 max-w-2xl mx-auto text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-vylta-green/10 ring-1 ring-vylta-green/20">
        <Bot className="h-8 w-8 text-vylta-green" strokeWidth={2} />
      </div>
      <h2 className="text-lg font-bold text-vylta-bone mb-1">
        ¡Hola! Soy el asistente de VYLTA
      </h2>
      <p className="text-sm text-vylta-muted mb-6 max-w-md">
        Pregúntame lo que quieras sobre cómo usar la app. Estoy aquí para ayudarte 24/7.
      </p>

      <div className="w-full max-w-lg space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-vylta-subtle mb-3">
          Preguntas frecuentes
        </p>
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelectQuestion(q)}
            className="group w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-vylta-card/40 px-4 py-3 text-left transition-all hover:border-vylta-green/40 hover:bg-vylta-green/5"
          >
            <span className="flex items-center gap-2 text-sm text-vylta-bone">
              <Sparkles className="h-3.5 w-3.5 text-vylta-green shrink-0" />
              {q}
            </span>
            <Send className="h-3.5 w-3.5 text-vylta-subtle group-hover:text-vylta-green transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ChatBubble — burbuja de mensaje individual
// ─────────────────────────────────────────────────────────────────────
function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex items-end gap-2 px-1',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vylta-green text-white mb-1">
          <span className="text-xs font-bold">V</span>
        </div>
      )}
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-4 py-2.5 space-y-1',
          isUser
            ? 'bg-vylta-green text-white rounded-br-md'
            : 'bg-vylta-card text-vylta-bone rounded-bl-md border border-border',
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            'text-[10px] text-right',
            isUser ? 'text-white/65' : 'text-vylta-subtle',
          )}
        >
          {message.timestamp.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TypingIndicator — puntitos animados mientras el asistente responde
// ─────────────────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 px-1">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vylta-green text-white mb-1">
        <span className="text-xs font-bold">V</span>
      </div>
      <div className="rounded-2xl rounded-bl-md bg-vylta-card border border-border px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-vylta-green animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-vylta-green animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-vylta-green animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
