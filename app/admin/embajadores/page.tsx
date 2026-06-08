'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Users, Loader2, RefreshCw, Wallet, Building2, TrendingUp, Plus, Crown, Download, X, Trash2,
  KeyRound, CheckCircle2, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAdminEmbajadores, type Embajador } from '@/hooks/use-admin-embajadores';

const MXN = (n: number) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

// Nivel/comision del mes en curso segun clientes nuevos (primer pago este mes).
function tierFromNuevos(n: number): { pct: string; cls: string } {
  if (n >= 16) return { pct: '30%', cls: 'text-vylta-gold border-vylta-gold/40 bg-vylta-gold/10' };
  if (n >= 11) return { pct: '25%', cls: 'text-vylta-sky border-vylta-sky/40 bg-vylta-sky/10' };
  if (n >= 1) return { pct: '20%', cls: 'text-vylta-green border-vylta-green/40 bg-vylta-green/10' };
  return { pct: '—', cls: 'text-vylta-subtle border-border bg-vylta-card/40' };
}

function estatusBadge(estatus: string): string {
  if (estatus === 'activo') return 'text-vylta-green border-vylta-green/40 bg-vylta-green/10';
  if (estatus === 'pausado') return 'text-vylta-gold border-vylta-gold/40 bg-vylta-gold/10';
  return 'text-vylta-rose border-vylta-rose/40 bg-vylta-rose/10';
}

export default function AdminEmbajadoresPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useAdminEmbajadores();
  const embajadores = data || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Embajador | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Crear acceso al portal
  const [accessTarget, setAccessTarget] = useState<Embajador | null>(null);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [accessResult, setAccessResult] = useState<{ email: string; password: string } | null>(null);

  const totals = useMemo(() => {
    return embajadores.reduce(
      (acc, e) => {
        acc.activos += e.estatus === 'activo' ? 1 : 0;
        acc.clientes += Number(e.clientes_total) || 0;
        acc.activosClientes += Number(e.clientes_activos) || 0;
        acc.porPagar += Number(e.por_pagar) || 0;
        return acc;
      },
      { activos: 0, clientes: 0, activosClientes: 0, porPagar: 0 },
    );
  }, [embajadores]);

  async function handleCrear() {
    if (!nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: res, error } = await supabase.rpc('admin_crear_embajador', {
        p_nombre: nombre.trim(),
        p_email: email.trim() || null,
        p_telefono: telefono.trim() || null,
      });
      if (error) throw error;
      const r = res as { ok: boolean; error?: string; ref_code?: string };
      if (!r?.ok) {
        toast.error(r?.error || 'No se pudo crear el embajador');
        return;
      }
      toast.success(`Embajador creado · código ${r.ref_code}`);
      setNombre('');
      setEmail('');
      setTelefono('');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-embajadores'] });
    } catch (e: any) {
      console.error('[Embajadores] crear error:', e);
      toast.error('No se pudo crear. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function openAccess(e: Embajador) {
    setAccessTarget(e);
    setAccessEmail(e.email || '');
    setAccessPassword('Inicio.01');
    setAccessResult(null);
  }

  function closeAccess() {
    if (creatingAccess) return;
    setAccessTarget(null);
    setAccessResult(null);
  }

  async function handleCrearAcceso() {
    if (!accessTarget) return;
    if (!accessEmail.trim()) {
      toast.error('El correo es obligatorio');
      return;
    }
    if (accessPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    try {
      setCreatingAccess(true);
      const supabase = createClient();
      const { data: res, error } = await supabase.functions.invoke('create-ambassador-access', {
        body: { embajadorId: accessTarget.id, email: accessEmail.trim(), password: accessPassword },
      });
      if (error) throw error;
      const r = res as { success: boolean; error?: string; email?: string };
      if (!r?.success) {
        toast.error(r?.error || 'No se pudo crear el acceso');
        return;
      }
      toast.success('Acceso creado');
      setAccessResult({ email: accessEmail.trim(), password: accessPassword });
      queryClient.invalidateQueries({ queryKey: ['admin-embajadores'] });
    } catch (e: any) {
      console.error('[Embajadores] crear acceso error:', e);
      toast.error('No se pudo crear el acceso. Intenta de nuevo.');
    } finally {
      setCreatingAccess(false);
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      const supabase = createClient();
      const { data: res, error } = await supabase.rpc('admin_export_cortes');
      if (error) throw error;
      const rows = (res as any[]) || [];
      if (rows.length === 0) {
        toast.info('No hay cortes pendientes para exportar.');
        return;
      }
      const cols: [string, string][] = [
        ['periodo', 'Periodo'], ['embajador', 'Embajador'], ['ref_code', 'Codigo'],
        ['email', 'Correo'], ['telefono', 'Telefono'], ['banco', 'Banco'],
        ['clabe', 'CLABE'], ['titular_cuenta', 'Titular'], ['rfc', 'RFC'],
        ['clientes_nuevos', 'Clientes nuevos'], ['tier', 'Nivel'], ['tasa', 'Tasa'],
        ['total_comision', 'Total a pagar (MXN)'], ['estatus', 'Estatus'],
      ];
      const esc = (v: any) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [cols.map(([, h]) => h).join(',')];
      for (const row of rows) lines.push(cols.map(([k]) => esc(row[k])).join(','));
      const csv = '\ufeff' + lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cortes-embajadores-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} corte(s) exportado(s).`);
    } catch (e: any) {
      console.error('[Embajadores] export error:', e);
      toast.error('No se pudo exportar. Intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  }

  async function handleEliminar() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const supabase = createClient();
      const { data: res, error } = await supabase.functions.invoke('delete-ambassador', {
        body: { embajadorId: deleteTarget.id },
      });
      if (error) throw error;
      const r = res as { success: boolean; error?: string; warning?: string };
      if (!r?.success) {
        toast.error(r?.error || 'No se pudo eliminar el embajador');
        return;
      }
      if (r.warning) toast.warning(r.warning);
      else toast.success(`Embajador "${deleteTarget.nombre}" eliminado.`);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-embajadores'] });
    } catch (e: any) {
      console.error('[Embajadores] eliminar error:', e);
      toast.error('No se pudo eliminar. Intenta de nuevo.');
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-vylta-muted">
            Cargando embajadores
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-vylta-bone">Red de Embajadores</h1>
          <p className="mt-1 text-sm text-vylta-muted">
            Quién trae clientes nuevos, su nivel del mes y cuánto le toca en el próximo corte.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/30 bg-vylta-gold/5 px-3 py-2 text-sm font-bold text-vylta-gold transition hover:bg-vylta-gold/10 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            {isFetching ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-vylta-card/40 px-3 py-2 text-sm font-bold text-vylta-muted transition hover:text-vylta-bone disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar pago
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/40 bg-vylta-gold/10 px-3 py-2 text-sm font-bold text-vylta-gold transition hover:bg-vylta-gold/20"
          >
            <Plus className="h-4 w-4" />
            Nuevo embajador
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Embajadores" value={embajadores.length} hint={`${totals.activos} activos`} Icon={Users} accent="gold" />
        <Kpi label="Clientes atribuidos" value={totals.clientes} hint={`${totals.activosClientes} pagando`} Icon={Building2} accent="green" />
        <Kpi label="Por pagar (corte)" value={MXN(totals.porPagar)} hint="Cortes pendientes" Icon={Wallet} accent="gold" isMoney />
        <Kpi label="Pagando" value={totals.activosClientes} hint="Clientes con plan activo" Icon={TrendingUp} accent="luxury" />
      </div>

      {/* TABLA */}
      <div className="overflow-hidden rounded-2xl border border-vylta-gold/20 bg-vylta-surface shadow-card-lg">
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          <Crown className="h-4 w-4 text-vylta-gold" />
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-muted">Embajadores</h2>
        </div>

        {embajadores.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <Users className="h-10 w-10 text-vylta-subtle" />
            <p className="text-sm font-semibold text-vylta-bone">Aún no hay embajadores</p>
            <p className="max-w-sm text-sm text-vylta-muted">
              Cuando des de alta a tu primer embajador, aquí verás sus clientes, su nivel y su comisión.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-vylta-subtle">
                  <th className="px-6 py-3 font-bold">Embajador</th>
                  <th className="px-4 py-3 font-bold">Estatus</th>
                  <th className="px-4 py-3 text-center font-bold">Clientes</th>
                  <th className="px-4 py-3 text-center font-bold">Nuevos del mes</th>
                  <th className="px-4 py-3 text-center font-bold">Nivel</th>
                  <th className="px-4 py-3 text-right font-bold">Comisión acumulada</th>
                  <th className="px-4 py-3 text-right font-bold">Por pagar</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {embajadores.map((e) => {
                  const tier = tierFromNuevos(Number(e.nuevos_mes) || 0);
                  return (
                    <tr key={e.id} className="border-b border-border/60 transition-colors hover:bg-vylta-card/30">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-vylta-bone">{e.nombre}</div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="rounded bg-vylta-card/60 px-1.5 py-0.5 font-mono text-[11px] text-vylta-gold">{e.ref_code}</span>
                          {!e.perfil_completo && (
                            <span className="text-[11px] text-vylta-gold/80">perfil incompleto</span>
                          )}
                        </div>
                        {e.email && <div className="mt-0.5 text-xs text-vylta-muted">{e.email}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', estatusBadge(e.estatus))}>
                          {e.estatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="font-bold tabular-nums text-vylta-bone">{e.clientes_total}</div>
                        <div className="text-[11px] text-vylta-muted">{e.clientes_activos} pagando</div>
                      </td>
                      <td className="px-4 py-4 text-center font-bold tabular-nums text-vylta-bone">{e.nuevos_mes}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold', tier.cls)}>
                          {tier.pct}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-vylta-bone">{MXN(e.comision_total)}</td>
                      <td className="px-4 py-4 text-right font-bold tabular-nums text-vylta-gold">{MXN(e.por_pagar)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {e.tiene_acceso ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-vylta-green/30 bg-vylta-green/5 px-2 py-1 text-[11px] font-bold text-vylta-green">
                              <CheckCircle2 className="h-3 w-3" /> acceso
                            </span>
                          ) : (
                            <button
                              onClick={() => openAccess(e)}
                              title="Crear acceso al portal"
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-vylta-gold/30 bg-vylta-gold/5 px-2.5 text-[12px] font-bold text-vylta-gold transition hover:bg-vylta-gold/10"
                            >
                              <KeyRound className="h-3.5 w-3.5" /> Crear acceso
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(e)}
                            title="Eliminar embajador"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-vylta-subtle transition hover:border-vylta-rose/40 hover:bg-vylta-rose/10 hover:text-vylta-rose"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-vylta-subtle">
        El “Nivel” es la comisión del mes según los clientes nuevos: 20% (1–10), 25% (11–15), 30% (16+).
        Los cortes se calculan solos el día 1 de cada mes y quedan pendientes hasta que pagas por SPEI.
      </p>

      {/* MODAL: Alta de embajador */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-vylta-gold/20 bg-vylta-surface p-6 shadow-card-lg"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-vylta-bone">Nuevo embajador</h3>
              <button
                onClick={() => !saving && setModalOpen(false)}
                className="text-vylta-subtle transition hover:text-vylta-bone"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <Field label="Nombre *" value={nombre} onChange={setNombre} placeholder="Nombre completo del embajador" />
              <Field label="Correo (opcional)" value={email} onChange={setEmail} placeholder="correo@ejemplo.com" type="email" />
              <Field label="Teléfono (opcional)" value={telefono} onChange={setTelefono} placeholder="442 123 4567" />
              <p className="text-xs text-vylta-muted">
                Se le asigna un código de referido automáticamente. Sus datos bancarios (CLABE, RFC) los completará él mismo en su portal más adelante.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => !saving && setModalOpen(false)}
                className="rounded-lg border border-border bg-vylta-card/40 px-4 py-2 text-sm font-bold text-vylta-muted transition hover:text-vylta-bone"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrear}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/40 bg-vylta-gold/10 px-4 py-2 text-sm font-bold text-vylta-gold transition hover:bg-vylta-gold/20 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? 'Creando...' : 'Crear embajador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Crear acceso al portal */}
      {accessTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeAccess}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-vylta-gold/20 bg-vylta-surface p-6 shadow-card-lg"
            onClick={(ev) => ev.stopPropagation()}
          >
            {!accessResult ? (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-vylta-bone">Crear acceso</h3>
                  <button onClick={closeAccess} className="text-vylta-subtle transition hover:text-vylta-bone">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="mb-4 text-sm text-vylta-muted">
                  Para <span className="font-semibold text-vylta-bone">{accessTarget.nombre}</span>. Define su correo y una contraseña; tú se la compartes y él podrá cambiarla dentro del portal.
                </p>
                <div className="space-y-4">
                  <Field label="Correo de acceso *" value={accessEmail} onChange={setAccessEmail} placeholder="correo@ejemplo.com" type="email" />
                  <Field label="Contraseña *" value={accessPassword} onChange={setAccessPassword} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button onClick={closeAccess} className="rounded-lg border border-border bg-vylta-card/40 px-4 py-2 text-sm font-bold text-vylta-muted transition hover:text-vylta-bone">
                    Cancelar
                  </button>
                  <button
                    onClick={handleCrearAcceso}
                    disabled={creatingAccess}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/40 bg-vylta-gold/10 px-4 py-2 text-sm font-bold text-vylta-gold transition hover:bg-vylta-gold/20 disabled:opacity-50"
                  >
                    {creatingAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    {creatingAccess ? 'Creando...' : 'Crear acceso'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-vylta-green/10">
                    <CheckCircle2 className="h-4 w-4 text-vylta-green" />
                  </div>
                  <h3 className="text-lg font-bold text-vylta-bone">Acceso creado</h3>
                </div>
                <p className="text-sm text-vylta-muted">
                  Comparte estos datos con {accessTarget.nombre} por WhatsApp. Podrá cambiar su contraseña dentro del portal.
                </p>
                <div className="mt-4 space-y-2 rounded-xl border border-border bg-vylta-admin-bg p-4 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-vylta-subtle">Portal</span><span className="font-mono text-vylta-bone">app.vylta.lat/embajador</span></div>
                  <div className="flex justify-between gap-3"><span className="text-vylta-subtle">Correo</span><span className="font-mono text-vylta-bone">{accessResult.email}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-vylta-subtle">Contraseña</span><span className="font-mono text-vylta-bone">{accessResult.password}</span></div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      const msg = [
                        'Bienvenido a VYLTA como Embajador.',
                        'Entra a tu portal: https://app.vylta.lat/embajador',
                        `Correo: ${accessResult.email}`,
                        `Contraseña: ${accessResult.password}`,
                        'Puedes cambiar tu contraseña dentro del portal cuando entres.',
                      ].join('\n');
                      navigator.clipboard?.writeText(msg);
                      toast.success('Mensaje copiado para WhatsApp');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-vylta-card/40 px-4 py-2 text-sm font-bold text-vylta-muted transition hover:text-vylta-bone"
                  >
                    <Copy className="h-4 w-4" /> Copiar para WhatsApp
                  </button>
                  <button
                    onClick={() => { setAccessTarget(null); setAccessResult(null); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/40 bg-vylta-gold/10 px-4 py-2 text-sm font-bold text-vylta-gold transition hover:bg-vylta-gold/20"
                  >
                    Listo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Confirmar eliminacion */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-vylta-rose/30 bg-vylta-surface p-6 shadow-card-lg"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-vylta-rose/10">
                <Trash2 className="h-4 w-4 text-vylta-rose" />
              </div>
              <h3 className="text-lg font-bold text-vylta-bone">Eliminar embajador</h3>
            </div>
            <p className="text-sm text-vylta-muted">
              Vas a eliminar a <span className="font-semibold text-vylta-bone">{deleteTarget.nombre}</span> de forma permanente: su registro, sus comisiones y cortes, y su cuenta de acceso (si la tiene). Los clientes que haya referido conservan su cuenta, pero se les quita la atribución.
            </p>
            <p className="mt-2 text-xs font-bold text-vylta-rose">Esta acción no se puede deshacer.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => !deleting && setDeleteTarget(null)}
                className="rounded-lg border border-border bg-vylta-card/40 px-4 py-2 text-sm font-bold text-vylta-muted transition hover:text-vylta-bone"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-rose/40 bg-vylta-rose/10 px-4 py-2 text-sm font-bold text-vylta-rose transition hover:bg-vylta-rose/20 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-vylta-subtle">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-vylta-admin-bg px-3 py-2 text-sm text-vylta-bone placeholder:text-vylta-subtle/60 focus:border-vylta-gold/50 focus:outline-none"
      />
    </div>
  );
}

function Kpi({ label, value, hint, Icon, accent, isMoney }: {
  label: string; value: number | string; hint: string; Icon: any;
  accent: 'green' | 'gold' | 'luxury' | 'blue'; isMoney?: boolean;
}) {
  const colorMap = {
    green: { text: 'text-vylta-green', halo: '#10B981' },
    gold: { text: 'text-vylta-gold', halo: '#F59E0B' },
    luxury: { text: 'text-vylta-luxury', halo: '#A78BFA' },
    blue: { text: 'text-vylta-sky', halo: '#0EA5E9' },
  }[accent];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-5 shadow-card transition-all hover:border-vylta-gold/30">
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-25" style={{ background: colorMap.halo }} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-vylta-subtle">{label}</span>
          <Icon className={cn('h-4 w-4', colorMap.text)} />
        </div>
        <div className={cn('mt-3 font-bold tabular-nums tracking-tightest', colorMap.text, isMoney ? 'text-2xl' : 'text-3xl')}>{value}</div>
        <div className="mt-1 text-sm text-vylta-muted">{hint}</div>
      </div>
    </div>
  );
}
