#!/bin/bash
# ============================================================
# VYLTA - Despliegue de Google Ads tag (AW-591393013)
# Parcha vylta-crm (local) y vylta-web (clona si no existe),
# hace commit y push a main en ambos.
# Uso:  bash <(curl -fsSL https://raw.githubusercontent.com/antoniolopezlabra-boop/vylta-crm/main/scripts/deploy-google-ads-tag.sh)
# ============================================================
set -e

CRM_DIR="$HOME/vylta-crm"
WEB_DIR="$HOME/vylta-web"

echo "==== [1/2] CRM (app.vylta.lat) ===="
cd "$CRM_DIR"
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: tienes cambios sin commitear en vylta-crm. Resuelvelos y reintenta."
  git status --short
  exit 1
fi
git checkout main
git pull origin main

python3 << 'PYEOF'
# --- app/layout.tsx ---
with open('app/layout.tsx','r',encoding='utf-8') as f: lay = f.read()
if 'googletagmanager' in lay:
    print('layout.tsx ya tiene gtag, salto')
else:
    assert "import { Inter } from 'next/font/google';" in lay
    lay = lay.replace("import { Inter } from 'next/font/google';",
        "import { Inter } from 'next/font/google';\nimport Script from 'next/script';", 1)
    SCRIPT_BLOCK = '''        {/* Google Ads tag (AW-591393013) - conversiones VYLTA */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-591393013"
          strategy="afterInteractive"
        />
        <Script id="google-ads-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-591393013');
          `}
        </Script>
      </body>'''
    assert lay.count('      </body>') == 1
    lay = lay.replace('      </body>', SCRIPT_BLOCK, 1)
    with open('app/layout.tsx','w',encoding='utf-8') as f: f.write(lay)
    print('layout.tsx parchado')

# --- lib/gtag-ads.ts ---
GTAG_LIB = '''// Google Ads - conversiones VYLTA (cuenta AW-591393013)
// Registro: se dispara al crear cuenta exitosamente.
// La etiqueta base gtag.js se carga en app/layout.tsx.

export const GOOGLE_ADS_ID = 'AW-591393013';
const CONV_REGISTRO = 'AW-591393013/ofe0COmHnLwcEPXh_5kC';

export function reportRegistroConversion(): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return;
  try {
    gtag('event', 'conversion', {
      send_to: CONV_REGISTRO,
      value: 350.0,
      currency: 'MXN',
    });
  } catch {
    // nunca bloquear el flujo de registro por analitica
  }
}
'''
with open('lib/gtag-ads.ts','w',encoding='utf-8') as f: f.write(GTAG_LIB)
print('lib/gtag-ads.ts creado')

# --- components/register-form.tsx ---
with open('components/register-form.tsx','r',encoding='utf-8') as f: reg = f.read()
if 'reportRegistroConversion' in reg:
    print('register-form.tsx ya parchado, salto')
else:
    assert "import { toast } from 'sonner';" in reg
    reg = reg.replace("import { toast } from 'sonner';",
        "import { toast } from 'sonner';\nimport { reportRegistroConversion } from '@/lib/gtag-ads';", 1)
    anchor1 = """      toast.success(
        'Cuenta creada. Revisa tu correo para confirmar tu cuenta antes de iniciar sesi\u00f3n.',
        { duration: 6000 },
      );
      router.push('/login');"""
    assert anchor1 in reg, 'anchor1 no encontrado'
    reg = reg.replace(anchor1, anchor1.replace("      router.push('/login');",
        "      reportRegistroConversion();\n      router.push('/login');"), 1)
    anchor2 = "    toast.success('\u00a1Cuenta creada! Vamos a configurar tu negocio.');"
    assert anchor2 in reg, 'anchor2 no encontrado'
    reg = reg.replace(anchor2, "    reportRegistroConversion();\n" + anchor2, 1)
    with open('components/register-form.tsx','w',encoding='utf-8') as f: f.write(reg)
    print('register-form.tsx parchado')
PYEOF

if [ -n "$(git status --porcelain)" ]; then
  git add app/layout.tsx components/register-form.tsx lib/gtag-ads.ts
  git commit -m "feat: Google Ads tag AW-591393013 + conversion Registro en signup"
  git push origin main
  echo "[OK] CRM desplegado"
else
  echo "[OK] CRM sin cambios (ya estaba parchado)"
fi

echo ""
echo "==== [2/2] LANDING (vylta.lat) ===="
if [ -d "$WEB_DIR" ]; then
  cd "$WEB_DIR"
else
  cd "$HOME"
  git clone https://github.com/antoniolopezlabra-boop/vylta-web.git
  cd vylta-web
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: tienes cambios sin commitear en vylta-web. Resuelvelos y reintenta."
  git status --short
  exit 1
fi
git checkout main
git pull origin main

python3 << 'PYEOF2'
GTAG_BASE = '''<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-591393013"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-591393013');
</script>'''

with open('index.html','r',encoding='utf-8') as f: idx = f.read()
if 'googletagmanager' in idx:
    print('index.html ya tiene gtag, salto')
else:
    assert idx.count('<head>') == 1
    idx = idx.replace('<head>', GTAG_BASE, 1)
    with open('index.html','w',encoding='utf-8') as f: f.write(idx)
    print('index.html parchado')

GTAG_SUCCESS = GTAG_BASE.replace('</script>', '''
// Conversion: Suscripcion Pagada VYLTA (valor dinamico por plan via ?plan=)
(function(){
  try {
    var p = new URLSearchParams(window.location.search);
    var plan = (p.get('plan') || '').toLowerCase();
    var values = { premium: 399.0, luxury: 799.0, vippremium: 4390.0, vipluxury: 8790.0 };
    var payload = {
      'send_to': 'AW-591393013/PwUKCOyHnLwcEPXh_5kC',
      'value': values[plan] || 399.0,
      'currency': 'MXN'
    };
    var sid = p.get('session_id');
    if (sid) { payload['transaction_id'] = sid; }
    gtag('event', 'conversion', payload);
  } catch (e) {}
})();
</script>''', 1)

with open('success.html','r',encoding='utf-8') as f: suc = f.read()
if 'googletagmanager' in suc:
    print('success.html ya tiene gtag, salto')
else:
    assert suc.count('<head>') == 1
    suc = suc.replace('<head>', GTAG_SUCCESS, 1)
    with open('success.html','w',encoding='utf-8') as f: f.write(suc)
    print('success.html parchado')
PYEOF2

if [ -n "$(git status --porcelain)" ]; then
  git add index.html success.html
  git commit -m "feat: Google Ads tag AW-591393013 + conversion Suscripcion en success"
  git push origin main
  echo "[OK] Landing desplegada"
else
  echo "[OK] Landing sin cambios (ya estaba parchada)"
fi

echo ""
echo "================================================="
echo "[LISTO] Todo desplegado. Vercel y GitHub Pages"
echo "publicaran en 1-3 minutos."
echo "================================================="
