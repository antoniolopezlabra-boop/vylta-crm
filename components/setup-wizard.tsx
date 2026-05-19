'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2, ArrowRight, ArrowLeft, Building2, Scissors, Clock,
  CheckCircle2, Shield, Copy, ExternalLink, Phone, Sparkles,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ══════════════════════════════════════════════════════════════════════
// Setup Wizard — Onboarding guiado de 4 pasos.
//
// Filosofía:
//   • Cada paso captura LO MÍNIMO necesario para arrancar
//   • Stepper visual arriba indica progreso (cabeza fría = sabes dónde
//     estás)
//   • Botón "Saltar" en cada paso permite ir directo al dashboard si
//     el usuario prefiere configurar después
//   • Validación en cada paso antes de avanzar
//   • Guarda en Supabase al final del paso 3 (los pasos 1-3 se mantienen
//     en estado local; al pasar a 4 se hacen 3 inserts atómicos)
//
// Tablas afectadas (mismas que usa la app móvil):
//   • business_profiles (paso 1)
//   • services (paso 2)
//   • business_hours (paso 3, 7 rows, uno por día de semana)
//
// Tipos de negocio: subset de los 31 que tiene la app móvil. Lista
// curada para los más comunes en MX, mejorable después con más data.
// ══════════════════════════════════════════════════════════════════════

interface SetupWizardProps {
  userId: string;
  userName: string;
}

const BUSINESS_TYPES = [
  { id: 'salon',      label: 'Salón de belleza',  emoji: '💇' },
  { id: 'barberia',   label: 'Barbería',          emoji: '💈' },
  { id: 'spa',        label: 'Spa',               emoji: '🧖' },
  { id: 'unas',       label: 'Estudio de uñas',   emoji: '💅' },
  { id: 'estetica',   label: 'Clínica estética',  emoji: '✨' },
  { id: 'masajes',    label: 'Masajes',           emoji: '💆' },
  { id: 'consulta',   label: 'Consultorio',       emoji: '🩺' },
  { id: 'otro',       label: 'Otro',              emoji: '🏷️' },
];

const DAYS_OF_WEEK = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mié' },
  { id: 4, label: 'Jue' },
  { id: 5, label: 'Vie' },
  { id: 6, label: 'Sáb' },
  { id: 0, label: 'Dom' },
];

// Slug a partir del nombre del negocio (lowercase, sin acentos, guiones)
function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export function SetupWizard({ userId, userName }: SetupWizardProps) {
  const router = useRouter();

  // ──────────────────────────────────────────────────────────
  // Estado del wizard
  // ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);

  // Paso 1: Negocio
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<string>('salon');
  const [businessPhone, setBusinessPhone] = useState('');

  // Paso 2: Primer servicio
  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState('30');
  const [servicePrice, setServicePrice] = useState('');

  // Paso 3: Horarios
  // Días seleccionados (por defecto lun-vie); horario default 9-18.
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('18:00');

  // Paso 4: Link generado (computado)
  const slug = useMemo(() => slugify(businessName || `vylta-${userId.slice(0, 6)}`), [businessName, userId]);
  const publicLink = `https://book.vylta.lat/${slug}`;

  // ──────────────────────────────────────────────────────────
  // Validaciones
  // ──────────────────────────────────────────────────────────
  function validateStep1(): string | null {
    if (!businessName.trim()) return 'Ingresa el nombre de tu negocio';
    if (businessName.trim().length < 2) return 'El nombre es muy corto';
    if (!businessType) return 'Selecciona el tipo de negocio';
    return null;
  }

  function validateStep2(): string | null {
    if (!serviceName.trim()) return 'Ingresa el nombre del servicio';
    if (!servicePrice.trim()) return 'Ingresa el precio';
    const price = Number(servicePrice);
    if (isNaN(price) || price < 0) return 'El precio no es válido';
    const dur = Number(serviceDuration);
    if (isNaN(dur) || dur < 5) return 'La duración mínima es 5 minutos';
    return null;
  }

  function validateStep3(): string | null {
    if (activeDays.size === 0) return 'Selecciona al menos un día';
    if (openTime >= closeTime) return 'La hora de apertura debe ser antes del cierre';
    return null;
  }

  // ──────────────────────────────────────────────────────────
  // Avance del wizard
  // ──────────────────────────────────────────────────────────
  function handleNext() {
    let err: string | null = null;
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (step === 3) err = validateStep3();
    if (err) {
      toast.error(err);
      return;
    }
    if (step === 3) {
      handleFinish();
      return;
    }
    setStep(step + 1);
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  function toggleDay(dayId: number) {
    setActiveDays(prev => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  }

  // ──────────────────────────────────────────────────────────
  // Persistencia: al terminar paso 3, guardar todo en BD.
  // ──────────────────────────────────────────────────────────
  async function handleFinish() {
    if (saving) return;
    setSaving(true);

    const supabase = createClient();

    try {
      // 1. business_profile
      const { error: profileError } = await supabase
        .from('business_profiles')
        .upsert({
          user_id: userId,
          business_name: businessName.trim(),
          business_type: businessType,
          business_phone: businessPhone.trim() || null,
          slug,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (profileError) throw new Error(`Negocio: ${profileError.message}`);

      // 2. service
      const { error: serviceError } = await supabase
        .from('services')
        .insert({
          user_id: userId,
          name: serviceName.trim(),
          duration_minutes: Number(serviceDuration),
          price: Number(servicePrice),
          is_active: true,
        });

      if (serviceError) throw new Error(`Servicio: ${serviceError.message}`);

      // 3. business_hours (7 filas, una por día)
      const hoursRows = DAYS_OF_WEEK.map(d => ({
        user_id: userId,
        day_of_week: d.id,
        is_open: activeDays.has(d.id),
        start_time: activeDays.has(d.id) ? openTime : null,
        end_time: activeDays.has(d.id) ? closeTime : null,
      }));

      const { error: hoursError } = await supabase
        .from('business_hours')
        .upsert(hoursRows, { onConflict: 'user_id,day_of_week' });

      if (hoursError) throw new Error(`Horarios: ${hoursError.message}`);

      toast.success('¡Configuración guardada!');
      setStep(4);
    } catch (e: any) {
      toast.error(e?.message || 'No pudimos guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Saltar configuración → ir directo al dashboard
  // ──────────────────────────────────────────────────────────
  async function handleSkip() {
    if (skipping) return;
    setSkipping(true);
    // Crear un row mínimo en business_profiles para que el guard
    // del setup no nos mande de regreso aquí en el próximo login.
    const supabase = createClient();
    await supabase.from('business_profiles').upsert({
      user_id: userId,
      business_name: `Negocio de ${userName || 'tu cuenta'}`,
      business_type: 'otro',
      slug: `vylta-${userId.slice(0, 8)}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    router.push('/dashboard');
  }

  // ──────────────────────────────────────────────────────────
  // Acción del paso 4
  // ──────────────────────────────────────────────────────────
  function copyLink() {
    navigator.clipboard.writeText(publicLink);
    toast.success('Link copiado');
  }

  function goToDashboard() {
    router.push('/dashboard');
    router.refresh();
  }

  // ══════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════
  return (
    <div className="relative min-h-screen overflow-hidden bg-vylta-black">
      {/* Background decorativo */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-vylta-green/20 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-vylta-luxury/12 blur-[100px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center px-4 py-10">
        <div className="w-full max-w-xl">
          {/* Header: saludo + stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-medium text-vylta-muted uppercase tracking-wider">
                  Paso {step} de 4
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-vylta-bone mt-0.5">
                  {step === 1 && `Hola, ${userName || 'bienvenido'} 👋`}
                  {step === 2 && 'Tu primer servicio'}
                  {step === 3 && 'Horarios de atención'}
                  {step === 4 && '¡Todo listo! 🎉'}
                </h1>
              </div>
              {step < 4 && (
                <button
                  onClick={handleSkip}
                  disabled={skipping}
                  className="text-xs font-medium text-vylta-subtle hover:text-vylta-bone transition-colors disabled:opacity-50"
                >
                  Saltar y configurar después
                </button>
              )}
            </div>

            {/* Stepper de progreso */}
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map(n => (
                <div
                  key={n}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${
                    n <= step ? 'bg-vylta-green' : 'bg-vylta-card'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Card del paso */}
          <div className="animate-slide-up rounded-2xl border border-border bg-vylta-surface/80 p-7 shadow-card-lg backdrop-blur-xl">

            {/* ════════════════ PASO 1: Negocio ════════════════ */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vylta-green/15 text-vylta-green">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-vylta-bone">Tu negocio</h2>
                    <p className="text-xs text-vylta-muted">Cuéntanos lo básico para empezar.</p>
                  </div>
                </div>

                {/* Nombre del negocio */}
                <div className="space-y-1.5">
                  <Label htmlFor="bn" className="text-xs font-semibold text-vylta-muted">
                    Nombre del negocio
                  </Label>
                  <Input
                    id="bn"
                    placeholder="Ej. Salón Bella María"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    autoCapitalize="words"
                    maxLength={60}
                    disabled={saving}
                    className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                  />
                </div>

                {/* Tipo de negocio (grid) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-vylta-muted">Tipo de negocio</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {BUSINESS_TYPES.map(t => {
                      const isSel = businessType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setBusinessType(t.id)}
                          disabled={saving}
                          className={`flex items-center gap-2.5 rounded-lg border-2 p-3 text-left transition-all ${
                            isSel
                              ? 'border-vylta-green bg-vylta-green/8 ring-2 ring-vylta-green/20'
                              : 'border-border bg-vylta-card hover:border-vylta-green/40'
                          }`}
                        >
                          <span className="text-xl">{t.emoji}</span>
                          <span className={`text-sm font-medium flex-1 ${isSel ? 'text-vylta-bone' : 'text-vylta-muted'}`}>
                            {t.label}
                          </span>
                          {isSel && <Check className="h-4 w-4 text-vylta-green" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Teléfono (opcional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="bp" className="text-xs font-semibold text-vylta-muted">
                    Teléfono / WhatsApp <span className="text-vylta-subtle">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
                    <Input
                      id="bp"
                      placeholder="Ej. 442 123 4567"
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      type="tel"
                      maxLength={20}
                      disabled={saving}
                      className="h-11 pl-10 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════ PASO 2: Primer servicio ════════════════ */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vylta-green/15 text-vylta-green">
                    <Scissors className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-vylta-bone">Primer servicio</h2>
                    <p className="text-xs text-vylta-muted">Agrega más después en Configuración.</p>
                  </div>
                </div>

                {/* Nombre del servicio */}
                <div className="space-y-1.5">
                  <Label htmlFor="sn" className="text-xs font-semibold text-vylta-muted">
                    Nombre del servicio
                  </Label>
                  <Input
                    id="sn"
                    placeholder="Ej. Corte de cabello"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    autoCapitalize="sentences"
                    maxLength={60}
                    disabled={saving}
                    className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                  />
                </div>

                {/* Duración + Precio en row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sd" className="text-xs font-semibold text-vylta-muted">
                      Duración (min)
                    </Label>
                    <Input
                      id="sd"
                      type="number"
                      placeholder="30"
                      value={serviceDuration}
                      onChange={(e) => setServiceDuration(e.target.value)}
                      min={5}
                      max={480}
                      step={5}
                      disabled={saving}
                      className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sp" className="text-xs font-semibold text-vylta-muted">
                      Precio ($MXN)
                    </Label>
                    <Input
                      id="sp"
                      type="number"
                      placeholder="200"
                      value={servicePrice}
                      onChange={(e) => setServicePrice(e.target.value)}
                      min={0}
                      step={50}
                      disabled={saving}
                      className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                    />
                  </div>
                </div>

                {/* Sugerencias de duración rápidas */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-vylta-muted">Duraciones comunes</Label>
                  <div className="flex flex-wrap gap-2">
                    {['15', '30', '45', '60', '90', '120'].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setServiceDuration(d)}
                        disabled={saving}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          serviceDuration === d
                            ? 'bg-vylta-green text-white'
                            : 'bg-vylta-card text-vylta-muted hover:bg-vylta-card/80'
                        }`}
                      >
                        {Number(d) >= 60 ? `${Number(d) / 60}h${Number(d) % 60 ? ` ${Number(d) % 60}min` : ''}` : `${d} min`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════ PASO 3: Horarios ════════════════ */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vylta-green/15 text-vylta-green">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-vylta-bone">¿Cuándo atiendes?</h2>
                    <p className="text-xs text-vylta-muted">Lo puedes ajustar después por día.</p>
                  </div>
                </div>

                {/* Selección de días */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-vylta-muted">Días que atiendes</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(d => {
                      const active = activeDays.has(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDay(d.id)}
                          disabled={saving}
                          className={`px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                            active
                              ? 'border-vylta-green bg-vylta-green text-white'
                              : 'border-border bg-vylta-card text-vylta-muted hover:border-vylta-green/40'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hora de apertura y cierre */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ot" className="text-xs font-semibold text-vylta-muted">
                      Hora de apertura
                    </Label>
                    <Input
                      id="ot"
                      type="time"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      disabled={saving}
                      className="h-11 bg-vylta-card border-border text-vylta-bone focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ct" className="text-xs font-semibold text-vylta-muted">
                      Hora de cierre
                    </Label>
                    <Input
                      id="ct"
                      type="time"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      disabled={saving}
                      className="h-11 bg-vylta-card border-border text-vylta-bone focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                    />
                  </div>
                </div>

                {/* Resumen visual */}
                <div className="rounded-lg bg-vylta-card/50 border border-border p-3">
                  <p className="text-xs text-vylta-muted">
                    <span className="font-semibold text-vylta-bone">Resumen:</span>{' '}
                    {activeDays.size === 0
                      ? 'Sin días seleccionados'
                      : `${activeDays.size} ${activeDays.size === 1 ? 'día' : 'días'} a la semana, de ${openTime} a ${closeTime}`}
                  </p>
                </div>
              </div>
            )}

            {/* ════════════════ PASO 4: ¡Listo! ════════════════ */}
            {step === 4 && (
              <div className="space-y-5 text-center py-2">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-vylta-green/15">
                    <CheckCircle2 className="h-8 w-8 text-vylta-green" />
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-vylta-bone">¡{businessName}!</h2>
                  <p className="text-sm text-vylta-muted mt-1">
                    Tu cuenta está lista. Aquí tienes el link público de tu negocio:
                  </p>
                </div>

                {/* Link público */}
                <div className="rounded-xl border border-vylta-green/30 bg-vylta-green/5 p-4 text-left">
                  <p className="text-xs font-semibold text-vylta-muted uppercase tracking-wider mb-2">
                    Tu link de reservas
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-vylta-green font-mono truncate flex-1">
                      {publicLink}
                    </code>
                    <button
                      onClick={copyLink}
                      className="flex items-center justify-center h-8 w-8 rounded-md bg-vylta-card hover:bg-vylta-card/80 text-vylta-bone transition-colors"
                      aria-label="Copiar link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={publicLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center h-8 w-8 rounded-md bg-vylta-card hover:bg-vylta-card/80 text-vylta-bone transition-colors"
                      aria-label="Abrir link"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* Lista de cosas que ya tiene listas */}
                <div className="text-left rounded-xl bg-vylta-card/30 p-4 space-y-2">
                  <p className="text-xs font-semibold text-vylta-muted uppercase tracking-wider mb-1">
                    Ya quedó listo
                  </p>
                  {[
                    `${businessName}`,
                    `Servicio: ${serviceName} · ${serviceDuration} min · $${servicePrice}`,
                    `Horarios: ${activeDays.size} ${activeDays.size === 1 ? 'día' : 'días'}, ${openTime}-${closeTime}`,
                  ].map((line, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-vylta-bone">
                      <Check className="h-3.5 w-3.5 text-vylta-green mt-0.5 flex-shrink-0" />
                      <span className="truncate">{line}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Button
                  onClick={goToDashboard}
                  size="lg"
                  className="w-full h-11 glow-primary bg-vylta-green hover:bg-vylta-green-light text-white font-semibold"
                >
                  <Sparkles className="h-4 w-4" />
                  Entrar a mi panel
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ════════════════ Botones de navegación ════════════════ */}
            {step < 4 && (
              <div className="flex gap-2 mt-7 pt-5 border-t border-border">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={saving}
                    className="h-11 bg-vylta-card border-border text-vylta-bone hover:bg-vylta-card/80"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Atrás
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={saving}
                  size="lg"
                  className="flex-1 h-11 glow-primary bg-vylta-green hover:bg-vylta-green-light text-white font-semibold"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : step === 3 ? (
                    <>
                      Terminar configuración
                      <CheckCircle2 className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Footer trust signal */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-vylta-subtle">
            <Shield className="h-3 w-3" />
            <span>Conexión segura · Hecho en México 🇲🇽</span>
          </div>
        </div>
      </div>
    </div>
  );
}
