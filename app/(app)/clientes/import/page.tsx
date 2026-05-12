'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  X,
  Download,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════
// /clientes/import — Import masivo de clientes desde CSV.
//
// Flujo:
//   1. Subir archivo CSV (o pegar contenido)
//   2. Preview de las primeras 10 filas + auto-detección de columnas
//   3. Confirmación e import en lotes
//
// Columnas reconocidas (auto-mapping case-insensitive):
//   nombre / name        → name
//   teléfono / phone     → phone
//   email                → email
//   cumpleaños / birthday→ birthday
//   notas / notes        → notes
// ══════════════════════════════════════════════════════════════════════

type Row = {
  name: string;
  phone: string;
  email: string;
  birthday: string;
  notes: string;
  valid: boolean;
  error?: string;
};

const COLUMN_ALIASES: Record<string, string> = {
  nombre: 'name', name: 'name', cliente: 'name', client: 'name',
  telefono: 'phone', tel: 'phone', phone: 'phone', whatsapp: 'phone', celular: 'phone', movil: 'phone',
  email: 'email', correo: 'email', mail: 'email',
  cumpleanos: 'birthday', birthday: 'birthday', cumple: 'birthday', nacimiento: 'birthday',
  notas: 'notes', notes: 'notes', observaciones: 'notes',
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]/g, '');
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const splitLine = (line: string) => {
    // Parser simple: maneja comillas dobles
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += c;
      }
    }
    result.push(current);
    return result.map(c => c.trim());
  };
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

export default function ImportClientesPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ inserted: number; skipped: number } | null>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processText(text);
    };
    reader.readAsText(file, 'utf-8');
  }

  function processText(text: string) {
    const { headers, rows: rawRows } = parseCSV(text);
    if (headers.length === 0 || rawRows.length === 0) {
      toast.error('El archivo está vacío o no es CSV válido');
      return;
    }

    // Mapeo de columnas
    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = COLUMN_ALIASES[normalizeHeader(h)];
      if (key && colMap[key] === undefined) colMap[key] = i;
    });

    if (colMap.name === undefined) {
      toast.error('No encontramos la columna de nombre. Asegúrate de tener una columna llamada “Nombre”.');
      return;
    }

    const parsed: Row[] = rawRows.map((raw) => {
      const name = (raw[colMap.name] || '').trim();
      const phone = colMap.phone !== undefined ? (raw[colMap.phone] || '').trim() : '';
      const email = colMap.email !== undefined ? (raw[colMap.email] || '').trim() : '';
      const birthday = colMap.birthday !== undefined ? (raw[colMap.birthday] || '').trim() : '';
      const notes = colMap.notes !== undefined ? (raw[colMap.notes] || '').trim() : '';
      let error: string | undefined;
      let valid = true;
      if (!name) { error = 'Falta el nombre'; valid = false; }
      else if (!phone && !email) { error = 'Falta teléfono o email'; valid = false; }
      return { name, phone, email, birthday, notes, valid, error };
    });

    setRows(parsed);
    setStep('preview');
  }

  async function handleImport() {
    setImporting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }

    const valid = rows.filter(r => r.valid);
    const skipped = rows.length - valid.length;

    // Lotes de 50
    let inserted = 0;
    for (let i = 0; i < valid.length; i += 50) {
      const batch = valid.slice(i, i + 50).map(r => ({
        user_id: user.id,
        name: r.name,
        phone: r.phone || null,
        email: r.email || null,
        birthday: r.birthday ? normalizeBirthday(r.birthday) : null,
        notes: r.notes || null,
        is_active: true,
      }));
      const { error, count } = await supabase.from('clients').insert(batch).select('id', { count: 'exact' });
      if (error) {
        toast.error('Error al importar lote ' + Math.floor(i / 50 + 1) + ': ' + error.message);
      } else {
        inserted += count || batch.length;
      }
    }

    setResults({ inserted, skipped });
    setStep('done');
    setImporting(false);
    if (inserted > 0) toast.success(`${inserted} clientes importados`);
  }

  function downloadTemplate() {
    const csv = 'nombre,telefono,email,cumpleanos,notas\nMaría López,442 123 4567,maria@ejemplo.com,1990-03-15,Cliente VIP\nJuan Pérez,442 765 4321,,1988-07-22,';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-clientes-vylta.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Plantilla descargada');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold tracking-tight">Importar clientes desde CSV</h1>
          <p className="text-sm text-muted-foreground">
            Sube un archivo CSV con tus clientes para cargarlos masivamente a VYLTA.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        <Step active={step === 'upload'} done={step !== 'upload'} label="1. Subir archivo" />
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <Step active={step === 'preview'} done={step === 'done'} label="2. Revisar" />
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <Step active={step === 'done'} done={false} label="3. Listo" />
      </div>

      {step === 'upload' && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/30 p-10 text-center transition hover:border-vylta-green-500/40 hover:bg-vylta-green-500/5"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-bold">Selecciona tu archivo CSV</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Click aquí para elegir un archivo o arrástralo
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          <div className="mt-4 space-y-2">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-400">
              <p className="font-semibold">Columnas reconocidas automáticamente:</p>
              <p className="mt-1">Nombre (obligatorio), Teléfono, Email, Cumpleaños, Notas</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" />
              Descargar plantilla CSV
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-6 w-6 text-vylta-green-600 dark:text-vylta-green-400" />
              <div>
                <h3 className="text-sm font-bold">{rows.length} filas detectadas</h3>
                <p className="text-[11px] text-muted-foreground">
                  {rows.filter(r => r.valid).length} válidas, {rows.filter(r => !r.valid).length} con errores (se omitirán)
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setRows([]); setStep('upload'); }}>
              <X className="h-3.5 w-3.5" />
              Cambiar archivo
            </Button>
          </div>

          {/* Preview tabla */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-secondary/30">
                  <tr>
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground">Nombre</th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground">Teléfono</th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground">Cumple</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className={cn('border-b border-border last:border-b-0', !r.valid && 'bg-destructive/5')}>
                      <td className="px-3 py-2">
                        {r.valid ? (
                          <Check className="h-3.5 w-3.5 text-vylta-green-600 dark:text-vylta-green-400" />
                        ) : (
                          <span title={r.error}><AlertTriangle className="h-3.5 w-3.5 text-destructive" /></span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-semibold">{r.name || <span className="italic text-destructive">{r.error}</span>}</td>
                      <td className="px-3 py-2">{r.phone || '—'}</td>
                      <td className="px-3 py-2 truncate">{r.email || '—'}</td>
                      <td className="px-3 py-2">{r.birthday || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 20 && (
              <div className="border-t border-border bg-secondary/20 px-4 py-2 text-center text-[11px] text-muted-foreground">
                Mostrando 20 de {rows.length} filas. Todas las válidas se importarán.
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={importing || rows.filter(r => r.valid).length === 0}>
              {importing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
              ) : (
                <><Upload className="h-4 w-4" /> Importar {rows.filter(r => r.valid).length} clientes</>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && results && (
        <div className="rounded-xl border border-vylta-green-500/40 bg-vylta-green-500/5 p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-vylta-green-500/20">
            <Check className="h-7 w-7 text-vylta-green-600 dark:text-vylta-green-400" />
          </div>
          <h3 className="text-lg font-bold">¡Importación completada!</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {results.inserted} clientes agregados a tu base de datos.
            {results.skipped > 0 && <> {results.skipped} filas se omitieron por datos incompletos.</>}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => { setRows([]); setResults(null); setStep('upload'); }}>
              Importar más
            </Button>
            <Button onClick={() => router.push('/clientes')}>
              Ver mis clientes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold',
      done && 'bg-vylta-green-500/10 text-vylta-green-700 dark:text-vylta-green-400',
      active && !done && 'bg-vylta-green-500 text-white',
      !active && !done && 'bg-secondary text-muted-foreground',
    )}>
      {done && <Check className="h-3 w-3" />}
      {label}
    </span>
  );
}

function normalizeBirthday(s: string): string | null {
  // Intenta convertir varios formatos a YYYY-MM-DD
  const cleaned = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  // DD/MM/YYYY o DD-MM-YYYY
  const m = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, d, mm, y] = m;
    if (y.length === 2) y = '19' + y;
    return `${y}-${mm.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}
