'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  UserX,
  Phone,
  Copy,
  Send,
  Loader2,
  Sparkles,
  Clock,
  CalendarOff,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// ══════════════════════════════════════════════════════════════════════
// /clientes/inactivos — Lista de clientes sin visita reciente con plantillas
// pre-armadas de WhatsApp para reengancharlos.
//
// FIX (12 may 2026): la columna clients.total_spent NO existe en BD. Lo
// calculamos desde appointments con status Pagado/Completada, igual que en
// lib/clients.ts. Antes el SELECT tronaba con error 400 y la pantalla
// quedaba vacía.
//
// Buckets:
//   • 30-60 días (en riesgo)
//   • 60-90 días (inactivos)
//   • 90+ días (perdidos)
// ══════════════════════════════════════════════════════════════════════

type Bucket = 'risk' | 'inactive' | 'lost';

interface InactiveClient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  last_visit: string;
  total_visits: number;
  total_spent: number;
  days: number;
  bucket: Bucket;
}

const PAID_STATUSES = ['Pagado', 'Completada'];

const BUCKET_META: Record<Bucket, { label: string; subtitle: string; icon: any; bg: string; text: string; border: string; bar: string }> = {
  risk:     { label: 'En riesgo',   subtitle: '30-60 días sin visita',  icon: Clock,       bg: 'bg-vylta-amber-500/10', text: 'text-vylta-amber-700 dark:text-amber-400', border: 'border-vylta-amber-500/40', bar: 'bg-vylta-amber-500' },
  inactive: { label: 'Inactivos',   subtitle: '60-90 días sin visita',  icon: CalendarOff, bg: 'bg-orange-500/10',      text: 'text-orange-700 dark:text-orange-400',     border: 'border-orange-500/40',      bar: 'bg-orange-500' },
  lost:     { label: 'Perdidos',    subtitle: '90+ días sin visita',    icon: UserX,       bg: 'bg-vylta-rose-500/10',  text: 'text-rose-700 dark:text-rose-400',         border: 'border-vylta-rose-500/40',  bar: 'bg-vylta-rose-500' },
};

const TEMPLATES: Array<{ id: string; bucket: Bucket; title: string; text: (name: string) => string }> = [
  {
    id: 'risk-1',
    bucket: 'risk',
    title: '👋 Saludo casual',
    text: (name) => `Hola ${name}, te extrañamos por aquí 😊 ¿Todo bien? Si quieres agendar tu próxima cita, avísame y te aparto el horario que prefieras.`,
  },
  {
    id: 'risk-2',
    bucket: 'risk',
    title: '✨ Recordatorio amable',
    text: (name) => `Hola ${name}! ¿Ya toca renovar tu look? Tenemos horarios disponibles esta semana, avísame cuándo te queda bien y te separamos tu cita.`,
  },
  {
    id: 'inactive-1',
    bucket: 'inactive',
    title: '🎁 Promo personalizada',
    text: (name) => `Hola ${name}, ha pasado un rato desde tu última visita y te queremos consentir. Tengo 15% de descuento especial para ti esta semana — ¿agendamos?`,
  },
  {
    id: 'inactive-2',
    bucket: 'inactive',
    title: '📝 Pregunta abierta',
    text: (name) => `Hola ${name}! Hace tiempo no te vemos. ¿Hay algo que podamos mejorar para tu próxima visita? Me encantaría saber cómo puedo ayudarte mejor 💙`,
  },
  {
    id: 'lost-1',
    bucket: 'lost',
    title: '💎 Te queremos de vuelta',
    text: (name) => `Hola ${name}, te extrañamos mucho. Como cliente especial, te ofrecemos 20% de descuento en tu próxima cita para celebrar tu regreso — ¿qué día te queda bien? ✨`,
  },
  {
    id: 'lost-2',
    bucket: 'lost',
    title: '💫 Renovación total',
    text: (name) => `Hola ${name}! Tenemos nuevos servicios y queremos que seas de las primeras en probarlos. ¿Te gustaría venir esta semana? Te aparto el mejor horario 👌`,
  },
];

export default function ClientesInactivosPage() {
  const [clients, setClients] = useState<InactiveClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket | 'all'>('all');
  const [selected, setSelected] = useState<InactiveClient | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const thirtyDaysAgo = (() => {
      const t = new Date();
      t.setDate(t.getDate() - 30);
      return t.toISOString().split('T')[0];
    })();

    // ── 1. Traer clientes con última visita > 30 días ──
    // IMPORTANTE: NO incluir total_spent en el SELECT — esa columna NO
    // existe en la tabla clients. Se calcula a partir de appointments.
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, phone, email, last_visit, total_visits')
      .eq('user_id', user.id)
      .not('last_visit', 'is', null)
      .lt('last_visit', thirtyDaysAgo)
      .order('last_visit', { ascending: false });

    if (clientsError) {
      console.error('[clientes/inactivos] Error clientes:', clientsError);
      toast.error('No pudimos cargar los clientes inactivos');
      setLoading(false);
      return;
    }

    const clientIds = (clientsData || []).map((c: any) => c.id);

    // ── 2. Traer appointments cobrados/completados para calcular total_spent ──
    // Solo de los clientes que ya filtramos, para no traer datos innecesarios.
    let spentByClient = new Map<string, number>();
    if (clientIds.length > 0) {
      const { data: apptsData, error: apptsError } = await supabase
        .from('appointments')
        .select('client_id, service_cost, status')
        .eq('user_id', user.id)
        .in('client_id', clientIds)
        .in('status', PAID_STATUSES);

      if (apptsError) {
        console.warn('[clientes/inactivos] Appointments query error:', apptsError);
      }

      (apptsData || []).forEach((a: any) => {
        if (!a.client_id) return;
        const prev = spentByClient.get(a.client_id) || 0;
        spentByClient.set(a.client_id, prev + (a.service_cost || 0));
      });
    }

    // ── 3. Decorar con días + bucket + total_spent ──
    const now = Date.now();
    const list: InactiveClient[] = (clientsData || []).map((c: any) => {
      const days = Math.floor((now - new Date(c.last_visit + 'T12:00:00').getTime()) / 86400000);
      let b: Bucket = 'risk';
      if (days >= 90) b = 'lost';
      else if (days >= 60) b = 'inactive';
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        last_visit: c.last_visit,
        total_visits: c.total_visits || 0,
        total_spent: spentByClient.get(c.id) || 0,
        days,
        bucket: b,
      };
    });
    setClients(list);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (bucket === 'all') return clients;
    return clients.filter(c => c.bucket === bucket);
  }, [clients, bucket]);

  const counts = useMemo(() => ({
    risk: clients.filter(c => c.bucket === 'risk').length,
    inactive: clients.filter(c => c.bucket === 'inactive').length,
    lost: clients.filter(c => c.bucket === 'lost').length,
  }), [clients]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold tracking-tight">Reenganchar clientes inactivos</h1>
          <p className="text-sm text-muted-foreground">
            Recupera clientes que no han venido en 30+ días con plantillas pre-armadas de WhatsApp.
          </p>
        </div>
      </div>

      {/* Resumen por bucket */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BucketCard bucket="risk" count={counts.risk} active={bucket === 'risk'} onClick={() => setBucket(bucket === 'risk' ? 'all' : 'risk')} />
        <BucketCard bucket="inactive" count={counts.inactive} active={bucket === 'inactive'} onClick={() => setBucket(bucket === 'inactive' ? 'all' : 'inactive')} />
        <BucketCard bucket="lost" count={counts.lost} active={bucket === 'lost'} onClick={() => setBucket(bucket === 'lost' ? 'all' : 'lost')} />
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-2.5">
          <h3 className="text-sm font-bold">
            {bucket === 'all' ? 'Todos los inactivos' : BUCKET_META[bucket].label}
          </h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{filtered.length}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => {
              const meta = BUCKET_META[c.bucket];
              const Icon = meta.icon;
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-secondary/30">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-vylta-green-500/10 text-xs font-bold text-vylta-green-700 dark:text-vylta-green-400">
                    {getInitials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{c.name}</span>
                      <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold', meta.bg, meta.text)}>
                        <Icon className="h-2.5 w-2.5" />
                        {c.days} días
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{c.phone}</span>}
                      <span>{c.total_visits} {c.total_visits === 1 ? 'visita' : 'visitas'}</span>
                      <span className="hidden tabular-nums sm:inline">{formatCurrency(c.total_spent)} total</span>
                    </div>
                  </div>
                  {c.phone ? (
                    <Button size="sm" onClick={() => setSelected(c)}>
                      <Send className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Reenganchar</span>
                    </Button>
                  ) : (
                    <span className="text-[11px] italic text-muted-foreground">Sin teléfono</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal de plantillas */}
      {selected && (
        <TemplateDialog
          client={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function BucketCard({ bucket, count, active, onClick }: { bucket: Bucket; count: number; active: boolean; onClick: () => void }) {
  const meta = BUCKET_META[bucket];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 bg-card p-4 text-left shadow-sm transition',
        active ? meta.border : 'border-border',
        active && meta.bg,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', meta.bg, meta.text)}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={cn('text-2xl font-bold tabular-nums', meta.text)}>{count}</span>
      </div>
      <h3 className={cn('mt-3 text-sm font-bold', active && meta.text)}>{meta.label}</h3>
      <p className="text-[11px] text-muted-foreground">{meta.subtitle}</p>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-vylta-green-500/10">
        <Sparkles className="h-6 w-6 text-vylta-green-600 dark:text-vylta-green-400" />
      </div>
      <h3 className="text-base font-bold">¡Todos tus clientes están al día!</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        No tienes clientes inactivos en este segmento. ¡Excelente trabajo!
      </p>
    </div>
  );
}

function TemplateDialog({ client, onClose }: { client: InactiveClient; onClose: () => void }) {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES.find(t => t.bucket === client.bucket)?.id || TEMPLATES[0].id);
  const [customText, setCustomText] = useState('');
  const [edited, setEdited] = useState(false);

  const template = TEMPLATES.find(t => t.id === selectedTemplate)!;
  const text = edited ? customText : template.text(client.name.split(' ')[0]);

  function selectTemplate(id: string) {
    setSelectedTemplate(id);
    setEdited(false);
  }

  function copy() {
    navigator.clipboard.writeText(text);
    toast.success('Mensaje copiado');
  }

  function openWhatsApp() {
    if (!client.phone) return;
    const phone = client.phone.replace(/\D/g, '');
    const encoded = encodeURIComponent(text);
    const url = `https://wa.me/${phone}?text=${encoded}`;
    window.open(url, '_blank');
    toast.success('WhatsApp abierto');
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reenganchar a {client.name.split(' ')[0]}</DialogTitle>
          <DialogDescription>
            Elige una plantilla, edita si quieres, y envíala directo por WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Plantillas */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Plantillas sugeridas</p>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => {
                const isActive = selectedTemplate === t.id;
                const meta = BUCKET_META[t.bucket];
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t.id)}
                    className={cn(
                      'rounded-lg border-2 p-2 text-left text-xs transition',
                      isActive ? meta.border : 'border-border bg-card hover:bg-secondary/50',
                      isActive && meta.bg,
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{t.title}</span>
                      {isActive && <CheckCircle2 className={cn('h-3.5 w-3.5', meta.text)} />}
                    </div>
                    <span className={cn('text-[9px] font-semibold uppercase', meta.text)}>{BUCKET_META[t.bucket].label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Texto del mensaje */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mensaje</p>
              <button
                onClick={() => { setEdited(false); }}
                className="text-[10px] font-semibold text-vylta-green-600 hover:underline dark:text-vylta-green-400"
              >
                Restaurar plantilla
              </button>
            </div>
            <Textarea
              value={text}
              onChange={(e) => { setCustomText(e.target.value); setEdited(true); }}
              rows={5}
              className="mt-1.5"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Puedes editar el texto antes de enviar. {client.name.split(' ')[0]} es el primer nombre del cliente.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={copy}>
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button onClick={openWhatsApp} disabled={!client.phone} className="bg-[#25D366] hover:bg-[#1FBA56]">
            <Send className="h-4 w-4" />
            Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
