'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  LifeBuoy, Search, Mail, KeyRound, Ban, Send, User,
  Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DashboardInfo } from '@/components/admin/dashboard-info';

// ═══════════════════════════════════════════════════════════════════════
// UserSupportPanel — Soporte rapido a usuarios desde el Control Center
//
// PERMITE AL ADMIN:
//   1. Buscar a un usuario por email/nombre de negocio
//   2. Resetear password (dispara email de Supabase)
//   3. Acceder al detalle completo del tenant
//
// ⓘ ACTUALIZACIÓN (May 23 2026):
// Agregado DashboardInfo al titulo "Soporte a usuarios" para que Hugo
// entienda que se puede hacer desde este panel.
// ═══════════════════════════════════════════════════════════════════════

interface SearchResult {
  user_id: string;
  email: string;
  business_name: string | null;
  plan_type: string | null;
  last_sign_in_at: string | null;
  state: string | null;
  city: string | null;
}

async function searchUsers(query: string): Promise<SearchResult[]> {
  if (!query.trim() || query.length < 3) return [];

  const supabase = createClient();

  const { data, error } = await supabase
    .from('business_profiles')
    .select('user_id, business_name, state, city')
    .ilike('business_name', `%${query}%`)
    .limit(10);

  if (error) {
    console.error('[UserSupportPanel] Error:', error);
    return [];
  }

  return (data || []).map(r => ({
    user_id: r.user_id,
    email: '—',
    business_name: r.business_name,
    plan_type: null,
    last_sign_in_at: null,
    state: r.state,
    city: r.city,
  }));
}

export function UserSupportPanel() {
  const [query, setQuery] = useState('');
  const [emailForReset, setEmailForReset] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { data: results, isLoading } = useQuery({
    queryKey: ['user-search', query],
    queryFn: () => searchUsers(query),
    enabled: query.length >= 3,
  });

  async function handleResetPassword() {
    if (!emailForReset.trim()) {
      toast.error('Captura un email válido');
      return;
    }
    setResetLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        emailForReset.trim(),
        { redirectTo: 'https://book.vylta.lat/reset.html' }
      );
      if (error) throw error;
      toast.success(`Email de reset enviado a ${emailForReset}`);
      setEmailForReset('');
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar reset');
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px w-5 bg-vylta-gold/40" />
        <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-vylta-muted">
          Soporte a usuarios
        </h2>
        <DashboardInfo
          title="Soporte a usuarios"
          description="Panel para ayudar a los usuarios cuando reportan problemas. Buscas el negocio por nombre y le mandas un reset de contraseña, todo sin salir del CRM."
          metrics={[
            { label: 'Buscar negocio', meaning: 'Escribes el nombre del negocio (mínimo 3 letras) y aparecen los que coinciden, con su ciudad y estado.' },
            { label: 'Reset de contraseña', meaning: 'Captura el email del usuario y le llega un link para crear nueva contraseña. El link dura 60 minutos.' },
          ]}
          whyMatters="Es la forma rápida de resolver el problema más común que reporta cualquier usuario: 'olvidé mi contraseña'. En lugar de mandarlos a un formulario externo, se lo resolvemos en segundos."
        />
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* CARD 1: Buscar usuario */}
        <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-vylta-gold" />
            <h3 className="text-sm font-bold text-vylta-bone">Buscar negocio</h3>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre del negocio (mínimo 3 letras)..."
              className="w-full h-10 rounded-lg border border-border bg-vylta-card/60 pl-9 pr-3 text-sm text-vylta-bone placeholder:text-vylta-subtle focus:outline-none focus:border-vylta-gold/50"
            />
          </div>

          <div className="mt-3 min-h-[120px]">
            {query.length < 3 ? (
              <div className="text-xs text-vylta-subtle italic py-4 text-center">
                Escribe al menos 3 letras para buscar
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-vylta-gold" />
              </div>
            ) : !results || results.length === 0 ? (
              <div className="text-xs text-vylta-subtle italic py-4 text-center">
                Sin resultados para "{query}"
              </div>
            ) : (
              <div className="space-y-1.5">
                {results.map((r) => (
                  <div
                    key={r.user_id}
                    className="group flex items-center gap-3 rounded-lg border border-border/50 bg-vylta-card/40 px-3 py-2 transition hover:border-vylta-gold/30"
                  >
                    <div className="h-7 w-7 rounded-full bg-vylta-green/15 flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-vylta-green" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-vylta-bone truncate">
                        {r.business_name || 'Sin nombre'}
                      </div>
                      <div className="text-[10px] text-vylta-muted truncate">
                        {r.city && r.state ? `${r.city}, ${r.state}` : r.state || 'Sin ubicación'}
                      </div>
                    </div>
                    <a
                      href={`/admin/tenants?user_id=${r.user_id}`}
                      className="text-[10px] font-bold text-vylta-muted opacity-0 group-hover:opacity-100 transition uppercase tracking-wider hover:text-vylta-gold"
                    >
                      Ver
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: Reset password */}
        <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-vylta-gold" />
            <h3 className="text-sm font-bold text-vylta-bone">Reset de contraseña</h3>
          </div>

          <p className="text-xs text-vylta-muted mb-3 leading-relaxed">
            Envía un email al usuario para que pueda restablecer su contraseña.
            El link es válido por 60 minutos.
          </p>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
            <input
              type="email"
              value={emailForReset}
              onChange={(e) => setEmailForReset(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full h-10 rounded-lg border border-border bg-vylta-card/60 pl-9 pr-3 text-sm text-vylta-bone placeholder:text-vylta-subtle focus:outline-none focus:border-vylta-gold/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleResetPassword();
              }}
            />
          </div>

          <button
            onClick={handleResetPassword}
            disabled={resetLoading || !emailForReset.trim()}
            className={cn(
              'mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition',
              'border border-vylta-gold/30 bg-vylta-gold/10 text-vylta-gold',
              'hover:bg-vylta-gold/20 hover:border-vylta-gold/50',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {resetLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {resetLoading ? 'Enviando...' : 'Enviar email de reset'}
          </button>
        </div>
      </div>
    </div>
  );
}
