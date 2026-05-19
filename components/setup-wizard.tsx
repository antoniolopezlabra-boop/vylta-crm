'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Store, Package, Clock, Link as LinkIcon, Loader2,
  ArrowLeft, ArrowRight, Check, Copy, Lightbulb, Info,
  Instagram, Phone, Globe, Facebook, ChevronDown, X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_OTHER,
  isCustomBusinessType,
  validateCustomBusinessType,
} from '@/lib/business-types';
import { generateSlug, ensureUniqueSlug } from '@/lib/slug-generator';

// ═════════════════════════════════════════════════════════════════════════
// SETUP WIZARD CRM — 4 pasos espejo del wizard de la app móvil
//
// PASOS:
//   1. Negocio: nombre, tipo, teléfono
//   2. Servicio: nombre, precio, duración
//   3. Horarios: días que atiendes + horario apertura/cierre
//   4. Link: booking_link generado + invitación a compartir
//
// AUTO-GENERA booking_link en paso 1 (espejo de la app móvil) para
// que el usuario salga del wizard con un link público listo.
//
// Marca setup_completed en localStorage al terminar para no volver
// a mostrarse. La app móvil usa AsyncStorage pero el CRM usa
// localStorage — son sistemas separados.
// ═════════════════════════════════════════════════════════════════════════

const DAYS_OF_WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function SetupWizard() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // ════ PASO 1: Negocio ════
  const [businessName, setBusinessName] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [customType, setCustomType] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [phone, setPhone] = useState('');

  // ════ PASO 2: Primer servicio ════
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDuration, setServiceDuration] = useState('30');

  // ════ PASO 3: Horarios ════
  const [openDays, setOpenDays] = useState<number[]>([0, 1, 2, 3, 4, 5]); // Lun-Sáb default
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('19:00');

  // ════ PASO 4: Link ════
  const [bookingSlug, setBookingSlug] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  // Cargar userId al montar
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      setUserId(user.id);
      // Pre-cargar perfil existente si lo hay
      const { data: profile } = await supabase
        .from('business_profiles')
        .select('business_name, business_type, phone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) {
        setBusinessName(profile.business_name || '');
        const t = profile.business_type || '';
        if (t) {
          if (isCustomBusinessType(t)) {
            setSelectedType(BUSINESS_TYPE_OTHER);
            setCustomType(t);
          } else {
            setSelectedType(t);
          }
        }
        setPhone(profile.phone || '');
      }
    })();
  }, [router]);

  // Cargar slug existente cuando llegamos al paso 4
  useEffect(() => {
    if (step === 3 && userId) loadBookingLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, userId]);

  const loadBookingLink = async () => {
    if (!userId) return;
    setLinkLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('booking_links')
        .select('slug')
        .eq('user_id', userId)
        .maybeSingle();
      if (data?.slug) setBookingSlug(data.slug);
    } catch (e) {
      console.error('[Setup] Error loading booking link:', e);
    } finally {
      setLinkLoading(false);
    }
  };

  const markSetupCompleted = () => {
    if (!userId) return;
    localStorage.setItem(`setup_completed_${userId}`, 'true');
  };

  const handleSkipAll = () => {
    if (!confirm('¿Saltar configuración? Puedes hacerla más tarde desde Ajustes. Tomaría solo 2 minutos ahora.')) {
      return;
    }
    markSetupCompleted();
    router.replace('/dashboard');
  };

  // ════ PASO 1: Guardar negocio + auto-generar booking_link ════
  const getEffectiveBusinessType = (): string => {
    if (selectedType === BUSINESS_TYPE_OTHER) {
      return customType.trim();
    }
    return selectedType;
  };

  const handleSaveBusinessAndNext = async () => {
    if (!businessName.trim()) {
      toast.error('Por favor escribe el nombre de tu negocio.');
      return;
    }
    if (!selectedType) {
      toast.error('Por favor selecciona el tipo de negocio.');
      return;
    }
    if (selectedType === BUSINESS_TYPE_OTHER) {
      const v = validateCustomBusinessType(customType);
      if (!v.valid) {
        toast.error(v.error || 'Escribe tu tipo de negocio.');
        return;
      }
    }
    if (!userId) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const finalBusinessType = getEffectiveBusinessType();

      await supabase.from('business_profiles').upsert({
        user_id: userId,
        business_name: businessName.trim(),
        business_type: finalBusinessType,
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      // Auto-crear booking_link (mismo patrón que la app móvil).
      // Si falla, no bloqueamos el wizard — se puede crear después en Ajustes.
      try {
        const { data: existing } = await supabase
          .from('booking_links')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existing) {
          const baseSlug = generateSlug(businessName.trim());
          const finalSlug = await ensureUniqueSlug(baseSlug, supabase);
          await supabase.from('booking_links').insert({
            user_id: userId,
            slug: finalSlug,
            is_active: true,
            require_approval: false,
            whatsapp_confirmation: true,
          });
        }
      } catch (linkErr: any) {
        console.warn('[Setup] No se pudo auto-crear el booking_link:', linkErr?.message);
      }

      setStep(1);
    } catch (err: any) {
      toast.error('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // ════ PASO 2: Guardar primer servicio (opcional) ════
  const handleSaveServiceAndNext = async () => {
    if (!userId) return;
    if (!serviceName.trim()) {
      // Servicio vacío: saltar al siguiente paso sin crear nada
      setStep(2);
      return;
    }
    const price = parseFloat(servicePrice);
    const duration = parseInt(serviceDuration);
    if (isNaN(price) || price < 0) {
      toast.error('Escribe un precio válido o deja vacío para agregar después.');
      return;
    }
    if (isNaN(duration) || duration < 5) {
      toast.error('La duración mínima es de 5 minutos.');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from('services').insert({
        user_id: userId,
        name: serviceName.trim(),
        price,
        duration_minutes: duration,
        is_active: true,
      });
      setStep(2);
    } catch (err: any) {
      toast.error('No se pudo guardar el servicio.');
    } finally {
      setSaving(false);
    }
  };

  // ════ PASO 3: Guardar horarios ════
  const handleSaveScheduleAndNext = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const rows = Array.from({ length: 7 }, (_, dayIdx) => ({
        user_id: userId,
        day_of_week: dayIdx,
        start_time: openTime,
        end_time: closeTime,
        is_open: openDays.includes(dayIdx),
      }));
      await supabase.from('business_hours').delete().eq('user_id', userId);
      await supabase.from('business_hours').insert(rows);
      setStep(3);
    } catch (err: any) {
      toast.error('No se pudieron guardar los horarios.');
    } finally {
      setSaving(false);
    }
  };

  // ════ PASO 4: Finalizar ════
  const handleFinish = () => {
    markSetupCompleted();
    router.replace('/dashboard');
  };

  const handleCopyLink = async () => {
    if (!bookingSlug) return;
    const url = `https://book.vylta.lat/${bookingSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Link copiado: ${url}`);
    } catch {
      toast.error('No se pudo copiar automáticamente. Selecciona el link y cópialo manualmente.');
    }
  };

  const toggleDay = (dayIdx: number) => {
    setOpenDays(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx]
    );
  };

  const pickerDisplayText = () => {
    if (!selectedType) return 'Seleccionar tipo de negocio';
    if (selectedType === BUSINESS_TYPE_OTHER) {
      return customType.trim() ? `Otro: ${customType.trim()}` : 'Otro (especifica)';
    }
    return selectedType;
  };

  const progressPct = ((step + 1) / 4) * 100;

  return (
    <div className="relative min-h-screen overflow-hidden bg-vylta-black">
      {/* Background decorativo — espejo del login */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-vylta-green/20 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-vylta-luxury/12 blur-[100px]" />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#1F2937_1px,transparent_1px),linear-gradient(to_bottom,#1F2937_1px,transparent_1px)] bg-[size:32px_32px] opacity-40"
          style={{
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 80%)',
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header con progress */}
        <div className="sticky top-0 z-20 border-b border-border bg-vylta-black/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-start justify-between gap-4 px-6 pt-6 pb-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold tracking-tight text-vylta-bone">
                Configura tu negocio
              </h1>
              <p className="mt-1 text-xs text-vylta-muted">
                Toma 2 minutos. Te ahorras horas después.
              </p>
            </div>
            <button
              onClick={handleSkipAll}
              className="text-sm font-medium text-vylta-subtle transition hover:text-vylta-bone"
            >
              Saltar
            </button>
          </div>
          <div className="mx-auto max-w-2xl px-6 pb-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-vylta-card">
              <div
                className="h-full rounded-full bg-vylta-green transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-vylta-subtle">
              Paso {step + 1} de 4
            </p>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-2xl">
            {/* ════ PASO 1: NEGOCIO ════ */}
            {step === 0 && (
              <div className="animate-fade-in">
                <div className="mb-6 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-vylta-green/10 ring-1 ring-vylta-green/30">
                    <Store className="h-9 w-9 text-vylta-green" />
                  </div>
                </div>
                <h2 className="text-center text-2xl font-bold tracking-tight text-vylta-bone">
                  Cuéntanos de tu negocio
                </h2>
                <p className="mx-auto mt-2 max-w-md text-center text-sm text-vylta-muted">
                  Esta información aparecerá en tu link público de citas.
                </p>

                <div className="mt-8 space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-vylta-muted">
                      Nombre del negocio *
                    </Label>
                    <Input
                      placeholder="Ej. Salón Bella, Barbería Clásica"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      maxLength={60}
                      className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-vylta-muted">
                      Tipo de negocio *
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowTypePicker(true)}
                      className="flex h-11 w-full items-center justify-between rounded-md border border-border bg-vylta-card px-3 text-left text-sm transition hover:border-vylta-green/40"
                    >
                      <span className={selectedType ? 'text-vylta-bone' : 'text-vylta-subtle'}>
                        {pickerDisplayText()}
                      </span>
                      <ChevronDown className="h-4 w-4 text-vylta-subtle" />
                    </button>

                    {selectedType === BUSINESS_TYPE_OTHER && (
                      <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-amber-200">
                          Especifica tu tipo *
                        </Label>
                        <Input
                          placeholder="Ej. Especialista Parasitólogo"
                          value={customType}
                          onChange={(e) => setCustomType(e.target.value)}
                          maxLength={50}
                          className="mt-1.5 h-10 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle"
                        />
                        <p className="mt-1 text-right text-[10px] text-amber-300/70">
                          {customType.length}/50
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-vylta-muted">
                      Teléfono de contacto (opcional)
                    </Label>
                    <Input
                      placeholder="442 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={15}
                      type="tel"
                      className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ════ PASO 2: SERVICIO ════ */}
            {step === 1 && (
              <div className="animate-fade-in">
                <div className="mb-6 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 ring-1 ring-amber-500/30">
                    <Package className="h-9 w-9 text-amber-500" />
                  </div>
                </div>
                <h2 className="text-center text-2xl font-bold tracking-tight text-vylta-bone">
                  Agrega tu primer servicio
                </h2>
                <p className="mx-auto mt-2 max-w-md text-center text-sm text-vylta-muted">
                  Lo que ofreces a tus clientes. Podrás agregar más después desde Ajustes.
                </p>

                <div className="mt-8 space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-vylta-muted">
                      Nombre del servicio
                    </Label>
                    <Input
                      placeholder="Ej. Consulta Médica, Corte de cabello, Poligel"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      maxLength={50}
                      className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-vylta-muted">
                        Precio (MXN)
                      </Label>
                      <Input
                        placeholder="250"
                        value={servicePrice}
                        onChange={(e) => setServicePrice(e.target.value)}
                        type="number"
                        inputMode="numeric"
                        className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-vylta-muted">
                        Duración (min)
                      </Label>
                      <Input
                        placeholder="30"
                        value={serviceDuration}
                        onChange={(e) => setServiceDuration(e.target.value)}
                        type="number"
                        inputMode="numeric"
                        className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <p className="text-xs leading-relaxed text-amber-200/80">
                      Si quieres agregar después, deja los campos vacíos y toca Continuar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ════ PASO 3: HORARIOS ════ */}
            {step === 2 && (
              <div className="animate-fade-in">
                <div className="mb-6 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-500/10 ring-1 ring-blue-500/30">
                    <Clock className="h-9 w-9 text-blue-400" />
                  </div>
                </div>
                <h2 className="text-center text-2xl font-bold tracking-tight text-vylta-bone">
                  ¿Qué días atiendes?
                </h2>
                <p className="mx-auto mt-2 max-w-md text-center text-sm text-vylta-muted">
                  Toca los días que estás abierto. Podrás ajustar horarios por día en Ajustes.
                </p>

                <div className="mt-8 space-y-5">
                  <div className="flex justify-between gap-1.5">
                    {DAYS_OF_WEEK.map((d, idx) => {
                      const active = openDays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDay(idx)}
                          className={`flex flex-1 flex-col items-center rounded-xl border-2 py-3 px-1 transition ${
                            active
                              ? 'border-vylta-green bg-vylta-green text-white'
                              : 'border-border bg-vylta-card text-vylta-subtle hover:border-vylta-green/30'
                          }`}
                        >
                          <span className="text-base font-extrabold">{d}</span>
                          <span className={`mt-1 text-[9px] font-semibold ${active ? 'text-white/80' : 'text-vylta-subtle'}`}>
                            {DAY_NAMES[idx].substring(0, 3)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-vylta-muted">
                        Hora de apertura
                      </Label>
                      <Input
                        placeholder="09:00"
                        value={openTime}
                        onChange={(e) => setOpenTime(e.target.value)}
                        maxLength={5}
                        className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-vylta-muted">
                        Hora de cierre
                      </Label>
                      <Input
                        placeholder="19:00"
                        value={closeTime}
                        onChange={(e) => setCloseTime(e.target.value)}
                        maxLength={5}
                        className="h-11 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                    <p className="text-xs leading-relaxed text-blue-200/80">
                      Formato 24h. Ejemplo: 09:00 a 19:00. Estos horarios aplicarán a todos los días seleccionados.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ════ PASO 4: LINK ════ */}
            {step === 3 && (
              <div className="animate-fade-in">
                <div className="mb-6 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-500/10 ring-1 ring-purple-500/30">
                    <LinkIcon className="h-9 w-9 text-purple-400" />
                  </div>
                </div>
                <h2 className="text-center text-2xl font-bold tracking-tight text-vylta-bone">
                  ¡Tu negocio está listo!
                </h2>
                <p className="mx-auto mt-2 max-w-md text-center text-sm text-vylta-muted">
                  Comparte tu link público para que tus clientes agenden citas en línea.
                </p>

                <div className="mt-8 space-y-5">
                  {linkLoading ? (
                    <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-vylta-card p-6">
                      <Loader2 className="h-5 w-5 animate-spin text-vylta-green" />
                      <span className="text-sm text-vylta-muted">Generando tu link...</span>
                    </div>
                  ) : bookingSlug ? (
                    <>
                      <div className="flex items-center gap-3 rounded-xl border border-vylta-green/30 bg-vylta-green/5 p-4">
                        <LinkIcon className="h-5 w-5 flex-shrink-0 text-vylta-green" />
                        <code className="flex-1 truncate text-sm font-semibold text-vylta-bone">
                          book.vylta.lat/{bookingSlug}
                        </code>
                      </div>
                      <Button
                        onClick={handleCopyLink}
                        className="w-full bg-vylta-green hover:bg-vylta-green-light text-white"
                      >
                        <Copy className="h-4 w-4" />
                        Copiar link
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-xl border border-border bg-vylta-card p-6 text-center">
                      <p className="text-sm text-vylta-muted">
                        Tu link se activará cuando completes la configuración del link de citas en Ajustes.
                      </p>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-vylta-muted">
                      Dónde compartirlo
                    </h3>
                    <div className="space-y-2.5">
                      {[
                        { Icon: Instagram, label: 'Bio de Instagram', color: 'text-pink-400 bg-pink-500/10' },
                        { Icon: Phone, label: 'Estado de WhatsApp', color: 'text-emerald-400 bg-emerald-500/10' },
                        { Icon: Globe, label: 'Google Business', color: 'text-blue-400 bg-blue-500/10' },
                        { Icon: Facebook, label: 'Página de Facebook', color: 'text-sky-400 bg-sky-500/10' },
                      ].map(({ Icon, label, color }) => (
                        <div key={label} className="flex items-center gap-3 py-1">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-sm text-vylta-bone">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer con botones */}
        <div className="sticky bottom-0 z-10 border-t border-border bg-vylta-black/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={saving}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-vylta-card text-vylta-subtle transition hover:text-vylta-bone disabled:opacity-50"
                aria-label="Atrás"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <Button
              onClick={
                step === 0 ? handleSaveBusinessAndNext :
                step === 1 ? handleSaveServiceAndNext :
                step === 2 ? handleSaveScheduleAndNext :
                handleFinish
              }
              disabled={saving}
              size="lg"
              className="h-12 flex-1 bg-vylta-green hover:bg-vylta-green-light text-white font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  {step === 3 ? 'Comenzar a usar VYLTA' : 'Continuar'}
                  {step === 3 ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL: Selector de tipo de negocio */}
      {showTypePicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowTypePicker(false)}>
          <div
            className="animate-slide-up max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-t-3xl border border-border bg-vylta-surface shadow-card-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-lg font-bold text-vylta-bone">Tipo de negocio</h3>
              <button
                onClick={() => setShowTypePicker(false)}
                className="text-vylta-subtle hover:text-vylta-bone"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="border-b border-border px-6 py-3 text-xs text-vylta-muted">
              Selecciona el que mejor describe tu negocio. Si no aparece, elige “Otro”.
            </p>
            <div className="max-h-[calc(80vh-130px)] overflow-y-auto">
              {BUSINESS_TYPES.map((type) => {
                const isSelected = selectedType === type;
                const isOther = type === BUSINESS_TYPE_OTHER;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type);
                      setShowTypePicker(false);
                      if (type !== BUSINESS_TYPE_OTHER) setCustomType('');
                    }}
                    className={`flex w-full items-center justify-between border-t border-border px-6 py-4 text-left transition ${
                      isSelected ? 'bg-vylta-green/10' : 'hover:bg-vylta-card'
                    } ${isOther ? 'border-t-4 border-t-amber-500/40 bg-amber-500/5' : ''}`}
                  >
                    <span className={`text-sm ${isSelected ? 'font-bold text-vylta-green' : 'text-vylta-bone'}`}>
                      {type}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-vylta-green" />}
                  </button>
                );
              })}
              <div className="h-6" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
