import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { authRoutes } from './routes/auth'
import { cajasRoutes } from './routes/cajas'
import { movimientosRoutes } from './routes/movimientos'
import { pendientesRoutes } from './routes/pendientes'
import { adminRoutes } from './routes/admin'
import { alertasRoutes } from './routes/alertas'
import { cuadreRoutes } from './routes/cuadre'
import { authMiddleware } from './middleware/auth'
import { initDatabase, ensureAdminExists, migrateDatabase } from './startup'

type Bindings = { DB: D1Database }

const app = new Hono<{ Bindings: Bindings }>()

// ── Auto-init DB ──────────────────────────────────────────────────────────────
// Solo inicializa si la tabla NO existe (primera vez).
// La migración de schema viejo→nuevo se hace via POST /api/auth/migrate
app.use('*', async (c, next) => {
  try {
    const check = await c.env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'`
    ).first()
    if (!check) {
      // Primera vez: crear todo desde cero + crear superadmin
      await initDatabase(c.env.DB)
      await ensureAdminExists(c.env.DB)
    }
    // Si la tabla ya existe, NO hacer nada más aquí.
    // La migración y el ensureAdmin se hacen via /api/auth/migrate
  } catch (err) {
    console.error('Auto-init error:', err)
  }
  await next()
})

app.use('/api/*', cors({ origin: '*', allowMethods: ['GET','POST','PUT','DELETE','PATCH'], allowHeaders: ['Content-Type','Authorization'] }))
app.use('/static/*', serveStatic({ root: './public' }))

// ── Páginas ───────────────────────────────────────────────────────────────────
app.get('/', (c) => c.redirect('/login'))
app.get('/login', (c) => c.html(loginPage()))
app.get('/setup', (c) => c.html(setupPage()))
app.get('/app', (c) => c.html(appPage()))
app.get('/app/*', (c) => c.html(appPage()))

// ── API Pública ───────────────────────────────────────────────────────────────
app.route('/api/auth', authRoutes)

// ── API Protegida ─────────────────────────────────────────────────────────────
const api = new Hono<{ Bindings: Bindings }>()
api.use('/*', authMiddleware as any)
api.route('/cajas', cajasRoutes as any)
api.route('/movimientos', movimientosRoutes as any)
api.route('/pendientes', pendientesRoutes as any)
api.route('/admin', adminRoutes as any)
api.route('/alertas', alertasRoutes as any)
api.route('/cuadre', cuadreRoutes as any)
app.route('/api', api)

app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.0', app: 'Pagos Rapidos' }))

// ── Debug temporal (solo lectura, sin auth para diagnosticar) ─────────────────
app.get('/debug/pendientes', async (c) => {
  try {
    const total = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM pendientes`).first() as any
    const porEstado = await c.env.DB.prepare(`SELECT estado, COUNT(*) as n FROM pendientes GROUP BY estado`).all()
    const muestra = await c.env.DB.prepare(`SELECT id, usuario_id, cliente_nombre, estado, fecha_vencimiento FROM pendientes LIMIT 15`).all()
    const usuarios = await c.env.DB.prepare(`SELECT id, nombre, apellido, rol, activo FROM usuarios LIMIT 10`).all()
    const joinTest = await c.env.DB.prepare(`SELECT p.id, p.estado, p.usuario_id, u.nombre FROM pendientes p LEFT JOIN usuarios u ON p.usuario_id = u.id WHERE p.estado != 'anulado' LIMIT 10`).all()
    return c.json({ total: total?.n, porEstado: porEstado.results, muestra: muestra.results, usuarios: usuarios.results, joinTest: joinTest.results })
  } catch(e: any) { return c.json({ error: e.message }) }
})
app.notFound((c) => {
  if (c.req.path.startsWith('/api')) return c.json({ error: 'Ruta no encontrada' }, 404)
  return c.html(appPage())
})
app.onError((err, c) => {
  console.error('Error:', err)
  return c.json({ error: 'Error interno', detail: err.message }, 500)
})

export default app

// ─────────────────────────────────────────────────────────────────────────────
// LOGO SVG
// ─────────────────────────────────────────────────────────────────────────────
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 240">
  <rect x="10" y="88" width="55" height="10" rx="5" fill="#F5A400"/>
  <rect x="18" y="104" width="42" height="8" rx="4" fill="#F5A400"/>
  <rect x="24" y="118" width="30" height="7" rx="3.5" fill="#F5A400"/>
  <path d="M65 40 h65 a45 45 0 0 1 0 90 h-15 l35 65 h-30 l-32-60 v60 h-23 z" fill="#1148AD"/>
  <path d="M88 60 h35 a22 22 0 0 1 0 44 h-35 z" fill="white"/>
  <path d="M115 130 l20 0 l35 65 h-22 z" fill="#F5A400"/>
</svg>`

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function loginPage(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pagos Rapidos - Iniciar Sesión</title>
<link rel="icon" href="/static/logo.png" type="image/png">
<script src="https://cdn.tailwindcss.com"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *{font-family:'Inter',sans-serif}
  .bg-brand{background:linear-gradient(135deg,#0a3d8f 0%,#1148AD 50%,#1565C0 100%)}
  .btn-gold{background:linear-gradient(135deg,#F5A400,#E09000);transition:all .2s}
  .btn-gold:hover{transform:translateY(-1px);box-shadow:0 8px 25px rgba(245,164,0,.45)}
  .inp{border:2px solid #E5E7EB;transition:all .2s;width:100%;padding:12px 16px;border-radius:12px;font-size:15px;background:#F9FAFB;color:#1E293B}
  .inp:focus{border-color:#1148AD;box-shadow:0 0 0 3px rgba(17,72,173,.12);outline:none;background:white}
  .shake{animation:shake .45s ease-in-out}
  @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
  .spin{animation:sp .8s linear infinite;border:3px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;width:20px;height:20px;display:inline-block}
  @keyframes sp{to{transform:rotate(360deg)}}
</style>
</head>
<body class="bg-brand min-h-screen flex items-center justify-center p-4">
<div class="w-full max-w-md">
  <div class="bg-white rounded-3xl shadow-2xl overflow-hidden">
    <div class="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 px-8 py-10 text-center">
      <div class="flex justify-center mb-3">
        <img src="/static/logo.png" alt="Logo" class="h-24 w-auto drop-shadow-xl"
             onerror="this.style.display='none';document.getElementById('lf').style.display='block'">
        <div id="lf" style="display:none">${LOGO_SVG}</div>
      </div>
      <h1 class="text-white font-black text-2xl">Pagos Rapidos</h1>
      <p class="text-blue-200 text-sm mt-1">Agencia Alban Borja · Sistema de Caja</p>
    </div>
    <div class="px-8 py-8">
      <div id="err" class="hidden mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
        <i class="fas fa-circle-exclamation flex-shrink-0"></i><span id="err-txt"></span>
      </div>
      <form id="frm" onsubmit="doLogin(event)">
        <div class="mb-4">
          <label class="block text-sm font-semibold text-gray-700 mb-2">Cédula / Usuario</label>
          <input id="ced" type="text" placeholder="Ingresa tu número de cédula" autocomplete="username" class="inp">
        </div>
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
          <div class="relative">
            <input id="pwd" type="password" placeholder="••••••••" autocomplete="current-password" class="inp pr-12">
            <button type="button" onclick="togglePwd()" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
              <svg id="eye" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
          </div>
        </div>
        <button type="submit" id="btn" class="btn-gold w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2">
          <i class="fas fa-right-to-bracket"></i>
          <span id="btxt">Ingresar al Sistema</span>
          <span id="bsp" class="hidden spin"></span>
        </button>
      </form>
      <p class="text-center text-xs text-gray-400 mt-6">© 2024 Pagos Rapidos · Agencia Alban Borja</p>
    </div>
  </div>
</div>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">
<script>
function togglePwd(){const i=document.getElementById('pwd');i.type=i.type==='password'?'text':'password'}
function showErr(m){const e=document.getElementById('err');document.getElementById('err-txt').textContent=m;e.classList.remove('hidden');document.getElementById('frm').classList.add('shake');setTimeout(()=>document.getElementById('frm').classList.remove('shake'),500)}
async function doLogin(e){
  e.preventDefault();
  const ced=document.getElementById('ced').value.trim();
  const pwd=document.getElementById('pwd').value;
  if(!ced||!pwd){showErr('Ingresa tu cédula y contraseña');return}
  const btn=document.getElementById('btn');
  document.getElementById('btxt').textContent='Verificando...';
  document.getElementById('bsp').classList.remove('hidden');
  btn.disabled=true;
  document.getElementById('err').classList.add('hidden');
  try{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cedula:ced,password:pwd})});
    const d=await r.json();
    if(!r.ok){showErr(d.error||'Error al iniciar sesión');return}
    localStorage.setItem('token',d.token);
    localStorage.setItem('usuario',JSON.stringify(d.usuario));
    window.location.href='/app';
  }catch(err){showErr('Error de conexión. Intenta de nuevo.')}
  finally{btn.disabled=false;document.getElementById('btxt').textContent='Ingresar al Sistema';document.getElementById('bsp').classList.add('hidden')}
}
const tk=localStorage.getItem('token');
if(tk){fetch('/api/auth/me',{headers:{'Authorization':'Bearer '+tk}}).then(r=>r.json()).then(d=>{if(d.id)window.location.href='/app'}).catch(()=>{})}
document.addEventListener('DOMContentLoaded',()=>document.getElementById('ced').focus());
</script>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP PAGE
// ─────────────────────────────────────────────────────────────────────────────
function setupPage(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Configuración Inicial</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');*{font-family:'Inter',sans-serif}.inp{border:2px solid #E5E7EB;width:100%;padding:11px 14px;border-radius:10px;font-size:14px;background:#F9FAFB}.inp:focus{border-color:#1148AD;outline:none;box-shadow:0 0 0 3px rgba(17,72,173,.1)}</style>
</head>
<body class="bg-gradient-to-br from-blue-900 to-blue-700 min-h-screen flex items-center justify-center p-4">
<div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
  <div class="text-center mb-6">
    <img src="/static/logo.png" alt="Logo" class="h-20 mx-auto mb-3">
    <h1 class="text-2xl font-black text-gray-800">Configuración Inicial</h1>
    <p class="text-gray-500 text-sm mt-1">Crea tu cuenta de superadministrador</p>
  </div>
  <div id="msg" class="hidden mb-4 p-3 rounded-lg text-sm font-medium"></div>
  <form id="frm" onsubmit="doSetup(event)" class="space-y-4">
    <div>
      <label class="block text-sm font-semibold text-gray-700 mb-1.5">Cédula</label>
      <input id="ced" type="text" placeholder="Número de cédula" class="inp" required>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">Nombre</label>
        <input id="nom" type="text" placeholder="Nombre" class="inp" required>
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">Apellido</label>
        <input id="ape" type="text" placeholder="Apellido" class="inp" required>
      </div>
    </div>
    <div>
      <label class="block text-sm font-semibold text-gray-700 mb-1.5">Contraseña</label>
      <input id="pwd" type="password" placeholder="Mínimo 6 caracteres" class="inp" required>
    </div>
    <button type="submit" class="w-full py-3 rounded-xl bg-gradient-to-r from-blue-800 to-blue-600 text-white font-bold text-base">
      Crear Superadministrador
    </button>
    <p class="text-center text-sm"><a href="/login" class="text-blue-600 hover:underline">← Volver al login</a></p>
  </form>
</div>
<script>
async function doSetup(e){
  e.preventDefault();
  const msg=document.getElementById('msg');
  try{
    const r=await fetch('/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cedula:document.getElementById('ced').value.trim(),nombre:document.getElementById('nom').value.trim(),apellido:document.getElementById('ape').value.trim(),password:document.getElementById('pwd').value})});
    const d=await r.json();
    if(r.ok){msg.className='mb-4 p-3 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200';msg.textContent='✅ '+d.message+' Redirigiendo...';msg.classList.remove('hidden');setTimeout(()=>window.location.href='/login',2000)}
    else{msg.className='mb-4 p-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200';msg.textContent='❌ '+d.error;msg.classList.remove('hidden')}
  }catch(err){msg.className='mb-4 p-3 rounded-lg text-sm font-medium bg-red-50 text-red-700';msg.textContent='Error de conexión';msg.classList.remove('hidden')}
}
</script>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// APP PAGE — SPA completa con 3 roles
// ─────────────────────────────────────────────────────────────────────────────
function appPage(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Pagos Rapidos - Agencia Alban Borja</title>
<link rel="icon" href="/static/logo.png" type="image/png">
<link rel="apple-touch-icon" href="/static/logo.png">
<meta name="theme-color" content="#1148AD">
<meta name="application-name" content="Pagos Rapidos">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box}
*{font-family:'Inter',sans-serif;margin:0;padding:0}
:root{--blue:#1148AD;--blue-dk:#0a3d8f;--gold:#F5A400;--ok:#10B981;--err:#EF4444;--warn:#F59E0B}
body{background:#F1F5F9;color:#1E293B;min-height:100vh}

/* SIDEBAR */
.sidebar{width:260px;min-height:100vh;background:linear-gradient(180deg,#071f4a 0%,#0a3d8f 30%,#1148AD 100%);position:fixed;top:0;left:0;z-index:40;transition:transform .3s;display:flex;flex-direction:column}
.sb-logo{padding:20px 18px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;align-items:center;gap:11px}
.sb-logo img{height:44px;width:auto;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,.35))}
.sb-logo-txt .brand{font-size:15px;font-weight:800;color:white;line-height:1.2}
.sb-logo-txt .sub{font-size:10px;color:rgba(255,255,255,.6);font-weight:400}
.nav-sec{color:rgba(255,255,255,.4);font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:14px 18px 5px}
.nav-item{display:flex;align-items:center;gap:11px;padding:10px 18px;color:rgba(255,255,255,.72);cursor:pointer;border-left:3px solid transparent;font-size:13.5px;font-weight:500;transition:all .18s;user-select:none}
.nav-item:hover{background:rgba(255,255,255,.09);color:white;border-left-color:rgba(255,255,255,.35)}
.nav-item.active{background:rgba(255,255,255,.14);color:white;border-left-color:#F5A400;font-weight:600}
.nav-item i{width:18px;text-align:center;font-size:14px}
.sb-foot{margin-top:auto;padding:14px 18px;border-top:1px solid rgba(255,255,255,.12)}
.sb-user{display:flex;align-items:center;gap:10px}
.sb-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0}
.sb-user-info .name{font-size:13px;font-weight:600;color:white;line-height:1.3}
.sb-user-info .rol{font-size:11px;color:rgba(255,255,255,.55)}

/* MAIN */
.main{margin-left:260px;min-height:100vh;display:flex;flex-direction:column}
.topbar{background:white;border-bottom:1px solid #E2E8F0;padding:0 24px;height:62px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:30;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.pg-content{flex:1;padding:22px}

/* CARDS */
.card{background:white;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card-hd{padding:16px 20px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
.card-bd{padding:18px 20px}
.stat-card{background:white;border-radius:14px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.icon-box{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 17px;border-radius:9px;font-weight:600;font-size:13.5px;cursor:pointer;border:none;transition:all .18s}
.btn:hover{transform:translateY(-1px)}.btn:active{transform:translateY(0)}
.btn-primary{background:linear-gradient(135deg,#1148AD,#1565C0);color:white;box-shadow:0 4px 12px rgba(17,72,173,.28)}
.btn-success{background:linear-gradient(135deg,#10B981,#059669);color:white;box-shadow:0 4px 12px rgba(16,185,129,.28)}
.btn-danger{background:linear-gradient(135deg,#EF4444,#DC2626);color:white;box-shadow:0 4px 12px rgba(239,68,68,.28)}
.btn-gold{background:linear-gradient(135deg,#F5A400,#E09000);color:white;box-shadow:0 4px 12px rgba(245,164,0,.28)}
.btn-outline{background:white;color:#374151;border:1.5px solid #E5E7EB}
.btn-outline:hover{border-color:#1148AD;color:#1148AD}
.btn-gray{background:#F3F4F6;color:#374151}
.btn-sm{padding:6px 13px;font-size:12.5px;border-radius:7px}

/* BADGES */
.badge{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:20px;font-size:11.5px;font-weight:600}
.badge-ok{background:#D1FAE5;color:#065F46}.badge-err{background:#FEE2E2;color:#991B1B}
.badge-warn{background:#FEF3C7;color:#92400E}.badge-info{background:#CFFAFE;color:#164E63}
.badge-blue{background:#DBEAFE;color:#1E40AF}.badge-gray{background:#F3F4F6;color:#374151}
.badge-purple{background:#EDE9FE;color:#4C1D95}.badge-gold{background:#FEF3C7;color:#92400E}

/* FORMS */
.lbl{display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px}
.inp{width:100%;padding:9px 13px;border:2px solid #E5E7EB;border-radius:9px;font-size:13.5px;color:#1E293B;background:#F9FAFB;transition:border-color .18s}
.inp:focus{border-color:#1148AD;background:white;outline:none;box-shadow:0 0 0 3px rgba(17,72,173,.08)}
.inp-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236B7280' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}

/* TABLES */
.tbl{width:100%;border-collapse:collapse}
.tbl th{padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.06em;background:#F8FAFC;border-bottom:2px solid #E2E8F0}
.tbl td{padding:12px 14px;font-size:13.5px;color:#374151;border-bottom:1px solid #F1F5F9;vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:#F8FAFC}

/* MODAL */
.modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px)}
.modal{background:white;border-radius:18px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,.3)}
.modal-hd{padding:18px 22px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:white;z-index:1}
.modal-bd{padding:22px}
.modal-ft{padding:14px 22px;border-top:1px solid #F1F5F9;display:flex;gap:9px;justify-content:flex-end}

/* ALERTS */
.alert-box{padding:12px 15px;border-radius:11px;display:flex;align-items:flex-start;gap:9px;font-size:13px}
.alert-warn{background:#FEF3C7;color:#92400E;border:1px solid #FDE68A}
.alert-danger{background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5}
.alert-ok{background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7}
.alert-info{background:#DBEAFE;color:#1E40AF;border:1px solid #93C5FD}

/* TOAST */
.toast{position:fixed;bottom:22px;right:22px;z-index:9999;min-width:270px;max-width:360px;padding:13px 16px;border-radius:11px;box-shadow:0 8px 24px rgba(0,0,0,.22);display:flex;align-items:center;gap:9px;font-weight:500;font-size:13.5px;transform:translateY(100px);opacity:0;transition:all .3s ease}
.toast.show{transform:translateY(0);opacity:1}
.toast-ok{background:#10B981;color:white}.toast-err{background:#EF4444;color:white}.toast-info{background:#1148AD;color:white}.toast-warn{background:#F59E0B;color:white}

/* MISC */
.saldo-box{background:linear-gradient(135deg,#071f4a,#1148AD);color:white;border-radius:14px;padding:22px}
.tab-grp{background:#F1F5F9;border-radius:9px;padding:3px;display:inline-flex;gap:2px}
.tab-btn{padding:7px 18px;border-radius:7px;font-weight:600;font-size:13px;cursor:pointer;border:none;background:transparent;color:#6B7280;transition:all .18s}
.tab-btn.active{background:white;color:#1148AD;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.hamburger{display:none;background:none;border:none;cursor:pointer;padding:7px;color:#374151}
.sb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:35}
.empty-st{text-align:center;padding:44px 22px;color:#9CA3AF}
.empty-st i{font-size:44px;margin-bottom:14px;opacity:.35}
.spin{border:2.5px solid rgba(0,0,0,.1);border-top-color:#1148AD;border-radius:50%;width:18px;height:18px;animation:sp .7s linear infinite;display:inline-block}
@keyframes sp{to{transform:rotate(360deg)}}
.loading-full{display:flex;align-items:center;gap:10px;justify-content:center;padding:40px;color:#9CA3AF}
.ing-row{border-left:3px solid #10B981}.eg-row{border-left:3px solid #EF4444}
.pr-urgente{border-left:4px solid #EF4444}.pr-alta{border-left:4px solid #F59E0B}
.pr-normal{border-left:4px solid #1148AD}.pr-baja{border-left:4px solid #9CA3AF}
.role-crown{color:#F5A400}.role-eye{color:#8B5CF6}.role-work{color:#10B981}
@media(max-width:768px){
  .sidebar{transform:translateX(-100%)}.sidebar.open{transform:translateX(0)}
  .sb-overlay.open{display:block}.main{margin-left:0}.hamburger{display:flex}
  .pg-content{padding:14px}.stat-grid{grid-template-columns:1fr 1fr!important}
  .hide-mobile{display:none!important}
}
</style>
</head>
<body>

<!-- Sidebar -->
<nav class="sidebar" id="sidebar">
  <div class="sb-logo">
    <img src="/static/logo.png" alt="Logo"
         onerror="this.style.display='none'">
    <div class="sb-logo-txt">
      <div class="brand">Pagos Rapidos</div>
      <div class="sub">Agencia Alban Borja</div>
    </div>
  </div>
  <nav style="flex:1;overflow-y:auto;padding-bottom:8px">
    <!-- Trabajador / Todos -->
    <div class="nav-sec">Principal</div>
    <div class="nav-item active" id="nav-dashboard" onclick="showPage('dashboard')">
      <i class="fas fa-gauge-high"></i><span>Dashboard</span>
    </div>
    <!-- Solo trabajador ve su caja -->
    <div class="nav-item" id="nav-caja" onclick="showPage('caja')">
      <i class="fas fa-cash-register"></i><span>Mi Caja de Hoy</span>
    </div>
    <div class="nav-item" id="nav-movimientos" onclick="showPage('movimientos')">
      <i class="fas fa-right-left"></i><span>Movimientos</span>
    </div>
    <div class="nav-item" id="nav-pendientes" onclick="showPage('pendientes')">
      <i class="fas fa-clock"></i><span>Pendientes / Por Pagar</span>
    </div>
    <div class="nav-item" id="nav-historial" onclick="showPage('historial')">
      <i class="fas fa-calendar-days"></i><span>Historial</span>
    </div>
    <div class="nav-item" id="nav-cuadre" onclick="showPage('cuadre')">
      <i class="fas fa-file-excel" style="color:#10B981"></i><span>Cuadre Bancario</span>
    </div>
    <div class="nav-item" id="nav-alertas" onclick="showPage('alertas')">
      <i class="fas fa-bell"></i><span>Alertas <span id="badge-alertas" class="hidden badge badge-err ml-auto text-xs">0</span></span>
    </div>

    <!-- Supervisor + Superadmin -->
    <div id="nav-sec-admin" class="hidden">
      <div class="nav-sec">Administración</div>
      <div class="nav-item" id="nav-admin-dashboard" onclick="showPage('admin-dashboard')">
        <i class="fas fa-chart-line"></i><span>Panel General</span>
      </div>
      <div class="nav-item" id="nav-admin-cajas" onclick="showPage('admin-cajas')">
        <i class="fas fa-boxes-stacked"></i><span>Todas las Cajas</span>
      </div>
      <div class="nav-item" id="nav-admin-reportes" onclick="showPage('admin-reportes')">
        <i class="fas fa-file-chart-column"></i><span>Reportes</span>
      </div>
      <div class="nav-item" id="nav-admin-pendientes" onclick="showPage('admin-pendientes')">
        <i class="fas fa-file-invoice-dollar"></i><span>Todos los Pendientes</span>
      </div>
      <div class="nav-item" id="nav-admin-auditoria" onclick="showPage('admin-auditoria')">
        <i class="fas fa-shield-halved"></i><span>Auditoría</span>
      </div>
    </div>

    <!-- Solo Superadmin -->
    <div id="nav-sec-super" class="hidden">
      <div class="nav-sec">Superadmin</div>
      <div class="nav-item" id="nav-admin-usuarios" onclick="showPage('admin-usuarios')">
        <i class="fas fa-users-gear"></i><span>Gestión de Usuarios</span>
      </div>
      <div class="nav-item" id="nav-admin-config" onclick="showPage('admin-config')">
        <i class="fas fa-sliders"></i><span>Configuración</span>
      </div>
    </div>
  </nav>

  <div class="sb-foot">
    <div class="sb-user">
      <div class="sb-avatar" id="sb-avatar" style="background:#1565C0">
        <span id="sb-initials" style="color:white">?</span>
      </div>
      <div class="sb-user-info" style="flex:1;min-width:0">
        <div class="name" id="sb-name">Cargando...</div>
        <div class="rol" id="sb-rol">...</div>
      </div>
      <button onclick="logout()" class="text-white/50 hover:text-white ml-1 p-1" title="Cerrar sesión">
        <i class="fas fa-right-from-bracket text-sm"></i>
      </button>
    </div>
  </div>
</nav>

<div class="sb-overlay" id="sb-overlay" onclick="closeSidebar()"></div>

<!-- Main -->
<div class="main" id="main-content">
  <header class="topbar">
    <div class="flex items-center gap-3">
      <button class="hamburger" onclick="toggleSidebar()"><i class="fas fa-bars text-xl"></i></button>
      <div>
        <h1 class="text-gray-800 font-bold text-base leading-tight" id="page-title">Dashboard</h1>
        <p class="text-gray-400 text-xs" id="page-sub">Resumen del día</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <div class="text-right hide-mobile">
        <div class="text-xs font-semibold text-gray-700" id="tb-name">...</div>
        <div class="text-xs text-gray-400" id="tb-fecha"></div>
      </div>
      <button onclick="logout()" class="btn btn-outline btn-sm hide-mobile">
        <i class="fas fa-right-from-bracket"></i> Salir
      </button>
    </div>
  </header>
  <main class="pg-content" id="page-content">
    <div class="loading-full"><div class="spin"></div><span>Cargando sistema...</span></div>
  </main>
</div>

<!-- Modal container -->
<div id="modal-container"></div>
<!-- Toast -->
<div id="toast" class="toast"></div>

<script>
// ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
const S = {
  token: localStorage.getItem('token') || '',
  usuario: (() => { try { return JSON.parse(localStorage.getItem('usuario') || 'null') } catch { return null } })(),
  cajaHoy: null,
  currentPage: ''
};

// Helpers
const $ = id => document.getElementById(id);
const fmt = n => '$' + Number(n||0).toLocaleString('es-EC', {minimumFractionDigits:2, maximumFractionDigits:2});
const fmtN = n => Number(n||0).toLocaleString('es-EC', {minimumFractionDigits:2, maximumFractionDigits:2});
const esc = s => (s||'').replace(/'/g, "\\'").replace(/"/g, '&quot;');
const todayLocal = () => new Date().toLocaleDateString('es-EC', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
const todayISO = () => new Date().toISOString().split('T')[0];

function toast(msg, type='ok') {
  const t = $('toast');
  t.className = 'toast toast-' + type;
  t.innerHTML = '<i class="fas ' + (type==='ok'?'fa-circle-check':type==='err'?'fa-circle-xmark':type==='warn'?'fa-triangle-exclamation':'fa-circle-info') + '"></i><span>' + msg + '</span>';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3800);
}

async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.token } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { logout(); return null; }
    return { ok: res.ok, status: res.status, data };
  } catch(e) {
    toast('Error de conexión', 'err');
    return null;
  }
}

function closeModal() { $('modal-container').innerHTML = ''; }
function openModal(html) {
  $('modal-container').innerHTML = '<div class="modal-ov" onclick="if(event.target===this)closeModal()">' + html + '</div>';
}
function toggleSidebar() { $('sidebar').classList.toggle('open'); $('sb-overlay').classList.toggle('open'); }
function closeSidebar() { $('sidebar').classList.remove('open'); $('sb-overlay').classList.remove('open'); }

// ─── AUTH + INIT ──────────────────────────────────────────────────────────────
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer '+S.token } }).catch(()=>{});
  localStorage.clear(); window.location.href = '/login';
}

function getRolLabel(rol) {
  if (rol === 'superadmin') return '<i class="fas fa-crown role-crown mr-1"></i>Superadmin';
  if (rol === 'supervisor') return '<i class="fas fa-eye role-eye mr-1"></i>Supervisor';
  return '<i class="fas fa-briefcase role-work mr-1"></i>Trabajador';
}

function isSuperadmin() { return S.usuario?.rol === 'superadmin'; }
function isSupervisorOrAdmin() { return ['superadmin','supervisor'].includes(S.usuario?.rol); }
function canEdit() { return ['superadmin','trabajador','supervisor'].includes(S.usuario?.rol); }

async function initApp() {
  if (!S.token || !S.usuario) { window.location.href = '/login'; return; }

  // Verificar token
  const r = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + S.token } });
  if (!r.ok) { window.location.href = '/login'; return; }
  const me = await r.json();
  S.usuario = me;
  localStorage.setItem('usuario', JSON.stringify(me));

  // Sidebar usuario
  const ini = (me.nombre[0] + (me.apellido[0]||'')).toUpperCase();
  $('sb-initials').textContent = ini;
  $('sb-name').textContent = me.nombre + ' ' + me.apellido;
  $('sb-rol').innerHTML = getRolLabel(me.rol);
  $('tb-name').textContent = me.nombre + ' ' + me.apellido;
  $('tb-fecha').textContent = new Date().toLocaleDateString('es-EC', {day:'numeric',month:'short',year:'numeric'});

  // Colores avatar por rol
  if (me.rol === 'superadmin') $('sb-avatar').style.background = '#B45309';
  else if (me.rol === 'supervisor') $('sb-avatar').style.background = '#6D28D9';
  else $('sb-avatar').style.background = '#1148AD';

  // Navegación según rol
  if (isSupervisorOrAdmin()) {
    $('nav-sec-admin').classList.remove('hidden');
  }
  if (isSuperadmin()) {
    $('nav-sec-super').classList.remove('hidden');
  }
  // Supervisor puede operar caja igual que trabajador

  // Cargar alertas badge
  loadAlertBadge();

  // Página inicial según rol
  if (isSuperadmin() || me.rol === 'supervisor') showPage('admin-dashboard');
  else showPage('dashboard');
}

async function loadAlertBadge() {
  const r = await api('GET', '/api/alertas');
  if (!r?.ok) return;
  const total = r.data.total || 0;
  const b = $('badge-alertas');
  if (total > 0) { b.textContent = total; b.classList.remove('hidden'); }
  else b.classList.add('hidden');
}

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  'dashboard':         ['Mi Dashboard',        'Resumen de tu día de trabajo'],
  'caja':              ['Mi Caja de Hoy',       todayLocal()],
  'movimientos':       ['Registrar Movimiento', 'Ingresos y egresos del día'],
  'pendientes':        ['Mis Pendientes / Por Pagar', 'Deudas de clientes a tu cargo'],
  'historial':         ['Historial de Cajas',   'Tus cajas anteriores'],
  'alertas':           ['Alertas del Sistema',  'Notificaciones importantes'],
  'admin-dashboard':   ['Panel General',        'Vista consolidada de todas las operaciones'],
  'admin-cajas':       ['Todas las Cajas',      'Cajas de todos los trabajadores'],
  'admin-reportes':    ['Reportes Financieros', 'Análisis y estadísticas'],
  'admin-pendientes':  ['Pendientes Globales',  'Todas las cuentas por cobrar'],
  'admin-auditoria':   ['Auditoría',            'Registro de actividad del sistema'],
  'admin-usuarios':    ['Gestión de Usuarios',  'Crear, editar y administrar usuarios'],
  'admin-config':      ['Configuración',        'Parámetros del sistema'],
  'cuadre':            ['Cuadre Bancario Excel', 'Sube tu hoja de cierre diario'],
};

function showPage(page) {
  S.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = $('nav-' + page);
  if (navEl) navEl.classList.add('active');
  closeSidebar();
  const [title, sub] = PAGE_TITLES[page] || [page, ''];
  $('page-title').textContent = title;
  $('page-sub').textContent = sub;
  const pages = {
    'dashboard': renderDashboard,
    'caja': renderCaja,
    'movimientos': renderMovimientos,
    'pendientes': renderPendientes,
    'historial': renderHistorial,
    'alertas': renderAlertas,
    'cuadre': renderCuadreExcel,
    'admin-dashboard': renderAdminDashboard,
    'admin-cajas': renderAdminCajas,
    'admin-reportes': renderAdminReportes,
    'admin-pendientes': renderAdminPendientes,
    'admin-auditoria': renderAdminAuditoria,
    'admin-usuarios': renderAdminUsuarios,
    'admin-config': renderAdminConfig,
  };
  if (pages[page]) pages[page]();
  else $('page-content').innerHTML = '<div class="empty-st"><i class="fas fa-tools"></i><p>Página en construcción</p></div>';
}

// ─── DASHBOARD TRABAJADOR ─────────────────────────────────────────────────────
async function renderDashboard() {
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div><span>Cargando...</span></div>';
  const [cajaR, alertasR, movR] = await Promise.all([
    api('GET', '/api/cajas/hoy'),
    api('GET', '/api/alertas'),
    api('GET', '/api/movimientos?limit=5&caja_hoy=1'),
  ]);
  const caja = cajaR?.data?.caja || cajaR?.data || {};
  S.cajaHoy = caja;
  const al = alertasR?.data || {};
  const movs = movR?.data?.movimientos || [];

  const estadoBadge = caja.estado === 'abierta' ? '<span class="badge badge-ok">Abierta</span>'
    : caja.estado === 'cuadrada' ? '<span class="badge badge-blue">Cuadrada</span>'
    : caja.estado === 'aprobada' ? '<span class="badge badge-ok">Aprobada ✓</span>'
    : '<span class="badge badge-warn">Observada</span>';

  $('page-content').innerHTML = \`
  <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2">
        <span class="text-gray-500 text-sm font-medium">Saldo Inicial</span>
        <div class="icon-box" style="background:#DBEAFE"><i class="fas fa-wallet text-blue-600"></i></div>
      </div>
      <div class="text-2xl font-black text-gray-800">\${fmt(caja.saldo_inicial)}</div>
      <div class="text-xs text-gray-400 mt-1">Caja del día</div>
    </div>
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2">
        <span class="text-gray-500 text-sm font-medium">Ingresos Hoy</span>
        <div class="icon-box" style="background:#D1FAE5"><i class="fas fa-arrow-trend-up text-green-600"></i></div>
      </div>
      <div class="text-2xl font-black text-green-600">\${fmt(caja.total_ingresos)}</div>
    </div>
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2">
        <span class="text-gray-500 text-sm font-medium">Egresos Hoy</span>
        <div class="icon-box" style="background:#FEE2E2"><i class="fas fa-arrow-trend-down text-red-500"></i></div>
      </div>
      <div class="text-2xl font-black text-red-500">\${fmt(caja.total_egresos)}</div>
    </div>
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2">
        <span class="text-gray-500 text-sm font-medium">Saldo Actual</span>
        <div class="icon-box" style="background:#FEF3C7"><i class="fas fa-coins text-yellow-600"></i></div>
      </div>
      <div class="text-2xl font-black text-gray-800">\${fmt((caja.saldo_inicial||0)+(caja.total_ingresos||0)-(caja.total_egresos||0))}</div>
    </div>
  </div>

  \${al.total > 0 ? \`<div class="alert-box alert-warn mt-4"><i class="fas fa-triangle-exclamation"></i><span><strong>\${al.total} alerta(s):</strong> \${al.vencidos?.length||0} pendientes vencidos, \${al.proximos_vencer?.length||0} próximos a vencer. <button onclick="showPage('alertas')" class="underline font-semibold ml-1">Ver alertas</button></span></div>\` : ''}

  <div class="grid gap-4 mt-4" style="grid-template-columns:1fr 1fr">
    <div class="card">
      <div class="card-hd">
        <span class="font-bold text-gray-700">Estado de tu Caja</span>
        \${estadoBadge}
      </div>
      <div class="card-bd">
        <div class="flex gap-2 flex-wrap">
          \${caja.estado === 'abierta' ? \`
          <button onclick="showPage('movimientos')" class="btn btn-success btn-sm"><i class="fas fa-plus"></i> Nuevo Movimiento</button>
          <button onclick="showPage('caja')" class="btn btn-gold btn-sm"><i class="fas fa-calculator"></i> Cuadrar Caja</button>
          \` : \`<button onclick="showPage('caja')" class="btn btn-primary btn-sm"><i class="fas fa-eye"></i> Ver Detalles</button>\`}
        </div>
        \${caja.observaciones ? \`<div class="alert-box alert-warn mt-3"><i class="fas fa-comment-dots"></i><span>\${caja.observaciones}</span></div>\` : ''}
      </div>
    </div>
    <div class="card">
      <div class="card-hd"><span class="font-bold text-gray-700">Movimientos Recientes</span></div>
      <div class="card-bd" style="padding-top:8px">
        \${movs.length === 0 ? '<div class="empty-st" style="padding:20px"><i class="fas fa-inbox"></i><p style="font-size:13px">Sin movimientos hoy</p></div>' :
          movs.map(m => \`<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div><div class="text-sm font-medium text-gray-700">\${m.descripcion}</div><div class="text-xs text-gray-400">\${m.categoria}</div></div>
            <span class="font-bold text-sm \${m.tipo==='ingreso'?'text-green-600':'text-red-500'}">\${m.tipo==='ingreso'?'+':'-'}\${fmt(m.monto)}</span>
          </div>\`).join('')}
      </div>
    </div>
  </div>\`;
}

// ─── CAJA HOY ─────────────────────────────────────────────────────────────────
async function renderCaja() {
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div><span>Cargando caja...</span></div>';
  const r = await api('GET', '/api/cajas/hoy');
  if (!r) return;
  const caja = r.data?.caja || r.data || {};
  S.cajaHoy = caja;

  const saldoActual = (caja.saldo_inicial||0) + (caja.total_ingresos||0) - (caja.total_egresos||0);
  const estadoBadge = {
    'abierta': '<span class="badge badge-ok">Abierta</span>',
    'cuadrada': '<span class="badge badge-blue">Cuadrada</span>',
    'aprobada': '<span class="badge badge-ok">✓ Aprobada</span>',
    'observada': '<span class="badge badge-warn">Observada</span>',
  }[caja.estado] || '';

  // Obtener movimientos de esta caja
  const movR = await api('GET', '/api/movimientos?caja_id=' + caja.id);
  const movs = movR?.data?.movimientos || [];

  $('page-content').innerHTML = \`
  <div class="grid gap-4 mb-4" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
    <div class="saldo-box">
      <div class="text-blue-200 text-sm font-medium mb-1">Saldo Inicial</div>
      <div class="text-3xl font-black">\${fmt(caja.saldo_inicial)}</div>
      <div class="text-blue-200 text-xs mt-2">Fecha: \${caja.fecha}</div>
    </div>
    <div class="stat-card" style="border-left:4px solid #10B981">
      <div class="text-gray-500 text-sm mb-1">Ingresos</div>
      <div class="text-2xl font-black text-green-600">\${fmt(caja.total_ingresos)}</div>
    </div>
    <div class="stat-card" style="border-left:4px solid #EF4444">
      <div class="text-gray-500 text-sm mb-1">Egresos</div>
      <div class="text-2xl font-black text-red-500">\${fmt(caja.total_egresos)}</div>
    </div>
    <div class="stat-card" style="border-left:4px solid #F5A400">
      <div class="text-gray-500 text-sm mb-1">Saldo Actual</div>
      <div class="text-2xl font-black text-gray-800">\${fmt(saldoActual)}</div>
    </div>
  </div>

  <div class="card mb-4">
    <div class="card-hd">
      <div class="flex items-center gap-2"><span class="font-bold text-gray-700">Estado de Caja</span>\${estadoBadge}</div>
      <div class="flex gap-2">
        \${caja.estado === 'abierta' ? \`
        <button onclick="showPage('movimientos')" class="btn btn-success btn-sm"><i class="fas fa-plus"></i> Movimiento</button>
        <button onclick="openCuadreModal(\${caja.id}, \${saldoActual})" class="btn btn-gold btn-sm"><i class="fas fa-calculator"></i> Cuadrar</button>
        \` : \`<span class="text-gray-400 text-sm">Caja \${caja.estado}</span>\`}
      </div>
    </div>
    \${caja.observaciones ? \`<div class="card-bd"><div class="alert-box alert-warn"><i class="fas fa-comment-dots"></i><span>\${caja.observaciones}</span></div></div>\` : ''}
  </div>

  <div class="card">
    <div class="card-hd">
      <span class="font-bold text-gray-700">Movimientos del Día (\${movs.length})</span>
      <button onclick="showPage('movimientos')" class="btn btn-outline btn-sm"><i class="fas fa-plus"></i> Agregar</button>
    </div>
    <div style="overflow-x:auto">
      \${movs.length === 0 ? '<div class="empty-st"><i class="fas fa-inbox"></i><p>No hay movimientos registrados hoy</p></div>' : \`
      <table class="tbl">
        <thead><tr><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Referencia</th><th>Monto</th><th>Hora</th>\${caja.estado==='abierta'?'<th></th>':''}</tr></thead>
        <tbody>\${movs.map(m => \`<tr class="\${m.tipo==='ingreso'?'ing-row':'eg-row'}">
          <td>\${m.tipo==='ingreso'?'<span class="badge badge-ok">Ingreso</span>':'<span class="badge badge-err">Egreso</span>'}</td>
          <td>\${m.categoria}</td>
          <td class="font-medium">\${m.descripcion}</td>
          <td class="text-gray-400 text-xs">\${m.referencia||'-'}</td>
          <td class="font-bold \${m.tipo==='ingreso'?'text-green-600':'text-red-500'}">\${m.tipo==='ingreso'?'+':'-'}\${fmt(m.monto)}</td>
          <td class="text-gray-400 text-xs">\${new Date(m.created_at).toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit'})}</td>
          \${caja.estado==='abierta'?'<td><button onclick="delMovimiento('+m.id+')" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i></button></td>':''}
        </tr>\`).join('')}</tbody>
      </table>\`}
    </div>
  </div>\`;
}

function openCuadreModal(cajaId, saldoSistema) {
  openModal(\`<div class="modal">
    <div class="modal-hd">
      <h3 class="font-bold text-gray-800 text-lg"><i class="fas fa-calculator mr-2 text-yellow-500"></i>Cuadre de Caja</h3>
      <button onclick="closeModal()" class="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
    </div>
    <div class="modal-bd space-y-4">
      <div class="alert-box alert-info"><i class="fas fa-info-circle"></i><span>Saldo según sistema: <strong>\${fmt(saldoSistema)}</strong>. Ingresa el efectivo físico que tienes.</span></div>
      <div>
        <label class="lbl">Efectivo Físico Contado <span class="text-red-500">*</span></label>
        <input id="cu-fisico" type="number" step="0.01" min="0" placeholder="0.00" class="inp" oninput="calcDiferencia(\${saldoSistema})">
      </div>
      <div id="cu-diff" class="hidden"></div>
      <div>
        <label class="lbl">Observaciones</label>
        <textarea id="cu-obs" rows="2" class="inp" placeholder="Observaciones del cuadre..."></textarea>
      </div>
    </div>
    <div class="modal-ft">
      <button onclick="closeModal()" class="btn btn-outline">Cancelar</button>
      <button onclick="doCuadre(\${cajaId}, \${saldoSistema})" class="btn btn-gold"><i class="fas fa-check"></i> Confirmar Cuadre</button>
    </div>
  </div>\`);
}

function calcDiferencia(saldoSistema) {
  const fisico = parseFloat($('cu-fisico').value) || 0;
  const diff = fisico - saldoSistema;
  const div = $('cu-diff');
  div.className = 'alert-box ' + (Math.abs(diff) <= 5 ? 'alert-ok' : diff > 0 ? 'alert-info' : 'alert-danger');
  div.innerHTML = \`<i class="fas fa-\${Math.abs(diff)<=5?'check-circle':diff>0?'arrow-up':'arrow-down'}"></i><span>Diferencia: <strong>\${diff>=0?'+':''}\${fmt(diff)}</strong> \${Math.abs(diff)<=5?'✓ Cuadre correcto':diff>0?'Sobrante':'Faltante'}</span>\`;
  div.classList.remove('hidden');
}

async function doCuadre(cajaId, saldoSistema) {
  const fisico = parseFloat($('cu-fisico').value);
  if (isNaN(fisico) || fisico < 0) { toast('Ingresa el monto físico contado', 'warn'); return; }
  const obs = $('cu-obs').value;
  const r = await api('POST', '/api/cajas/' + cajaId + '/cuadre', { saldo_fisico_real: fisico, observaciones: obs });
  if (!r) return;
  if (r.ok) { toast('Caja cuadrada correctamente ✓', 'ok'); closeModal(); renderCaja(); }
  else toast(r.data.error || 'Error al cuadrar', 'err');
}

async function delMovimiento(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  const r = await api('DELETE', '/api/movimientos/' + id);
  if (r?.ok) { toast('Movimiento eliminado', 'ok'); renderCaja(); }
  else toast(r?.data?.error || 'Error', 'err');
}

// ─── MOVIMIENTOS ──────────────────────────────────────────────────────────────
async function renderMovimientos() {
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div><span>Cargando...</span></div>';

  const [cajaR, catR] = await Promise.all([
    api('GET', '/api/cajas/hoy'),
    api('GET', '/api/movimientos/categorias'),
  ]);
  const caja = cajaR?.data?.caja || cajaR?.data || {};
  S.cajaHoy = caja;
  const cats = catR?.data?.categorias || [];
  const catsIngreso = cats.filter(c => c.tipo === 'ingreso');
  const catsEgreso = cats.filter(c => c.tipo === 'egreso');

  if (caja.estado !== 'abierta') {
    $('page-content').innerHTML = \`<div class="card"><div class="card-bd"><div class="alert-box alert-warn"><i class="fas fa-lock"></i><span>Tu caja está <strong>\${caja.estado}</strong>. No se pueden registrar movimientos.</span></div></div></div>\`;
    return;
  }

  $('page-content').innerHTML = \`
  <div class="grid gap-4" style="grid-template-columns:1fr 1fr">
    <!-- INGRESO -->
    <div class="card" style="border-top:4px solid #10B981">
      <div class="card-hd" style="background:#F0FDF4">
        <span class="font-bold text-green-700"><i class="fas fa-plus-circle mr-2"></i>Registrar Ingreso</span>
      </div>
      <div class="card-bd space-y-3" id="form-ingreso">
        <div><label class="lbl">Categoría</label>
          <select id="ing-cat" class="inp inp-select">
            \${catsIngreso.map(c=>\`<option value="\${c.nombre}">\${c.nombre}</option>\`).join('')}
          </select>
        </div>
        <div><label class="lbl">Descripción</label><input id="ing-desc" type="text" class="inp" placeholder="Detalle del ingreso..."></div>
        <div><label class="lbl">Monto</label><input id="ing-monto" type="number" step="0.01" min="0.01" class="inp" placeholder="0.00"></div>
        <div><label class="lbl">Referencia (opcional)</label><input id="ing-ref" type="text" class="inp" placeholder="N° comprobante, transferencia..."></div>
        <button onclick="registrarMovimiento('ingreso')" class="btn btn-success w-full justify-center">
          <i class="fas fa-plus"></i> Registrar Ingreso
        </button>
      </div>
    </div>
    <!-- EGRESO -->
    <div class="card" style="border-top:4px solid #EF4444">
      <div class="card-hd" style="background:#FFF5F5">
        <span class="font-bold text-red-600"><i class="fas fa-minus-circle mr-2"></i>Registrar Egreso</span>
      </div>
      <div class="card-bd space-y-3">
        <div><label class="lbl">Categoría</label>
          <select id="eg-cat" class="inp inp-select">
            \${catsEgreso.map(c=>\`<option value="\${c.nombre}">\${c.nombre}</option>\`).join('')}
          </select>
        </div>
        <div><label class="lbl">Descripción</label><input id="eg-desc" type="text" class="inp" placeholder="Detalle del egreso..."></div>
        <div><label class="lbl">Monto</label><input id="eg-monto" type="number" step="0.01" min="0.01" class="inp" placeholder="0.00"></div>
        <div><label class="lbl">Referencia (opcional)</label><input id="eg-ref" type="text" class="inp" placeholder="N° comprobante, factura..."></div>
        <button onclick="registrarMovimiento('egreso')" class="btn btn-danger w-full justify-center">
          <i class="fas fa-minus"></i> Registrar Egreso
        </button>
      </div>
    </div>
  </div>
  <div class="mt-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-gray-700">Movimientos de Hoy</h3>
      <span class="badge badge-blue" id="mov-count">Cargando...</span>
    </div>
    <div id="movs-lista"></div>
  </div>\`;

  loadMovsHoy(caja.id);
}

async function loadMovsHoy(cajaId) {
  const r = await api('GET', '/api/movimientos?caja_id=' + cajaId);
  const movs = r?.data?.movimientos || [];
  $('mov-count').textContent = movs.length + ' movimientos';
  $('movs-lista').innerHTML = movs.length === 0 ? '<div class="empty-st"><i class="fas fa-inbox"></i><p>Sin movimientos aún</p></div>' :
    '<div class="card"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Referencia</th><th>Monto</th><th>Hora</th><th></th></tr></thead><tbody>' +
    movs.map(m => \`<tr class="\${m.tipo==='ingreso'?'ing-row':'eg-row'}">
      <td>\${m.tipo==='ingreso'?'<span class="badge badge-ok">Ingreso</span>':'<span class="badge badge-err">Egreso</span>'}</td>
      <td>\${m.categoria}</td><td class="font-medium">\${m.descripcion}</td>
      <td class="text-xs text-gray-400">\${m.referencia||'-'}</td>
      <td class="font-bold \${m.tipo==='ingreso'?'text-green-600':'text-red-500'}">\${m.tipo==='ingreso'?'+':'-'}\${fmt(m.monto)}</td>
      <td class="text-xs text-gray-400">\${new Date(m.created_at).toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit'})}</td>
      <td><button onclick="delMovimientoMov(\${m.id})" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i></button></td>
    </tr>\`).join('') + '</tbody></table></div></div>';
}

async function registrarMovimiento(tipo) {
  if (!S.cajaHoy?.id) { toast('No hay caja abierta', 'warn'); return; }
  const pre = tipo === 'ingreso' ? 'ing' : 'eg';
  const cat = $(pre + '-cat').value;
  const desc = $(pre + '-desc').value.trim();
  const monto = parseFloat($(pre + '-monto').value);
  const ref = $(pre + '-ref').value.trim();
  if (!cat || !desc) { toast('Completa categoría y descripción', 'warn'); return; }
  if (!monto || monto <= 0) { toast('Ingresa un monto válido mayor a 0', 'warn'); return; }
  const r = await api('POST', '/api/movimientos', { caja_id: S.cajaHoy.id, tipo, categoria: cat, descripcion: desc, monto, referencia: ref || null });
  if (!r) return;
  if (r.ok) {
    toast(tipo === 'ingreso' ? '✓ Ingreso registrado' : '✓ Egreso registrado', 'ok');
    $(pre + '-desc').value = ''; $(pre + '-monto').value = ''; $(pre + '-ref').value = '';
    loadMovsHoy(S.cajaHoy.id);
  } else toast(r.data.error || 'Error', 'err');
}

async function delMovimientoMov(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  const r = await api('DELETE', '/api/movimientos/' + id);
  if (r?.ok) { toast('Movimiento eliminado', 'ok'); loadMovsHoy(S.cajaHoy.id); }
  else toast(r?.data?.error || 'Error', 'err');
}

// ─── PENDIENTES ───────────────────────────────────────────────────────────────
async function renderPendientes() {
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div><span>Cargando pendientes...</span></div>';
  const r = await api('GET', '/api/pendientes');
  const pends = r?.data?.pendientes || [];

  const estadoB = { pendiente:'badge-warn', parcial:'badge-info', pagado:'badge-ok', vencido:'badge-err', incobrable:'badge-gray' };
  const prioB = { urgente:'badge-err', alta:'badge-warn', normal:'badge-blue', baja:'badge-gray' };

  $('page-content').innerHTML = \`
  <div class="flex justify-between items-center mb-4">
    <div></div>
    <button onclick="openNuevoPendiente()" class="btn btn-primary"><i class="fas fa-plus"></i> Nuevo Pendiente</button>
  </div>
  <div class="card">
    <div class="card-hd"><span class="font-bold text-gray-700">Por Pagar / Pendientes (\${pends.length})</span></div>
    <div style="overflow-x:auto">
      \${pends.length === 0 ? '<div class="empty-st"><i class="fas fa-check-circle"></i><p>No tienes pendientes registrados</p></div>' : \`
      <table class="tbl">
        <thead><tr><th>Cliente</th><th>Descripción</th><th>Total</th><th>Abonado</th><th>Por cobrar</th><th>Progreso</th><th>Vencimiento</th><th>Estado</th><th></th></tr></thead>
        <tbody>\${pends.map(p => {
          const pct = p.monto_total > 0 ? Math.round((p.monto_pagado / p.monto_total) * 100) : 0;
          const venc = p.fecha_vencimiento && p.fecha_vencimiento < todayISO() && p.estado !== 'pagado';
          return \`<tr class="pr-\${p.prioridad}">
          <td><div class="font-medium">\${p.cliente_nombre}</div><div class="text-xs text-gray-400">\${p.cliente_cedula?'CI: '+p.cliente_cedula:''}\${p.cliente_telefono?' · '+p.cliente_telefono:''}</div></td>
          <td><div class="text-sm">\${p.descripcion}</div>\${p.notas?\`<div class="text-xs text-gray-400 italic">\${p.notas}</div>\`:''}</td>
          <td class="font-semibold">\${fmt(p.monto_total)}</td>
          <td class="text-green-600 font-semibold">\${fmt(p.monto_pagado)}</td>
          <td class="text-red-500 font-bold text-base">\${fmt(p.monto_pendiente)}</td>
          <td style="min-width:90px">
            <div style="background:#e5e7eb;border-radius:6px;height:8px;overflow:hidden">
              <div style="background:\${pct>=100?'#10b981':pct>50?'#3b82f6':'#f59e0b'};width:\${pct}%;height:100%;border-radius:6px;transition:width 0.4s"></div>
            </div>
            <div class="text-xs text-center mt-1 text-gray-500">\${pct}%</div>
          </td>
          <td class="\${venc?'text-red-500 font-bold':'text-gray-500'} text-sm">\${p.fecha_vencimiento||'Sin fecha'}\${venc?' <i class="fas fa-exclamation-triangle text-xs"></i>':''}</td>
          <td><span class="badge \${estadoB[p.estado]||'badge-gray'}">\${p.estado}</span></td>
          <td><div class="flex gap-1">
            \${p.estado !== 'pagado' && p.estado !== 'incobrable' ? \`<button onclick="openAbono(\${p.id},'\${esc(p.cliente_nombre)}',\${p.monto_pendiente})" class="btn btn-success btn-sm" title="Registrar abono"><i class="fas fa-dollar-sign"></i></button>\` : ''}
            <button onclick="verPendiente(\${p.id})" class="btn btn-outline btn-sm" title="Ver historial"><i class="fas fa-eye"></i></button>
          </div></td>
        </tr>\`}).join('')}</tbody>
      </table>\`}
    </div>
  </div>\`;
}

function openNuevoPendiente() {
  const hoy = todayISO();
  openModal(\`<div class="modal">
    <div class="modal-hd"><h3 class="font-bold text-gray-800"><i class="fas fa-plus mr-2 text-blue-600"></i>Nuevo Pendiente</h3><button onclick="closeModal()" class="text-gray-400 hover:text-gray-700 text-xl">&times;</button></div>
    <div class="modal-bd space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="lbl">Nombre Cliente *</label><input id="np-cnom" type="text" class="inp" placeholder="Nombre completo"></div>
        <div><label class="lbl">Cédula (opcional)</label><input id="np-cced" type="text" class="inp" placeholder="Cédula"></div>
      </div>
      <div><label class="lbl">Teléfono (opcional)</label><input id="np-ctel" type="text" class="inp" placeholder="Teléfono"></div>
      <div><label class="lbl">Descripción *</label><input id="np-desc" type="text" class="inp" placeholder="Descripción de la deuda"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="lbl">Monto Total *</label><input id="np-monto" type="number" step="0.01" min="0.01" class="inp" placeholder="0.00"></div>
        <div><label class="lbl">Prioridad</label>
          <select id="np-prio" class="inp inp-select"><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option><option value="baja">Baja</option></select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="lbl">Fecha Deuda *</label><input id="np-fdeuda" type="date" class="inp" value="\${hoy}"></div>
        <div><label class="lbl">Fecha Vencimiento</label><input id="np-fvenc" type="date" class="inp"></div>
      </div>
      <div><label class="lbl">Notas</label><textarea id="np-notas" rows="2" class="inp" placeholder="Notas adicionales..."></textarea></div>
    </div>
    <div class="modal-ft"><button onclick="closeModal()" class="btn btn-outline">Cancelar</button><button onclick="guardarPendiente()" class="btn btn-primary"><i class="fas fa-save"></i> Guardar</button></div>
  </div>\`);
}

async function guardarPendiente() {
  const body = {
    cliente_nombre: $('np-cnom').value.trim(),
    cliente_cedula: $('np-cced').value.trim() || null,
    cliente_telefono: $('np-ctel').value.trim() || null,
    descripcion: $('np-desc').value.trim(),
    monto_total: parseFloat($('np-monto').value),
    prioridad: $('np-prio').value,
    fecha_deuda: $('np-fdeuda').value,
    fecha_vencimiento: $('np-fvenc').value || null,
    notas: $('np-notas').value.trim() || null,
  };
  if (!body.cliente_nombre || !body.descripcion) { toast('Completa los campos requeridos', 'warn'); return; }
  if (!body.monto_total || body.monto_total <= 0) { toast('Ingresa un monto válido', 'warn'); return; }
  const r = await api('POST', '/api/pendientes', body);
  if (r?.ok) { toast('Pendiente creado ✓', 'ok'); closeModal(); renderPendientes(); }
  else toast(r?.data?.error || 'Error', 'err');
}

async function openAbono(id, nombre, montoPend) {
  const cajaR = await api('GET', '/api/cajas/hoy');
  const cajaId = cajaR?.data?.caja?.id || cajaR?.data?.id;
  const cajaEstado = cajaR?.data?.caja?.estado || cajaR?.data?.estado;
  if (!cajaId || cajaEstado !== 'abierta') {
    toast('Necesitas una caja abierta para registrar un abono', 'warn'); return;
  }
  openModal(\`<div class="modal">
    <div class="modal-hd"><h3 class="font-bold text-gray-800"><i class="fas fa-dollar-sign mr-2 text-green-600"></i>Registrar Abono</h3><button onclick="closeModal()" class="text-xl text-gray-400 hover:text-gray-700">&times;</button></div>
    <div class="modal-bd space-y-3">
      <div class="alert-box alert-info"><i class="fas fa-user"></i><span>Cliente: <strong>\${nombre}</strong> · Pendiente: <strong>\${fmt(montoPend)}</strong></span></div>
      <div><label class="lbl">Monto del Abono *</label><input id="ab-monto" type="number" step="0.01" min="0.01" max="\${montoPend}" class="inp" placeholder="0.00"></div>
      <div><label class="lbl">Notas</label><input id="ab-notas" type="text" class="inp" placeholder="Referencia del pago..."></div>
    </div>
    <div class="modal-ft"><button onclick="closeModal()" class="btn btn-outline">Cancelar</button><button onclick="guardarAbono(\${id}, \${cajaId})" class="btn btn-success"><i class="fas fa-check"></i> Registrar Abono</button></div>
  </div>\`);
}

async function guardarAbono(pendId, cajaId) {
  const monto = parseFloat($('ab-monto').value);
  if (!monto || monto <= 0) { toast('Ingresa un monto válido', 'warn'); return; }
  const notas = $('ab-notas').value.trim() || null;
  // Usar el endpoint correcto de pagar pendiente
  const r = await api('POST', '/api/pendientes/' + pendId + '/pagar', {
    monto,
    caja_id: cajaId,
    observaciones: notas,
  });
  if (r?.ok) {
    if (r.data?.eliminado) {
      toast('✅ Pago total registrado — pendiente eliminado', 'ok');
    } else {
      const nuevo = r.data?.nuevo_estado || 'parcial';
      const pagado = r.data?.pago_registrado || monto;
      toast('Abono de ' + fmt(pagado) + ' registrado ✓ — Estado: ' + nuevo, 'ok');
    }
    closeModal();
    renderPendientes();
  } else toast(r?.data?.error || 'Error al registrar abono', 'err');
}

async function verPendiente(id) {
  const r = await api('GET', '/api/pendientes/' + id);
  if (!r?.ok) { toast('Error al cargar', 'err'); return; }
  const p = r.data;
  const estadoB = { pendiente:'badge-warn', parcial:'badge-info', pagado:'badge-ok', vencido:'badge-err', incobrable:'badge-gray' };
  openModal(\`<div class="modal">
    <div class="modal-hd"><h3 class="font-bold text-gray-800">Detalle Pendiente</h3><button onclick="closeModal()" class="text-xl text-gray-400">&times;</button></div>
    <div class="modal-bd space-y-3">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div><span class="text-gray-400">Cliente</span><p class="font-semibold">\${p.cliente_nombre}</p></div>
        <div><span class="text-gray-400">Estado</span><p><span class="badge \${estadoB[p.estado]}">\${p.estado}</span></p></div>
        <div><span class="text-gray-400">Monto Total</span><p class="font-bold text-lg">\${fmt(p.monto_total)}</p></div>
        <div><span class="text-gray-400">Por Cobrar</span><p class="font-bold text-lg text-red-500">\${fmt(p.monto_pendiente)}</p></div>
        <div><span class="text-gray-400">Pagado</span><p class="font-bold text-green-600">\${fmt(p.monto_pagado)}</p></div>
        <div><span class="text-gray-400">Vencimiento</span><p>\${p.fecha_vencimiento||'Sin fecha'}</p></div>
      </div>
      <div><span class="text-gray-400 text-sm">Descripción</span><p class="text-sm font-medium mt-1">\${p.descripcion}</p></div>
      \${p.notas ? \`<div><span class="text-gray-400 text-sm">Notas</span><p class="text-sm mt-1">\${p.notas}</p></div>\` : ''}
      \${p.abonos && p.abonos.length > 0 ? \`<div>
        <span class="text-gray-400 text-sm font-semibold">Historial de Abonos (\${p.abonos.length})</span>
        <table class="tbl mt-2"><thead><tr><th>Fecha</th><th>Abono</th><th>Saldo restante</th><th>Notas</th></tr></thead><tbody>
        \${(() => { let saldo = p.monto_total; return p.abonos.map(a=>{ saldo -= a.monto; return \`<tr><td class="text-xs">\${new Date(a.created_at).toLocaleDateString('es-EC')}</td><td class="font-bold text-green-600">- \${fmt(a.monto)}</td><td class="\${saldo<=0?'text-green-600 font-bold':'text-red-500 font-bold'}">\${saldo<=0?'\u2705 Pagado':fmt(Math.max(0,saldo))}</td><td class="text-xs text-gray-400">\${a.notas||'-'}</td></tr>\`}).join('')})()}
        </tbody></table>
      </div>\` : '<div class="text-xs text-gray-400 italic">Sin abonos registrados aún</div>'}
    </div>
    <div class="modal-ft"><button onclick="closeModal()" class="btn btn-outline">Cerrar</button></div>
  </div>\`);
}

// ─── HISTORIAL ────────────────────────────────────────────────────────────────
async function renderHistorial() {
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div><span>Cargando...</span></div>';
  const r = await api('GET', '/api/cajas');
  const cajas = r?.data?.cajas || [];
  const estadoBadge = e => ({ abierta:'<span class="badge badge-ok">Abierta</span>', cuadrada:'<span class="badge badge-blue">Cuadrada</span>', aprobada:'<span class="badge badge-ok">Aprobada</span>', observada:'<span class="badge badge-warn">Observada</span>' }[e] || e);
  $('page-content').innerHTML = \`<div class="card">
    <div class="card-hd"><span class="font-bold text-gray-700">Mis Cajas (\${cajas.length})</span></div>
    <div style="overflow-x:auto">
      \${cajas.length === 0 ? '<div class="empty-st"><i class="fas fa-calendar-xmark"></i><p>No hay cajas anteriores</p></div>' : \`
      <table class="tbl"><thead><tr><th>Fecha</th><th>Saldo Inicial</th><th>Ingresos</th><th>Egresos</th><th>Saldo Final</th><th>Diferencia</th><th>Estado</th></tr></thead>
      <tbody>\${cajas.map(c=>\`<tr>
        <td class="font-medium">\${c.fecha}</td>
        <td>\${fmt(c.saldo_inicial)}</td>
        <td class="text-green-600 font-semibold">\${fmt(c.total_ingresos)}</td>
        <td class="text-red-500 font-semibold">\${fmt(c.total_egresos)}</td>
        <td class="font-bold">\${c.saldo_final != null ? fmt(c.saldo_final) : '-'}</td>
        <td class="\${c.diferencia != null && Math.abs(c.diferencia)>5?'text-red-500 font-bold':c.diferencia!=null?'text-green-600 font-semibold':''}">
          \${c.diferencia != null ? (c.diferencia >= 0 ? '+' : '') + fmt(c.diferencia) : '-'}
        </td>
        <td>\${estadoBadge(c.estado)}</td>
      </tr>\`).join('')}</tbody></table>\`}
    </div>
  </div>\`;
}

// ─── ALERTAS ──────────────────────────────────────────────────────────────────
async function renderAlertas() {
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div><span>Cargando alertas...</span></div>';
  const r = await api('GET', '/api/alertas');
  const al = r?.data || {};
  let html = '';
  if (al.vencidos?.length) {
    html += '<div class="card mb-4"><div class="card-hd" style="background:#FEE2E2"><span class="font-bold text-red-700"><i class="fas fa-fire mr-2"></i>VENCIDOS (' + al.vencidos.length + ')</span></div><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Cliente</th><th>Cédula</th><th>Descripción</th><th>Pendiente</th><th>Venció</th><th>Prioridad</th></tr></thead><tbody>' +
      al.vencidos.map(function(p) { return '<tr><td class="font-medium">' + p.cliente_nombre + '</td><td class="text-xs text-gray-400">' + (p.cliente_cedula||'-') + '</td><td class="text-sm">' + (p.descripcion||'-') + '</td><td class="text-red-600 font-bold">' + fmt(p.monto_pendiente) + '</td><td class="text-red-500">' + p.fecha_vencimiento + '</td><td><span class="badge badge-err">' + p.prioridad + '</span></td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }
  if (al.proximos_vencer?.length) {
    html += '<div class="card mb-4"><div class="card-hd" style="background:#FEF3C7"><span class="font-bold text-yellow-700"><i class="fas fa-clock mr-2"></i>PRÓXIMOS A VENCER (' + al.proximos_vencer.length + ')</span></div><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Cliente</th><th>Cédula</th><th>Descripción</th><th>Pendiente</th><th>Vence en</th></tr></thead><tbody>' +
      al.proximos_vencer.map(function(p) { return '<tr><td class="font-medium">' + p.cliente_nombre + '</td><td class="text-xs text-gray-400">' + (p.cliente_cedula||'-') + '</td><td class="text-sm">' + (p.descripcion||'-') + '</td><td class="text-yellow-600 font-bold">' + fmt(p.monto_pendiente) + '</td><td class="text-sm font-semibold">' + (p.dias_restantes <= 0 ? 'Hoy' : p.dias_restantes + ' días') + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }
  if (al.cajas_sin_cuadrar?.length) {
    html += '<div class="card mb-4"><div class="card-hd" style="background:#DBEAFE"><span class="font-bold text-blue-700"><i class="fas fa-cash-register mr-2"></i>CAJAS SIN CUADRAR (' + al.cajas_sin_cuadrar.length + ')</span></div><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Trabajador</th><th>Fecha</th><th>Días sin cuadrar</th></tr></thead><tbody>' +
      al.cajas_sin_cuadrar.map(function(c) { return '<tr><td class="font-medium">' + (c.nombre||'') + ' ' + (c.apellido||'') + '</td><td>' + c.fecha + '</td><td class="text-red-500 font-semibold">' + (Math.ceil((Date.now() - new Date(c.fecha+'T00:00:00').getTime()) / 86400000)) + ' días</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }
  if (al.alta_prioridad?.length) {
    html += '<div class="card mb-4"><div class="card-hd" style="background:#FEF3C7"><span class="font-bold text-orange-700"><i class="fas fa-exclamation-triangle mr-2"></i>ALTA PRIORIDAD (' + al.alta_prioridad.length + ')</span></div><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Cliente</th><th>Descripción</th><th>Pendiente</th><th>Prioridad</th></tr></thead><tbody>' +
      al.alta_prioridad.map(function(p) { return '<tr><td class="font-medium">' + p.cliente_nombre + '</td><td class="text-sm">' + (p.descripcion||'-') + '</td><td class="font-bold text-orange-600">' + fmt(p.monto_pendiente) + '</td><td><span class="badge badge-warn">' + p.prioridad + '</span></td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }
  if (!html) html = '<div class="empty-st"><i class="fas fa-check-circle text-green-400"></i><p>No hay alertas activas. ¡Todo en orden!</p></div>';
  $('page-content').innerHTML = html;
}

// ─── ADMIN: DASHBOARD GENERAL ─────────────────────────────────────────────────
async function renderAdminDashboard() {
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div><span>Cargando panel...</span></div>';
  const r = await api('GET', '/api/admin/dashboard');
  if (!r?.ok) { $('page-content').innerHTML = '<div class="empty-st"><i class="fas fa-triangle-exclamation"></i><p>Error cargando datos</p></div>'; return; }
  const d = r.data;
  const h = d.hoy || {}; const m = d.mes || {};

  $('page-content').innerHTML = \`
  <!-- Stats del día -->
  <div class="grid gap-4 mb-4 stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2"><span class="text-gray-500 text-sm">Ingresos Hoy</span><div class="icon-box" style="background:#D1FAE5"><i class="fas fa-arrow-up text-green-600"></i></div></div>
      <div class="text-2xl font-black text-green-600">\${fmt(h.total_ingresos_hoy)}</div>
      <div class="text-xs text-gray-400">\${h.total_movimientos_hoy||0} movimientos</div>
    </div>
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2"><span class="text-gray-500 text-sm">Egresos Hoy</span><div class="icon-box" style="background:#FEE2E2"><i class="fas fa-arrow-down text-red-500"></i></div></div>
      <div class="text-2xl font-black text-red-500">\${fmt(h.total_egresos_hoy)}</div>
    </div>
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2"><span class="text-gray-500 text-sm">Flujo Hoy</span><div class="icon-box" style="background:#DBEAFE"><i class="fas fa-scale-balanced text-blue-600"></i></div></div>
      <div class="text-2xl font-black \${(h.total_ingresos_hoy-h.total_egresos_hoy)>=0?'text-blue-600':'text-red-500'}">\${fmt(h.total_ingresos_hoy-h.total_egresos_hoy)}</div>
    </div>
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2"><span class="text-gray-500 text-sm">Cajas Activas</span><div class="icon-box" style="background:#FEF3C7"><i class="fas fa-cash-register text-yellow-600"></i></div></div>
      <div class="text-2xl font-black text-gray-800">\${h.cajas_abiertas||0}</div>
      <div class="text-xs text-gray-400">\${h.cajas_cuadradas||0} cuadradas · \${h.cajas_aprobadas||0} aprobadas</div>
    </div>
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2"><span class="text-gray-500 text-sm">Ingresos Mes</span><div class="icon-box" style="background:#EDE9FE"><i class="fas fa-calendar text-purple-600"></i></div></div>
      <div class="text-2xl font-black text-purple-600">\${fmt(m.total_ingresos_mes)}</div>
      <div class="text-xs text-gray-400">\${m.cajas_mes||0} cajas este mes</div>
    </div>
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2"><span class="text-gray-500 text-sm">Por Cobrar</span><div class="icon-box" style="background:#FEE2E2"><i class="fas fa-file-invoice-dollar text-red-500"></i></div></div>
      <div class="text-2xl font-black text-red-500">\${fmt(d.total_pendiente?.total)}</div>
      <div class="text-xs text-gray-400">\${d.total_pendiente?.cantidad||0} pendientes activos</div>
    </div>
  </div>

  <div class="grid gap-4 mb-4" style="grid-template-columns:1.4fr 1fr">
    <!-- Gráfico flujo -->
    <div class="card">
      <div class="card-hd"><span class="font-bold text-gray-700">Flujo Últimos 7 Días</span></div>
      <div class="card-bd"><canvas id="chart-flujo" height="180"></canvas></div>
    </div>
    <!-- Top trabajadores -->
    <div class="card">
      <div class="card-hd"><span class="font-bold text-gray-700">Top Trabajadores (Mes)</span></div>
      <div class="card-bd" style="padding-top:8px">
        \${(d.top_trabajadores||[]).length === 0 ? '<div class="empty-st" style="padding:20px"><i class="fas fa-users"></i><p style="font-size:13px">Sin datos</p></div>' :
          (d.top_trabajadores||[]).map((t,i)=>\`<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">\${i+1}</span>
              <span class="font-medium text-sm">\${t.nombre} \${t.apellido}</span>
            </div>
            <div class="text-right"><div class="text-sm font-bold text-green-600">\${fmt(t.total_ingresos)}</div><div class="text-xs text-gray-400">\${t.dias_trabajados} días</div></div>
          </div>\`).join('')}
      </div>
    </div>
  </div>

  <!-- Cajas de hoy -->
  <div class="card">
    <div class="card-hd">
      <span class="font-bold text-gray-700">Cajas de Hoy por Trabajador</span>
      <button onclick="showPage('admin-cajas')" class="btn btn-outline btn-sm">Ver todas</button>
    </div>
    <div style="overflow-x:auto">
      <table class="tbl">
        <thead><tr><th>Trabajador</th><th>Estado</th><th>Ingresos</th><th>Egresos</th><th>Movimientos</th><th>Acciones</th></tr></thead>
        <tbody>\${(d.cajas_hoy||[]).map(c=>\`<tr>
          <td><div class="font-medium">\${c.nombre} \${c.apellido}</div><div class="text-xs text-gray-400">\${c.cedula}</div></td>
          <td>\${c.id?({abierta:'<span class="badge badge-ok">Abierta</span>',cuadrada:'<span class="badge badge-blue">Cuadrada</span>',aprobada:'<span class="badge badge-ok">✓ Aprobada</span>',observada:'<span class="badge badge-warn">Observada</span>'}[c.estado]||c.estado):'<span class="badge badge-gray">Sin caja</span>'}</td>
          <td class="text-green-600 font-semibold">\${fmt(c.ingresos)}</td>
          <td class="text-red-500 font-semibold">\${fmt(c.egresos)}</td>
          <td class="text-center">\${c.movimientos||0}</td>
          <td>\${c.id && c.estado==='cuadrada' && isSuperadmin() ? \`<button onclick="aprobarCaja(\${c.id})" class="btn btn-success btn-sm"><i class="fas fa-check"></i> Aprobar</button>\` : ''}</td>
        </tr>\`).join('')}</tbody>
      </table>
    </div>
  </div>\`;

  // Gráfico
  setTimeout(() => {
    const flujo = d.flujo_7dias || [];
    const ctx = document.getElementById('chart-flujo');
    if (!ctx || !flujo.length) return;
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: flujo.map(f => new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-EC',{weekday:'short',day:'numeric'})),
        datasets: [
          { label: 'Ingresos', data: flujo.map(f=>f.ingresos), backgroundColor: 'rgba(16,185,129,.8)', borderRadius: 6 },
          { label: 'Egresos', data: flujo.map(f=>f.egresos), backgroundColor: 'rgba(239,68,68,.8)', borderRadius: 6 }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '$'+v.toLocaleString() } } } }
    });
  }, 100);
}

async function aprobarCaja(id) {
  if (!confirm('¿Aprobar esta caja?')) return;
  const r = await api('POST', '/api/admin/cajas/' + id + '/aprobar', {});
  if (r?.ok) { toast('Caja aprobada ✓', 'ok'); renderAdminDashboard(); }
  else toast(r?.data?.error || 'Error', 'err');
}

// ─── ADMIN: TODAS LAS CAJAS ───────────────────────────────────────────────────
function renderCajaRow(c) {
  const estadoMap = {
    abierta: '<span class="badge badge-ok">Abierta</span>',
    cuadrada: '<span class="badge badge-blue">Cuadrada</span>',
    aprobada: '<span class="badge badge-ok">✓ Aprobada</span>',
    observada: '<span class="badge badge-warn">Observada</span>'
  };
  const difClass = c.diferencia != null && Math.abs(c.diferencia) > 5 ? 'text-red-500 font-bold' : 'text-gray-600';
  const difVal = c.diferencia != null ? (c.diferencia >= 0 ? '+' : '') + fmt(c.diferencia) : '-';
  const btnAprobar = c.estado === 'cuadrada' && isSuperadmin()
    ? '<button onclick="aprobarCajaAdmin(' + c.id + ')" class="btn btn-success btn-sm"><i class="fas fa-check"></i></button>' : '';
  const btnObservar = c.estado === 'cuadrada' && isSuperadmin()
    ? '<button onclick="observarCaja(' + c.id + ')" class="btn btn-sm" style="background:#F59E0B;color:white"><i class="fas fa-comment"></i></button>' : '';
  const ganancia = (c.total_ingresos_calc || 0) - (c.total_egresos_calc || 0);
  const gananciaClass = ganancia > 0 ? 'text-green-600 font-bold' : ganancia < 0 ? 'text-red-500 font-bold' : 'text-gray-400';
  return '<tr>' +
    '<td><div class="font-medium">' + (c.trabajador_nombre || c.nombre + ' ' + c.apellido) + '</div><div class="text-xs text-gray-400">' + (c.cedula || '') + '</div></td>' +
    '<td>' + (estadoMap[c.estado] || c.estado) + '</td>' +
    '<td>' + fmt(c.saldo_inicial) + '</td>' +
    '<td class="text-green-600 font-semibold">' + fmt(c.total_ingresos_calc) + '</td>' +
    '<td class="text-red-500 font-semibold">' + fmt(c.total_egresos_calc) + '</td>' +
    '<td class="' + gananciaClass + '">' + (ganancia >= 0 ? '+' : '') + fmt(ganancia) + '</td>' +
    '<td class="' + difClass + '">' + difVal + '</td>' +
    '<td class="text-center">' + (c.total_movimientos || 0) + '</td>' +
    '<td><div class="flex gap-1">' + btnAprobar + btnObservar + '</div></td>' +
    '</tr>';
}

function renderCajasTable(cajas) {
  if (!cajas || cajas.length === 0) {
    return '<div class="empty-st"><i class="fas fa-calendar-xmark"></i><p>Sin cajas para esa fecha</p></div>';
  }
  return '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
    '<th>Trabajador</th><th>Estado</th><th>Saldo Inicial</th><th>Ingresos</th>' +
    '<th>Egresos</th><th>Ganancia</th><th>Diferencia</th><th>Movs.</th><th>Acciones</th>' +
    '</tr></thead><tbody>' +
    cajas.map(c => renderCajaRow(c)).join('') +
    '</tbody></table></div>';
}

async function cambiarFechaCajas(val) {
  const el = document.getElementById('cajas-lista');
  if (el) el.innerHTML = '<div class="loading-full"><div class="spin"></div><span>Cargando...</span></div>';
  const r = await api('GET', '/api/admin/cajas?fecha=' + val);
  const cajas = r?.data?.cajas || [];
  const el2 = document.getElementById('cajas-lista');
  if (el2) el2.innerHTML = renderCajasTable(cajas);
}

async function renderAdminCajas() {
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div><span>Cargando...</span></div>';
  const hoy = todayISO();
  const load = async (fecha) => {
    const r = await api('GET', '/api/admin/cajas?fecha=' + fecha);
    const cajas = r?.data?.cajas || [];
    const el = $('cajas-lista');
    if (el) el.innerHTML = renderCajasTable(cajas);
  };
  $('page-content').innerHTML = \`
    <div class="card mb-4">
      <div class="card-hd">
        <span class="font-bold text-gray-700">Filtrar por Fecha</span>
        <input type="date" id="filtro-fecha" value="\${hoy}" class="inp" style="width:180px" onchange="cambiarFechaCajas(this.value)">
      </div>
    </div>
    <div id="cajas-lista"><div class="loading-full"><div class="spin"></div></div></div>\`;
  await load(hoy);
}

async function aprobarCajaAdmin(id) {
  if (!confirm('¿Aprobar esta caja?')) return;
  const r = await api('POST', '/api/admin/cajas/' + id + '/aprobar', {});
  if (r?.ok) { toast('Caja aprobada ✓', 'ok'); renderAdminCajas(); }
  else toast(r?.data?.error || 'Error', 'err');
}

async function observarCaja(id) {
  const obs = prompt('Ingresa las observaciones para devolver la caja:');
  if (!obs) return;
  const r = await api('POST', '/api/admin/cajas/' + id + '/observar', { observaciones: obs });
  if (r?.ok) { toast('Caja marcada con observaciones', 'ok'); renderAdminCajas(); }
  else toast(r?.data?.error || 'Error', 'err');
}

// ─── ADMIN: REPORTES ──────────────────────────────────────────────────────────
async function renderAdminReportes() {
  const hoy = todayISO();
  const mesInicio = hoy.substring(0,7) + '-01';
  $('page-content').innerHTML = \`
  <div class="card mb-4">
    <div class="card-hd"><span class="font-bold text-gray-700">Reporte de Cajas por Período</span></div>
    <div class="card-bd flex gap-3 flex-wrap items-end">
      <div><label class="lbl">Desde</label><input type="date" id="rp-desde" value="\${mesInicio}" class="inp" style="width:160px"></div>
      <div><label class="lbl">Hasta</label><input type="date" id="rp-hasta" value="\${hoy}" class="inp" style="width:160px"></div>
      <button onclick="loadReporte()" class="btn btn-primary"><i class="fas fa-search"></i> Generar</button>
    </div>
  </div>
  <div id="rp-resultado"></div>\`;
}

async function loadReporte() {
  const desde = $('rp-desde').value; const hasta = $('rp-hasta').value;
  $('rp-resultado').innerHTML = '<div class="loading-full"><div class="spin"></div><span>Generando...</span></div>';
  const r = await api('GET', \`/api/admin/reportes/cajas?desde=\${desde}&hasta=\${hasta}\`);
  if (!r?.ok) { $('rp-resultado').innerHTML = '<div class="empty-st"><i class="fas fa-exclamation"></i><p>Error</p></div>'; return; }
  const { cajas, resumen } = r.data;
  $('rp-resultado').innerHTML = \`
  <div class="grid gap-4 mb-4 stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
    <div class="stat-card"><div class="text-gray-500 text-sm mb-1">Total Ingresos</div><div class="text-xl font-black text-green-600">\${fmt(resumen?.total_ingresos)}</div></div>
    <div class="stat-card"><div class="text-gray-500 text-sm mb-1">Total Egresos</div><div class="text-xl font-black text-red-500">\${fmt(resumen?.total_egresos)}</div></div>
    <div class="stat-card"><div class="text-gray-500 text-sm mb-1">Flujo Neto</div><div class="text-xl font-black \${(resumen?.total_ingresos-resumen?.total_egresos)>=0?'text-blue-600':'text-red-500'}">\${fmt(resumen?.total_ingresos-resumen?.total_egresos)}</div></div>
    <div class="stat-card"><div class="text-gray-500 text-sm mb-1">Cajas Procesadas</div><div class="text-xl font-black text-gray-700">\${resumen?.total_cajas||0}</div></div>
    <div class="stat-card"><div class="text-gray-500 text-sm mb-1">Trabajadores</div><div class="text-xl font-black text-gray-700">\${resumen?.total_trabajadores||0}</div></div>
  </div>
  <div class="card">
    <div class="card-hd"><span class="font-bold text-gray-700">Detalle de Cajas (\${cajas.length})</span></div>
    <div style="overflow-x:auto">
      \${cajas.length===0?'<div class="empty-st"><i class="fas fa-calendar-xmark"></i><p>Sin datos en ese período</p></div>':
      '<table class="tbl"><thead><tr><th>Fecha</th><th>Trabajador</th><th>Ingresos</th><th>Egresos</th><th>Diferencia</th><th>Estado</th></tr></thead><tbody>'+
      cajas.map(c=>\`<tr><td>\${c.fecha}</td><td>\${c.nombre} \${c.apellido}</td><td class="text-green-600 font-semibold">\${fmt(c.total_ingresos)}</td><td class="text-red-500 font-semibold">\${fmt(c.total_egresos)}</td><td class="\${c.diferencia!=null&&Math.abs(c.diferencia)>5?'text-red-500 font-bold':''}">\${c.diferencia!=null?(c.diferencia>=0?'+':'')+fmt(c.diferencia):'-'}</td><td>\${{abierta:'<span class="badge badge-ok">Abierta</span>',cuadrada:'<span class="badge badge-blue">Cuadrada</span>',aprobada:'<span class="badge badge-ok">Aprobada</span>',observada:'<span class="badge badge-warn">Observada</span>'}[c.estado]||c.estado}</td></tr>\`).join('')+'</tbody></table>'}
    </div>
  </div>\`;
}

// ─── ADMIN: PENDIENTES GLOBALES ────────────────────────────────────────────────
async function renderAdminPendientes() {
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div></div>';
  const r = await api('GET', '/api/admin/reportes/pendientes');
  const { pendientes=[], resumen={} } = r?.data || {};
  const estadoB = { pendiente:'badge-warn', parcial:'badge-info', pagado:'badge-ok', vencido:'badge-err', incobrable:'badge-gray' };
  $('page-content').innerHTML = \`
  <div class="grid gap-4 mb-4 stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
    <div class="stat-card"><div class="text-gray-500 text-sm mb-1">Total Deuda Bruta</div><div class="text-xl font-black text-gray-800">\${fmt(resumen.monto_total_bruto)}</div></div>
    <div class="stat-card"><div class="text-gray-500 text-sm mb-1">Por Cobrar</div><div class="text-xl font-black text-red-500">\${fmt(resumen.monto_por_cobrar)}</div></div>
    <div class="stat-card"><div class="text-gray-500 text-sm mb-1">Recuperado</div><div class="text-xl font-black text-green-600">\${fmt(resumen.monto_recuperado)}</div></div>
    <div class="stat-card"><div class="text-gray-500 text-sm mb-1">Vencidos</div><div class="text-xl font-black text-red-500">\${resumen.total_vencidos||0}</div></div>
  </div>
  <div class="card">
    <div class="card-hd"><span class="font-bold text-gray-700">Todos los Pendientes (\${pendientes.length})</span></div>
    <div style="overflow-x:auto">
      \${pendientes.length===0?'<div class="empty-st"><i class="fas fa-check"></i><p>No hay pendientes</p></div>':
      '<table class="tbl"><thead><tr><th>Trabajador</th><th>Cliente</th><th>Descripción</th><th>Total</th><th>Por Cobrar</th><th>Vencimiento</th><th>Estado</th></tr></thead><tbody>'+
      pendientes.map(p=>\`<tr class="pr-\${p.prioridad}"><td class="text-xs">\${p.usuario_nombre} \${p.usuario_apellido}</td><td class="font-medium">\${p.cliente_nombre}</td><td>\${p.descripcion}</td><td>\${fmt(p.monto_total)}</td><td class="text-red-500 font-bold">\${fmt(p.monto_pendiente)}</td><td class="\${p.fecha_vencimiento&&p.fecha_vencimiento<todayISO()&&p.estado!=='pagado'?'text-red-500 font-bold':''}">\${p.fecha_vencimiento||'–'}</td><td><span class="badge \${estadoB[p.estado]||'badge-gray'}">\${p.estado}</span></td></tr>\`).join('')+'</tbody></table>'}
    </div>
  </div>\`;
}

// ─── ADMIN: AUDITORÍA ─────────────────────────────────────────────────────────
async function renderAdminAuditoria() {
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div></div>';
  const r = await api('GET', '/api/admin/auditoria?limit=100');
  const logs = r?.data?.logs || [];
  $('page-content').innerHTML = \`<div class="card">
    <div class="card-hd"><span class="font-bold text-gray-700">Registro de Auditoría (\${logs.length})</span></div>
    <div style="overflow-x:auto">
      \${logs.length===0?'<div class="empty-st"><i class="fas fa-shield"></i><p>Sin registros</p></div>':
      '<table class="tbl"><thead><tr><th>Fecha/Hora</th><th>Usuario</th><th>Acción</th><th>Tabla</th><th>Registro</th></tr></thead><tbody>'+
      logs.map(l=>\`<tr><td class="text-xs text-gray-500 whitespace-nowrap">\${new Date(l.created_at).toLocaleString('es-EC')}</td><td class="text-sm">\${l.nombre||''} \${l.apellido||''}<div class="text-xs text-gray-400">\${l.cedula||'sistema'}</div></td><td><span class="badge badge-blue text-xs">\${l.accion}</span></td><td class="text-xs text-gray-500">\${l.tabla||'-'}</td><td class="text-xs text-gray-400">\${l.registro_id||'-'}</td></tr>\`).join('')+'</tbody></table>'}
    </div>
  </div>\`;
}

// ─── ADMIN: GESTIÓN DE USUARIOS ───────────────────────────────────────────────
async function renderAdminUsuarios() {
  if (!isSuperadmin()) { $('page-content').innerHTML = '<div class="empty-st"><i class="fas fa-lock"></i><p>Solo el superadministrador puede gestionar usuarios.</p></div>'; return; }
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div><span>Cargando usuarios...</span></div>';
  const r = await api('GET', '/api/admin/usuarios');
  const usuarios = r?.data?.usuarios || [];

  const rolBadge = rol => ({ superadmin: '<span class="badge badge-gold"><i class="fas fa-crown mr-1"></i>Superadmin</span>', supervisor: '<span class="badge badge-purple"><i class="fas fa-eye mr-1"></i>Supervisor</span>', trabajador: '<span class="badge badge-ok"><i class="fas fa-briefcase mr-1"></i>Trabajador</span>' }[rol] || rol);

  $('page-content').innerHTML = \`
  <div class="flex justify-between items-center mb-4">
    <div class="text-gray-500 text-sm">\${usuarios.length} usuario(s) registrado(s)</div>
    <button onclick="openNuevoUsuario()" class="btn btn-primary"><i class="fas fa-user-plus"></i> Nuevo Usuario</button>
  </div>

  <!-- Leyenda de roles -->
  <div class="card mb-4">
    <div class="card-bd">
      <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div class="flex items-start gap-3 p-3 rounded-xl" style="background:#FEF3C7">
          <i class="fas fa-crown text-yellow-600 mt-0.5"></i>
          <div><div class="font-bold text-yellow-800 text-sm">Superadmin</div><div class="text-xs text-yellow-700">Acceso total: crea usuarios, aprueba cajas, ve todo, configura el sistema.</div></div>
        </div>
        <div class="flex items-start gap-3 p-3 rounded-xl" style="background:#EDE9FE">
          <i class="fas fa-eye text-purple-600 mt-0.5"></i>
          <div><div class="font-bold text-purple-800 text-sm">Supervisor</div><div class="text-xs text-purple-700">Ve todos los reportes, cajas y pendientes. También opera su propia caja igual que un trabajador.</div></div>
        </div>
        <div class="flex items-start gap-3 p-3 rounded-xl" style="background:#D1FAE5">
          <i class="fas fa-briefcase text-green-600 mt-0.5"></i>
          <div><div class="font-bold text-green-800 text-sm">Trabajador</div><div class="text-xs text-green-700">Opera su propia caja: registra movimientos, pendientes y cuadra su caja.</div></div>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-hd"><span class="font-bold text-gray-700">Lista de Usuarios</span></div>
    <div style="overflow-x:auto">
      <table class="tbl">
        <thead><tr><th>Nombre</th><th>Cédula</th><th>Email</th><th>Rol</th><th>Cajas</th><th>Último Login</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>\${usuarios.map(u => \`<tr>
          <td><div class="font-semibold">\${u.nombre} \${u.apellido}</div></td>
          <td class="font-mono text-sm">\${u.cedula}</td>
          <td class="text-gray-400 text-sm">\${u.email||'–'}</td>
          <td>\${rolBadge(u.rol)}</td>
          <td class="text-center text-sm">\${u.total_cajas||0}</td>
          <td class="text-xs text-gray-400">\${u.ultimo_login?new Date(u.ultimo_login).toLocaleDateString('es-EC'):'Nunca'}</td>
          <td>\${u.activo?'<span class="badge badge-ok">Activo</span>':'<span class="badge badge-err">Inactivo</span>'}</td>
          <td>
            \${u.cedula !== '1314221597' ? \`<div class="flex gap-1">
              <button onclick="editarUsuario(\${u.id},'\${u.nombre}','\${u.apellido}','\${u.email||''}','\${u.rol}',\${u.activo})" class="btn btn-outline btn-sm"><i class="fas fa-pen"></i></button>
              <button onclick="toggleActivo(\${u.id},\${u.activo},'\${u.nombre}')" class="btn \${u.activo?'btn-danger':'btn-success'} btn-sm"><i class="fas fa-\${u.activo?'ban':'check'}"></i></button>
            </div>\` : '<span class="text-xs text-gray-400">Propietario</span>'}
          </td>
        </tr>\`).join('')}</tbody>
      </table>
    </div>
  </div>\`;
}

function openNuevoUsuario() {
  openModal(\`<div class="modal">
    <div class="modal-hd">
      <h3 class="font-bold text-gray-800 text-lg"><i class="fas fa-user-plus mr-2 text-blue-600"></i>Crear Nuevo Usuario</h3>
      <button onclick="closeModal()" class="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
    </div>
    <div class="modal-bd space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="lbl">Nombre *</label><input id="nu-nom" type="text" class="inp" placeholder="Nombre"></div>
        <div><label class="lbl">Apellido *</label><input id="nu-ape" type="text" class="inp" placeholder="Apellido"></div>
      </div>
      <div><label class="lbl">Cédula *</label><input id="nu-ced" type="text" class="inp" placeholder="Número de cédula"></div>
      <div><label class="lbl">Email (opcional)</label><input id="nu-email" type="email" class="inp" placeholder="correo@ejemplo.com"></div>
      <div><label class="lbl">Contraseña *</label><input id="nu-pwd" type="password" class="inp" placeholder="Mínimo 6 caracteres"></div>
      <div>
        <label class="lbl">Rol *</label>
        <select id="nu-rol" class="inp inp-select">
          <option value="trabajador">💼 Trabajador (opera su caja)</option>
          <option value="supervisor">👁️ Supervisor (reportes + opera caja)</option>
        </select>
      </div>
      <div class="alert-box alert-info text-sm"><i class="fas fa-info-circle"></i><span>El trabajador podrá iniciar sesión inmediatamente con la cédula y contraseña que asignes.</span></div>
    </div>
    <div class="modal-ft">
      <button onclick="closeModal()" class="btn btn-outline">Cancelar</button>
      <button onclick="crearUsuario()" class="btn btn-primary"><i class="fas fa-save"></i> Crear Usuario</button>
    </div>
  </div>\`);
}

async function crearUsuario() {
  const body = {
    nombre: $('nu-nom').value.trim(),
    apellido: $('nu-ape').value.trim(),
    cedula: $('nu-ced').value.trim(),
    email: $('nu-email').value.trim() || null,
    password: $('nu-pwd').value,
    rol: $('nu-rol').value,
  };
  if (!body.nombre || !body.apellido || !body.cedula || !body.password) { toast('Completa todos los campos obligatorios', 'warn'); return; }
  if (body.password.length < 6) { toast('La contraseña debe tener mínimo 6 caracteres', 'warn'); return; }
  const r = await api('POST', '/api/admin/usuarios', body);
  if (r?.ok) { toast('✓ Usuario ' + body.nombre + ' ' + body.apellido + ' creado', 'ok'); closeModal(); renderAdminUsuarios(); }
  else toast(r?.data?.error || 'Error al crear usuario', 'err');
}

function editarUsuario(id, nombre, apellido, email, rol, activo) {
  openModal(\`<div class="modal">
    <div class="modal-hd">
      <h3 class="font-bold text-gray-800 text-lg"><i class="fas fa-pen mr-2 text-blue-600"></i>Editar Usuario</h3>
      <button onclick="closeModal()" class="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
    </div>
    <div class="modal-bd space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="lbl">Nombre</label><input id="eu-nom" type="text" class="inp" value="\${nombre}"></div>
        <div><label class="lbl">Apellido</label><input id="eu-ape" type="text" class="inp" value="\${apellido}"></div>
      </div>
      <div><label class="lbl">Email</label><input id="eu-email" type="email" class="inp" value="\${email}"></div>
      <div>
        <label class="lbl">Rol</label>
        <select id="eu-rol" class="inp inp-select">
          <option value="trabajador" \${rol==='trabajador'?'selected':''}>💼 Trabajador</option>
          <option value="supervisor" \${rol==='supervisor'?'selected':''}>👁️ Supervisor</option>
        </select>
      </div>
      <div>
        <label class="lbl">Nueva Contraseña (dejar vacío para no cambiar)</label>
        <input id="eu-pwd" type="password" class="inp" placeholder="Nueva contraseña (mínimo 6 caracteres)">
      </div>
    </div>
    <div class="modal-ft">
      <button onclick="closeModal()" class="btn btn-outline">Cancelar</button>
      <button onclick="actualizarUsuario(\${id})" class="btn btn-primary"><i class="fas fa-save"></i> Guardar Cambios</button>
    </div>
  </div>\`);
}

async function actualizarUsuario(id) {
  const body = {
    nombre: $('eu-nom').value.trim(),
    apellido: $('eu-ape').value.trim(),
    email: $('eu-email').value.trim() || null,
    rol: $('eu-rol').value,
  };
  const pwd = $('eu-pwd').value;
  if (pwd) { if (pwd.length < 6) { toast('Mínimo 6 caracteres', 'warn'); return; } body.password = pwd; }
  const r = await api('PUT', '/api/admin/usuarios/' + id, body);
  if (r?.ok) { toast('✓ Usuario actualizado', 'ok'); closeModal(); renderAdminUsuarios(); }
  else toast(r?.data?.error || 'Error', 'err');
}

async function toggleActivo(id, activo, nombre) {
  const accion = activo ? 'desactivar' : 'activar';
  if (!confirm('¿Deseas ' + accion + ' al usuario ' + nombre + '?')) return;
  const r = await api('PUT', '/api/admin/usuarios/' + id, { activo: activo ? 0 : 1 });
  if (r?.ok) { toast('Usuario ' + accion + 'do ✓', 'ok'); renderAdminUsuarios(); }
  else toast(r?.data?.error || 'Error', 'err');
}

// ─── ADMIN: CONFIGURACIÓN ─────────────────────────────────────────────────────
async function renderAdminConfig() {
  if (!isSuperadmin()) { $('page-content').innerHTML = '<div class="empty-st"><i class="fas fa-lock"></i><p>Solo superadmin</p></div>'; return; }
  $('page-content').innerHTML = '<div class="loading-full"><div class="spin"></div></div>';
  const r = await api('GET', '/api/admin/config');
  const cfg = r?.data?.config || {};
  $('page-content').innerHTML = \`<div class="card" style="max-width:600px">
    <div class="card-hd"><span class="font-bold text-gray-700"><i class="fas fa-sliders mr-2 text-blue-600"></i>Configuración del Sistema</span></div>
    <div class="card-bd space-y-4">
      <div><label class="lbl">Nombre de la Empresa</label><input id="cfg-empresa" type="text" class="inp" value="\${cfg.nombre_empresa||''}"></div>
      <div><label class="lbl">Nombre de Agencia</label><input id="cfg-agencia" type="text" class="inp" value="\${cfg.agencia||''}"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="lbl">Moneda</label><input id="cfg-moneda" type="text" class="inp" value="\${cfg.moneda||'USD'}"></div>
        <div><label class="lbl">Símbolo</label><input id="cfg-simbolo" type="text" class="inp" value="\${cfg.simbolo_moneda||'$'}"></div>
      </div>
      <div><label class="lbl">Días para alertar antes de vencimiento</label><input id="cfg-dias" type="number" min="1" max="30" class="inp" value="\${cfg.dias_alerta_vencimiento||'3'}"></div>
      <div><label class="lbl">Diferencia máxima permitida en cuadre ($)</label><input id="cfg-maxdiff" type="number" step="0.01" min="0" class="inp" value="\${cfg.max_diferencia_permitida||'5.00'}"></div>
      <button onclick="guardarConfig()" class="btn btn-primary"><i class="fas fa-save"></i> Guardar Configuración</button>
    </div>
  </div>\`;
}

async function guardarConfig() {
  const body = {
    nombre_empresa: $('cfg-empresa').value.trim(),
    agencia: $('cfg-agencia').value.trim(),
    moneda: $('cfg-moneda').value.trim(),
    simbolo_moneda: $('cfg-simbolo').value.trim(),
    dias_alerta_vencimiento: $('cfg-dias').value,
    max_diferencia_permitida: $('cfg-maxdiff').value,
  };
  const r = await api('PUT', '/api/admin/config', body);
  if (r?.ok) toast('✓ Configuración guardada', 'ok');
  else toast(r?.data?.error || 'Error', 'err');
}

// ─── CUADRE EXCEL ────────────────────────────────────────────────────────────
// ── Estado multi-Excel ─────────────────────────────────────────────────────────
var _cuadreResultados = []; // array de resultados, uno por archivo

async function renderCuadreExcel() {
  _cuadreResultados = []; // reset al entrar a la sección
  $('page-content').innerHTML =
    '<div class="max-w-5xl mx-auto">' +
    '<div class="card mb-4" style="border-top:4px solid #1148AD">' +
      '<div class="card-hd"><span class="font-bold text-gray-800"><i class="fas fa-file-excel mr-2 text-green-600"></i>Cuadre Bancario — Verificación de Hojas Excel</span></div>' +
      '<div class="card-bd space-y-4">' +
        '<div class="alert-box alert-info"><i class="fas fa-info-circle"></i><span>Sube una o varias <strong>Hojas de Cuadre</strong> (.xlsx). Puedes seleccionar múltiples archivos (uno por trabajador/sistema). El sistema genera un cuadre individual por archivo y un <strong>resumen consolidado</strong> al final.</span></div>' +
        '<div id="drop-zone" onclick="document.getElementById(\'excel-file\').click()" ' +
          'style="border:2.5px dashed #CBD5E1;border-radius:14px;padding:40px;text-align:center;cursor:pointer;background:#F8FAFC;transition:all .2s" ' +
          'ondragover="event.preventDefault();this.style.background=\'#EFF6FF\';this.style.borderColor=\'#1148AD\'" ' +
          'ondragleave="this.style.background=\'#F8FAFC\';this.style.borderColor=\'#CBD5E1\'" ' +
          'ondrop="event.preventDefault();this.style.background=\'#F8FAFC\';this.style.borderColor=\'#CBD5E1\';procesarExcelDrop(event)" ' +
          'onmouseenter="this.style.background=\'#EFF6FF\';this.style.borderColor=\'#1148AD\'" ' +
          'onmouseleave="this.style.background=\'#F8FAFC\';this.style.borderColor=\'#CBD5E1\'">' +
          '<i class="fas fa-file-excel" style="font-size:48px;color:#10B981;display:block;margin-bottom:12px"></i>' +
          '<p class="font-semibold text-gray-700 text-lg">Haz clic o arrastra tus Excel aquí</p>' +
          '<p class="text-gray-400 text-sm mt-1">Puedes seleccionar <strong>múltiples archivos</strong> a la vez — uno por sistema/trabajador</p>' +
          '<input type="file" id="excel-file" accept=".xlsx" multiple style="display:none" onchange="procesarExcel(event)">' +
        '</div>' +
        '<div id="excel-progreso" style="display:none" class="space-y-2"></div>' +
        '<div id="excel-resultado"></div>' +
        '<div id="excel-consolidado"></div>' +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<div class="card-hd"><span class="font-bold text-gray-700"><i class="fas fa-circle-info mr-2 text-blue-500"></i>¿Qué analiza el sistema?</span></div>' +
      '<div class="card-bd">' +
        '<div class="grid gap-3" style="grid-template-columns:1fr 1fr">' +
          '<div class="p-3 rounded-xl" style="background:#D1FAE5"><div class="font-semibold text-green-800 text-sm mb-1"><i class="fas fa-coins mr-1"></i>Efectivo (apertura vs cierre)</div><div class="text-green-700 text-xs">Compara el efectivo del inicio del día (Hoja1) con el conteo al cierre (Hoja2) por denominación.</div></div>' +
          '<div class="p-3 rounded-xl" style="background:#DBEAFE"><div class="font-semibold text-blue-800 text-sm mb-1"><i class="fas fa-bank mr-1"></i>Sistemas — apertura vs cierre</div><div class="text-blue-700 text-xs">Compara saldos de Gold Pagos, Caja, DEX, Western Union entre apertura y cierre del día.</div></div>' +
          '<div class="p-3 rounded-xl" style="background:#FEF3C7"><div class="font-semibold text-yellow-800 text-sm mb-1"><i class="fas fa-scale-balanced mr-1"></i>Ganancia declarada vs verificada</div><div class="text-yellow-700 text-xs">Recalcula: sistemas_cierre − sistemas_apertura + observaciones. Debe coincidir con la ganancia del Excel.</div></div>' +
          '<div class="p-3 rounded-xl" style="background:#EDE9FE"><div class="font-semibold text-purple-800 text-sm mb-1"><i class="fas fa-list-check mr-1"></i>Observaciones / movimientos</div><div class="text-purple-700 text-xs">Lista todos los movimientos especiales (entregas al jefe, acreditaciones, etc.) y su impacto neto.</div></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '</div>';
}

// ── Drag & drop handler ────────────────────────────────────────────────────────
function procesarExcelDrop(event) {
  var files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  procesarArchivos(Array.from(files));
}

async function procesarExcel(event) {
  var files = Array.from(event.target.files || []);
  if (!files.length) return;
  // reset input para poder resubir el mismo archivo
  event.target.value = '';
  procesarArchivos(files);
}

// ── Procesa array de archivos en paralelo ──────────────────────────────────────
async function procesarArchivos(files) {
  // filtrar sólo .xlsx
  files = files.filter(function(f) { return f.name.toLowerCase().endsWith('.xlsx'); });
  if (!files.length) {
    toast('No se encontraron archivos .xlsx válidos', 'err');
    return;
  }

  _cuadreResultados = [];
  var resDiv      = document.getElementById('excel-resultado');
  var progresoDiv = document.getElementById('excel-progreso');
  var consolDiv   = document.getElementById('excel-consolidado');

  // Mostrar barra de progreso por archivo
  progresoDiv.style.display = 'block';
  progresoDiv.innerHTML = files.map(function(f, i) {
    return '<div id="prog-' + i + '" class="flex items-center gap-3 p-2 rounded-xl" style="background:#F8FAFC">' +
      '<div class="spin" style="flex-shrink:0"></div>' +
      '<span class="text-sm text-gray-600 truncate">' + f.name + '</span>' +
      '<span id="prog-lbl-' + i + '" class="ml-auto text-xs text-gray-400">Procesando…</span>' +
    '</div>';
  }).join('');

  resDiv.innerHTML = '';
  consolDiv.innerHTML = '';

  // Procesar todos los archivos en paralelo
  var promesas = files.map(function(file, i) {
    return procesarUnExcel(file, i);
  });
  var resultados = await Promise.all(promesas);

  // Filtrar errores y mostrar resultados individuales
  var htmlCards = '';
  resultados.forEach(function(res, i) {
    if (res.error) {
      htmlCards += '<div class="alert-box alert-danger mb-3"><i class="fas fa-circle-xmark"></i><span><strong>' + files[i].name + ':</strong> ' + res.error + '</span></div>';
    } else {
      _cuadreResultados.push(res.data);
      htmlCards += buildCuadreCard(res.data, files.length > 1);
    }
  });

  progresoDiv.style.display = 'none';
  resDiv.innerHTML = '<div class="space-y-4">' + htmlCards + '</div>';

  // Si hay 2+ resultados válidos → mostrar resumen consolidado
  if (_cuadreResultados.length >= 2) {
    consolDiv.innerHTML = renderResumenUnificado(_cuadreResultados);
  }
}

// ── Procesa un solo archivo y actualiza su indicador ──────────────────────────
async function procesarUnExcel(file, idx) {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    const base64 = btoa(binary);

    const r = await api('POST', '/api/cuadre/excel', { nombre: file.name, datos: base64 });
    var lbl = document.getElementById('prog-lbl-' + idx);
    var row = document.getElementById('prog-' + idx);
    if (!r?.ok) {
      if (lbl) lbl.textContent = '✗ Error';
      if (row) row.style.background = '#FEE2E2';
      return { error: r?.data?.error || 'Error desconocido' };
    }
    if (lbl) lbl.textContent = '✓ OK';
    if (row) { row.style.background = '#D1FAE5'; var sp = row.querySelector('.spin'); if(sp) sp.outerHTML = '<i class="fas fa-check-circle text-green-500"></i>'; }
    return { data: r.data };
  } catch(e) {
    var lbl2 = document.getElementById('prog-lbl-' + idx);
    var row2 = document.getElementById('prog-' + idx);
    if (lbl2) lbl2.textContent = '✗ Error';
    if (row2) row2.style.background = '#FEE2E2';
    return { error: e.message };
  }
}

// ── Resumen consolidado de todos los cuadres ──────────────────────────────────
function renderResumenUnificado(resultados) {
  var totalGanDeclarada  = 0, totalGanVerificada   = 0;
  var totalSisApertura   = 0, totalSisCierre       = 0;
  var totalEfecApertura  = 0, totalEfecCierre      = 0;
  var totalObs           = 0;
  var todosOk = true;

  resultados.forEach(function(d) {
    totalGanDeclarada += d.ganancia_declarada  || 0;
    totalGanVerificada += d.ganancia_verificada || 0;
    totalSisApertura  += d.total_sistemas_apertura || 0;
    totalSisCierre    += d.total_sistemas_cierre   || 0;
    totalEfecApertura += d.total_efectivo_apertura || 0;
    totalEfecCierre   += d.total_efectivo_cierre   || 0;
    totalObs          += d.total_observaciones      || 0;
    if (!d.ganancia_ok || (d.diferencia_efectivo !== null && Math.abs(d.diferencia_efectivo) > 1)) todosOk = false;
  });

  var diffGan = totalGanVerificada - totalGanDeclarada;
  var difEfec  = totalEfecCierre - totalEfecApertura;
  var estadoLabel = todosOk ? '✓ TODOS OK' : '⚠ REVISAR';
  var estadoCls   = todosOk ? 'badge-ok' : 'badge-err';

  var fmtSgn = function(v) { return (v >= 0 ? '+' : '') + fmt(v); };

  var html = '<div class="card mt-4" style="border-top:4px solid #7C3AED">' +
    '<div class="card-hd">' +
      '<span class="font-bold text-gray-800"><i class="fas fa-layer-group mr-2 text-purple-600"></i>Resumen Consolidado — ' + resultados.length + ' sistemas</span>' +
      '<span class="badge ' + estadoCls + ' ml-3">' + estadoLabel + '</span>' +
    '</div>' +
    '<div class="card-bd space-y-4">' +

    // Banner totales
    '<div class="saldo-box">' +
      '<div class="grid gap-3" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">' +
        '<div><div class="text-blue-200 text-xs mb-1">Ganancia Declarada Total</div><div class="text-2xl font-black">' + fmt(totalGanDeclarada) + '</div></div>' +
        '<div><div class="text-blue-200 text-xs mb-1">Ganancia Verificada Total</div><div class="text-2xl font-black ' + (Math.abs(diffGan) <= 1 ? 'text-green-300' : 'text-red-300') + '">' + fmt(totalGanVerificada) + '</div></div>' +
        '<div><div class="text-blue-200 text-xs mb-1">Diferencia</div><div class="text-2xl font-black ' + (Math.abs(diffGan) <= 1 ? 'text-green-300' : 'text-red-300') + '">' + (Math.abs(diffGan) <= 1 ? '✓ OK' : fmtSgn(diffGan)) + '</div></div>' +
      '</div>' +
      '<div class="grid gap-3" style="grid-template-columns:repeat(4,1fr)">' +
        '<div><div class="text-blue-200 text-xs mb-1">Sistemas Apertura</div><div class="text-lg font-bold">' + fmt(totalSisApertura) + '</div></div>' +
        '<div><div class="text-blue-200 text-xs mb-1">Sistemas Cierre</div><div class="text-lg font-bold">' + fmt(totalSisCierre) + '</div></div>' +
        '<div><div class="text-blue-200 text-xs mb-1">Efectivo Apertura</div><div class="text-lg font-bold">' + fmt(totalEfecApertura) + '</div></div>' +
        '<div><div class="text-blue-200 text-xs mb-1">Efectivo Cierre</div><div class="text-lg font-bold">' + fmt(totalEfecCierre) + '</div></div>' +
      '</div>' +
    '</div>' +

    // Tabla resumen por trabajador
    '<div style="overflow-x:auto"><table class="tbl">' +
      '<thead><tr><th>Trabajador</th><th>Fecha</th><th>Gan. Declarada</th><th>Gan. Verificada</th><th>Sis. Apertura</th><th>Sis. Cierre</th><th>Estado</th></tr></thead>' +
      '<tbody>' +
      resultados.map(function(d) {
        var ganOk   = d.ganancia_ok;
        var difEf   = d.diferencia_efectivo;
        var ok      = ganOk && (difEf === null || Math.abs(difEf) <= 1);
        var diffR   = (d.ganancia_verificada || 0) - (d.ganancia_declarada || 0);
        return '<tr>' +
          '<td class="font-semibold">' + (d.nombre_trabajador || '—') + '</td>' +
          '<td class="text-gray-500 text-sm">' + (d.fecha_cuadre || '—') + '</td>' +
          '<td>' + fmt(d.ganancia_declarada) + '</td>' +
          '<td class="' + (Math.abs(diffR) <= 1 ? 'text-green-600' : 'text-red-500') + ' font-semibold">' + fmt(d.ganancia_verificada) + '</td>' +
          '<td class="text-gray-500">' + fmt(d.total_sistemas_apertura) + '</td>' +
          '<td class="font-semibold">' + fmt(d.total_sistemas_cierre) + '</td>' +
          '<td><span class="badge ' + (ok ? 'badge-ok' : 'badge-err') + '">' + (ok ? '✓ OK' : '⚠ Rev.') + '</span></td>' +
        '</tr>';
      }).join('') +
      '<tr style="background:#EDE9FE;font-weight:bold">' +
        '<td colspan="2">TOTALES (' + resultados.length + ' archivos)</td>' +
        '<td>' + fmt(totalGanDeclarada) + '</td>' +
        '<td class="' + (Math.abs(diffGan) <= 1 ? 'text-green-700' : 'text-red-600') + '">' + fmt(totalGanVerificada) + '</td>' +
        '<td>' + fmt(totalSisApertura) + '</td>' +
        '<td>' + fmt(totalSisCierre) + '</td>' +
        '<td><span class="badge ' + estadoCls + '">' + estadoLabel + '</span></td>' +
      '</tr>' +
    '</tbody></table></div>' +

    '</div></div>';
  return html;
}

// ── Construye la tarjeta de resultado para UN cuadre ─────────────────────────
function buildCuadreCard(d, collapsible) {
  const fmtSgn = function(v) { return (v >= 0 ? '+' : '') + fmt(v); };
  const clsDiff = function(v, tol) {
    tol = tol || 1;
    return Math.abs(v) <= tol ? 'text-green-600 font-bold' : Math.abs(v) <= 5 ? 'text-yellow-600 font-bold' : 'text-red-500 font-bold';
  };
  const iconDiff = function(v, tol) {
    tol = tol || 1;
    return Math.abs(v) <= tol ? 'fa-check-circle text-green-500' : Math.abs(v) <= 5 ? 'fa-triangle-exclamation text-yellow-500' : 'fa-circle-xmark text-red-500';
  };

  const ganOk   = d.ganancia_ok;
  const difEfec = d.diferencia_efectivo;
  const hayDif  = difEfec !== null && Math.abs(difEfec) > 1;
  const estadoGlobal = ganOk && !hayDif ? 'badge-ok' : 'badge-err';
  const labelGlobal  = ganOk && !hayDif ? '✓ CUADRE CORRECTO' : '⚠ REVISAR';

  // Si hay múltiples archivos, envolver en <details> colapsable
  var inner =
    // 1. BANNER
    '<div class="saldo-box mb-4">' +
      '<div class="flex items-center justify-between mb-3">' +
        '<div>' +
          '<div class="text-blue-200 text-xs mb-0.5">' + (d.fecha_cuadre || '') + ' · ' + (d.hora_apertura ? 'Apertura: ' + d.hora_apertura : '') + '</div>' +
          '<div class="text-white font-bold text-lg">' + (d.nombre_trabajador || 'Sin nombre') + '</div>' +
        '</div>' +
        '<span class="badge ' + estadoGlobal + ' text-sm px-3 py-1">' + labelGlobal + '</span>' +
      '</div>' +
      '<div class="grid gap-3" style="grid-template-columns:repeat(4,1fr)">' +
        '<div><div class="text-blue-200 text-xs mb-1">Efectivo Apertura</div><div class="text-xl font-black">' + fmt(d.total_efectivo_apertura) + '</div></div>' +
        '<div><div class="text-blue-200 text-xs mb-1">Efectivo Cierre</div><div class="text-xl font-black">' + fmt(d.total_efectivo_cierre) + '</div></div>' +
        '<div><div class="text-blue-200 text-xs mb-1">Saldo Físico Caja</div><div class="text-xl font-black">' + fmt(d.saldo_efectivo_fisico) + '</div></div>' +
        '<div><div class="text-blue-200 text-xs mb-1">Ganancia del Día</div><div class="text-xl font-black ' + (d.ganancia_declarada >= 0 ? 'text-yellow-300' : 'text-red-300') + '">' + fmt(d.ganancia_declarada) + '</div></div>' +
      '</div>' +
    '</div>' +

    // 2. GANANCIA
    '<div class="card mb-3"><div class="card-hd"><span class="font-bold text-gray-700"><i class="fas fa-scale-balanced mr-2 text-yellow-500"></i>Verificación de Ganancia</span></div>' +
      '<div class="card-bd">' +
        '<div class="grid gap-3 mb-3" style="grid-template-columns:1fr 1fr 1fr">' +
          '<div class="p-3 rounded-xl text-center" style="background:#FEF3C7"><div class="text-yellow-700 text-xs mb-1">Ganancia en Excel (declarada)</div><div class="text-2xl font-black text-yellow-700">' + fmt(d.ganancia_declarada) + '</div></div>' +
          '<div class="p-3 rounded-xl text-center" style="background:#F0FDF4"><div class="text-green-700 text-xs mb-1">Ganancia verificada</div><div class="text-2xl font-black text-green-700">' + fmt(d.ganancia_verificada) + '</div><div class="text-green-600 text-xs mt-1">= sis.cierre − sis.apertura + obs.</div></div>' +
          '<div class="p-3 rounded-xl text-center flex flex-col justify-center" style="background:' + (ganOk ? '#D1FAE5' : '#FEE2E2') + '"><i class="fas ' + (ganOk ? 'fa-check-circle text-green-600' : 'fa-circle-xmark text-red-500') + ' text-2xl mb-1"></i><div class="font-bold ' + (ganOk ? 'text-green-700' : 'text-red-600') + '">' + (ganOk ? '✓ Coincide' : '✗ Difieren: ' + fmtSgn(d.ganancia_verificada - d.ganancia_declarada)) + '</div></div>' +
        '</div>' +
        '<div class="text-xs text-gray-400 p-2 rounded-lg" style="background:#F8FAFC"><strong>Fórmula:</strong> ' + fmt(d.total_sistemas_cierre) + ' − ' + fmt(d.total_sistemas_apertura) + ' + (' + fmtSgn(d.total_observaciones) + ') = <strong>' + fmt(d.ganancia_verificada) + '</strong></div>' +
      '</div></div>' +

    // 3. SISTEMAS
    '<div class="card mb-3"><div class="card-hd"><span class="font-bold text-gray-700"><i class="fas fa-bank mr-2 text-blue-500"></i>Sistemas / Cuentas</span></div>' +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Sistema</th><th>Apertura</th><th>Cierre</th><th>Variación</th></tr></thead><tbody>' +
      (d.sistemas_cierre || []).map(function(s) {
        var dif = s.diferencia || 0;
        var cls = dif > 0 ? 'text-green-600' : dif < 0 ? 'text-red-500' : 'text-gray-400';
        return '<tr><td class="font-semibold">' + s.nombre + '</td><td class="text-gray-600">' + fmt(s.saldo_apertura) + '</td><td class="font-bold">' + fmt(s.saldo_cierre) + '</td><td class="' + cls + ' font-bold">' + fmtSgn(dif) + '</td></tr>';
      }).join('') +
      '<tr style="background:#EFF6FF;font-weight:bold"><td>TOTAL</td><td>' + fmt(d.total_sistemas_apertura) + '</td><td>' + fmt(d.total_sistemas_cierre) + '</td><td class="' + clsDiff(d.total_sistemas_cierre - d.total_sistemas_apertura, 999) + '">' + fmtSgn(d.total_sistemas_cierre - d.total_sistemas_apertura) + '</td></tr>' +
    '</tbody></table></div></div>' +

    // 4. EFECTIVO
    (function() {
      var todasDenom = {};
      (d.efectivo_apertura || []).forEach(function(e) { todasDenom[e.denominacion] = todasDenom[e.denominacion] || {denom:e.denominacion,ap_qty:0,ap_sub:0,cl_qty:0,cl_sub:0}; todasDenom[e.denominacion].ap_qty=e.cantidad; todasDenom[e.denominacion].ap_sub=e.subtotal; });
      (d.efectivo_cierre   || []).forEach(function(e) { todasDenom[e.denominacion] = todasDenom[e.denominacion] || {denom:e.denominacion,ap_qty:0,ap_sub:0,cl_qty:0,cl_sub:0}; todasDenom[e.denominacion].cl_qty=e.cantidad; todasDenom[e.denominacion].cl_sub=e.subtotal; });
      var rows = Object.values(todasDenom).sort(function(a,b){return a.denom-b.denom;});
      return '<div class="card mb-3"><div class="card-hd"><span class="font-bold text-gray-700"><i class="fas fa-coins mr-2 text-yellow-500"></i>Efectivo por Denominación</span></div>' +
        '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Denominación</th><th>Ap. cant.</th><th>Ap. $</th><th>Cl. cant.</th><th>Cl. $</th><th>Var. $</th></tr></thead><tbody>' +
        rows.map(function(e) {
          var dif=(e.cl_sub||0)-(e.ap_sub||0);
          var cls=dif>0?'text-green-600':dif<0?'text-red-500':'text-gray-300';
          return '<tr><td class="font-mono font-semibold">$'+e.denom.toFixed(2)+'</td><td class="text-center text-gray-500">'+(e.ap_qty||0)+'</td><td class="text-gray-500">'+fmt(e.ap_sub||0)+'</td><td class="text-center font-semibold">'+(e.cl_qty||0)+'</td><td class="font-bold">'+fmt(e.cl_sub||0)+'</td><td class="'+cls+' font-bold">'+(dif!==0?fmtSgn(dif):'—')+'</td></tr>';
        }).join('') +
        '<tr style="background:#F0FDF4;font-weight:bold"><td>TOTAL</td><td></td><td>'+fmt(d.total_efectivo_apertura)+'</td><td></td><td>'+fmt(d.total_efectivo_cierre)+'</td><td class="'+clsDiff(d.total_efectivo_cierre-d.total_efectivo_apertura,999)+'">'+fmtSgn(d.total_efectivo_cierre-d.total_efectivo_apertura)+'</td></tr>' +
        '<tr style="background:#DBEAFE"><td colspan="4" class="font-bold text-blue-700">Saldo físico (fila 18)</td><td class="font-black text-blue-700">'+fmt(d.saldo_efectivo_fisico)+'</td><td></td></tr>' +
      '</tbody></table></div></div>';
    })() +

    // 5. OBSERVACIONES
    (d.observaciones && d.observaciones.length > 0 ?
      '<div class="card mb-3"><div class="card-hd"><span class="font-bold text-gray-700"><i class="fas fa-list-check mr-2 text-purple-500"></i>Observaciones</span></div>' +
        '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th style="width:75%">Descripción</th><th>Valor</th></tr></thead><tbody>' +
        d.observaciones.map(function(o) { return '<tr><td class="text-sm">'+o.descripcion+'</td><td class="font-semibold '+(o.valor>=0?'text-green-600':'text-red-500')+'">'+fmtSgn(o.valor)+'</td></tr>'; }).join('') +
        '<tr style="background:#EDE9FE;font-weight:bold"><td>TOTAL OBSERVACIONES</td><td class="'+clsDiff(d.total_observaciones,999)+'">'+fmtSgn(d.total_observaciones)+'</td></tr>' +
      '</tbody></table></div></div>'
    : '') +

    // 6. COMPARACIÓN D1
    '<div class="card"><div class="card-hd"><span class="font-bold text-gray-700"><i class="fas fa-database mr-2 text-gray-500"></i>Comparación con el Sistema (D1)</span></div><div class="card-bd">' +
    (d.saldo_sistema === null || d.saldo_sistema === undefined ?
      '<div class="alert-box alert-warn"><i class="fas fa-triangle-exclamation"></i><span>No hay caja registrada en el sistema para la fecha <strong>' + (d.fecha_cuadre || 'del Excel') + '</strong>.</span></div>'
    :
      '<div class="grid gap-3 mb-3" style="grid-template-columns:1fr 1fr 1fr">' +
      '<div class="p-3 rounded-xl text-center" style="background:#F8FAFC"><div class="text-gray-500 text-xs mb-1">Saldo sistema (D1)</div><div class="text-xl font-black">'+fmt(d.saldo_sistema)+'</div></div>' +
      '<div class="p-3 rounded-xl text-center" style="background:#F8FAFC"><div class="text-gray-500 text-xs mb-1">Efectivo físico (Excel)</div><div class="text-xl font-black">'+fmt(d.saldo_efectivo_fisico)+'</div></div>' +
      '<div class="p-3 rounded-xl text-center flex flex-col justify-center" style="background:'+(Math.abs(difEfec)<=1?'#D1FAE5':Math.abs(difEfec)<=10?'#FEF3C7':'#FEE2E2')+'"><i class="fas '+iconDiff(difEfec)+' text-2xl mb-1"></i><div class="font-bold">'+(Math.abs(difEfec)<=1?'✓ Cuadre OK':'Diferencia: '+fmtSgn(difEfec))+'</div></div>' +
      '</div>' +
      (d.caja_db ? '<div class="text-xs text-gray-400 p-2 rounded-lg" style="background:#F8FAFC">Caja D1 id='+d.caja_db.id+' · fecha='+d.caja_db.fecha+' · saldo_ini='+fmt(d.caja_db.saldo_inicial)+' · ingresos='+fmt(d.caja_db.ingresos)+' · egresos='+fmt(d.caja_db.egresos)+'</div>' : '')
    ) +
    '</div></div>';

  if (!collapsible) {
    return inner;
  }
  // Con múltiples archivos: encapsular en <details> colapsable
  var trabajador = d.nombre_trabajador || 'Sin nombre';
  var fecha      = d.fecha_cuadre || '';
  var badgeHtml  = '<span class="badge ' + estadoGlobal + ' text-xs ml-2">' + labelGlobal + '</span>';
  return '<details class="card mb-3" open>' +
    '<summary class="card-hd flex items-center cursor-pointer select-none" style="list-style:none">' +
      '<i class="fas fa-chevron-right mr-2 text-gray-400" style="transition:transform .2s" ' +
        'onclick="this.style.transform=this.closest(\'details\').open?\'rotate(90deg)\':\'\'"></i>' +
      '<i class="fas fa-file-excel mr-2 text-green-500"></i>' +
      '<span class="font-bold text-gray-800">' + trabajador + '</span>' +
      '<span class="text-gray-400 text-sm ml-2">' + fecha + '</span>' +
      badgeHtml +
    '</summary>' +
    '<div class="card-bd space-y-3 pt-3">' + inner + '</div>' +
  '</details>';
}



// ─── ARRANQUE ─────────────────────────────────────────────────────────────────
initApp();
</script>
</body>
</html>`;
}
