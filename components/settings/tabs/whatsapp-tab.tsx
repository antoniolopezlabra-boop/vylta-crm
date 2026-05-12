import { MessageCircle, CheckCircle2, Info, Clock, Bell, Star } from 'lucide-react';
import { SettingsCard } from '../configuracion-shell';

interface Props {
  planTier: string;
}

export function WhatsAppTab({ planTier }: Props) {
  const isGratuito = planTier === 'gratuito';

  return (
    <div className="space-y-4">
      {/* Banner activo */}
      <SettingsCard icon={MessageCircle} title="WhatsApp Business" description="VYLTA envía los mensajes por ti, desde el número oficial verificado por Meta.">
        <div className="flex items-start gap-3 rounded-lg border border-vylta-green-500/30 bg-vylta-green-500/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-vylta-green-600 dark:text-vylta-green-400" />
          <div>
            <h4 className="text-sm font-bold text-vylta-green-700 dark:text-vylta-green-400">WhatsApp incluido en tu plan</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tus clientes reciben los mensajes desde el número oficial de VYLTA. No necesitas configurar nada técnico.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* Burbuja de ejemplo */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Así lo ven tus clientes</h3>
        <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-border">
          <div className="flex items-center gap-2 bg-[#075E54] px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#128C7E] text-white">
              <Star className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-white">VYLTA · Tu Negocio</span>
          </div>
          <div className="bg-[#E5EFDB] p-3">
            <div className="rounded-lg rounded-tl-sm bg-white p-3 shadow-sm">
              <p className="text-xs leading-relaxed text-foreground/90">
                Hola 👋 Te recordamos tu cita mañana a las 10:00 AM.<br />
                Servicio: Uñas acrílicas<br /><br />
                ¿Confirmas tu asistencia?
              </p>
              <p className="mt-2 text-right text-[9px] text-muted-foreground">10:32 AM ✓✓</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cuándo se envían los mensajes</h3>
        <div className="space-y-3">
          <TimelineRow icon="📋" timeLabel="Al agendar" timeColor="text-vylta-green-700 dark:text-vylta-green-400" timeBg="bg-vylta-green-500/15" title="Confirmación inmediata" desc="El cliente recibe el detalle de su cita en segundos." />
          <TimelineRow icon="🌙" timeLabel="24h antes" timeColor="text-blue-700 dark:text-blue-400" timeBg="bg-blue-500/15" title="Recordatorio día anterior" desc="Le avisa con tiempo para que pueda confirmar o cancelar." />
          <TimelineRow icon="⏰" timeLabel="2h antes" timeColor="text-vylta-amber-700 dark:text-amber-400" timeBg="bg-vylta-amber-500/15" title="Recordatorio final" desc="Un último aviso el mismo día antes de la cita." />
        </div>
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-xs text-blue-700 dark:text-blue-400">
          Los mensajes salen desde el número oficial de VYLTA — el mismo para todos los negocios en la plataforma. Esto nos permite mantener el servicio incluido en tu plan.
        </p>
      </div>

      {isGratuito && (
        <div className="flex items-start gap-3 rounded-lg border border-vylta-amber-500/30 bg-vylta-amber-500/5 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-vylta-amber-700 dark:text-amber-400" />
          <p className="text-xs text-vylta-amber-700 dark:text-amber-400">
            Los recordatorios se envían para tus citas dentro del límite mensual de 10 citas del Plan Básico.
          </p>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ icon, timeLabel, timeColor, timeBg, title, desc }: { icon: string; timeLabel: string; timeColor: string; timeBg: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3">
      <span className="text-2xl leading-none">{icon}</span>
      <div className="flex-1">
        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${timeBg} ${timeColor}`}>{timeLabel}</span>
        <h4 className="mt-1 text-sm font-bold">{title}</h4>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
