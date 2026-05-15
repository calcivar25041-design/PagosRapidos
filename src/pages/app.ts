export function renderApp(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Pagos Rápidos – Sistema de Caja</title>
  <link rel="icon" type="image/png" href="https://www.genspark.ai/api/files/s/c6D6iG1M?cache_control=3600"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"/>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    *{font-family:'Inter',sans-serif;box-sizing:border-box;}
    :root{--blue:#1148AD;--blue-dark:#0d3b8e;--yellow:#F5A400;--green:#16a34a;--red:#dc2626;}
    .sidebar{background:linear-gradient(180deg,#0d3b8e 0%,#1148AD 60%,#1a5cc8 100%);transition:all .3s ease;}
    .nav-item{transition:all .2s ease;border-left:3px solid transparent;}
    .nav-item:hover,.nav-item.active{background:rgba(255,255,255,.15);border-left-color:#F5A400;}
    .nav-item.active{background:rgba(245,164,0,.2);}
    .card{background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06);transition:box-shadow .2s;}
    .card:hover{box-shadow:0 4px 20px rgba(0,0,0,.12);}
    .stat-card{border-left:4px solid var(--blue);}
    .badge{display:inline-flex;align-items:center;padding:2px 10px;border-radius:999px;font-size:.72rem;font-weight:600;}
    .badge-green{background:#dcfce7;color:#16a34a;}
    .badge-yellow{background:#fef9c3;color:#ca8a04;}
    .badge-red{background:#fee2e2;color:#dc2626;}
    .badge-blue{background:#dbeafe;color:#1d4ed8;}
    .badge-gray{background:#f3f4f6;color:#6b7280;}
    .badge-orange{background:#ffedd5;color:#ea580c;}
    .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;font-weight:600;font-size:.875rem;cursor:pointer;transition:all .2s;border:none;}
    .btn-primary{background:linear-gradient(135deg,var(--blue),#1a5cc8);color:#fff;}
    .btn-primary:hover{background:linear-gradient(135deg,var(--blue-dark),var(--blue));transform:translateY(-1px);box-shadow:0 4px 15px rgba(17,72,173,.35);}
    .btn-success{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;}
    .btn-success:hover{background:linear-gradient(135deg,#15803d,#166534);transform:translateY(-1px);}
    .btn-danger{background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;}
    .btn-danger:hover{transform:translateY(-1px);}
    .btn-yellow{background:linear-gradient(135deg,var(--yellow),#d97706);color:#fff;}
    .btn-yellow:hover{transform:translateY(-1px);}
    .btn-sm{padding:5px 12px;font-size:.8rem;}
    .btn-outline{background:transparent;border:2px solid var(--blue);color:var(--blue);}
    .btn-outline:hover{background:var(--blue);color:#fff;}
    .form-input{width:100%;padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;font-size:.9rem;transition:border-color .2s,box-shadow .2s;background:#fafafa;}
    .form-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(17,72,173,.1);outline:none;background:#fff;}
    .form-label{display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:5px;}
    .table-row:hover{background:#f8faff;}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;}
    .modal-box{background:#fff;border-radius:20px;width:100%;max-width:580px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);}
    .alert-badge{position:absolute;top:-4px;right:-4px;background:#dc2626;color:#fff;border-radius:999px;font-size:.65rem;font-weight:700;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;padding:0 4px;}
    .progress-bar{height:8px;border-radius:4px;background:#e5e7eb;overflow:hidden;}
    .progress-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--blue),#F5A400);transition:width .5s ease;}
    .sidebar-collapsed .sidebar-text{display:none;}
    .page{display:none;}.page.active{display:block;}
    .tab-btn{padding:8px 16px;border-radius:8px;font-weight:600;font-size:.85rem;cursor:pointer;transition:all .2s;border:2px solid transparent;}
    .tab-btn.active{background:var(--blue);color:#fff;}
    .tab-btn:not(.active):hover{background:#f3f4f6;}
    .number-up{color:#16a34a;} .number-down{color:#dc2626;}
    .toast{position:fixed;bottom:24px;right:24px;z-index:9999;padding:14px 20px;border-radius:14px;font-weight:600;font-size:.9rem;display:flex;align-items:center;gap:10px;box-shadow:0 8px 30px rgba(0,0,0,.2);transform:translateY(100px);opacity:0;transition:all .3s ease;}
    .toast.show{transform:translateY(0);opacity:1;}
    .toast-success{background:#16a34a;color:#fff;}
    .toast-error{background:#dc2626;color:#fff;}
    .toast-info{background:var(--blue);color:#fff;}
    .loading-spin{display:inline-block;width:20px;height:20px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg)}}
    .vencido-row{background:#fff5f5 !important;}
    .urgente-row{background:#fffbf0 !important;}
    #sidebar{width:260px;min-height:100vh;position:fixed;left:0;top:0;z-index:100;}
    #main-content{margin-left:260px;min-height:100vh;background:#f1f5f9;}
    @media(max-width:768px){#sidebar{transform:translateX(-100%);} #main-content{margin-left:0;} #sidebar.open{transform:translateX(0);}}
    .cuadre-card{border:2px solid #e5e7eb;border-radius:14px;padding:16px;}
    .cuadre-card.ok{border-color:#16a34a;background:#f0fdf4;}
    .cuadre-card.warn{border-color:#F5A400;background:#fffbeb;}
    .cuadre-card.danger{border-color:#dc2626;background:#fef2f2;}
  </style>
</head>
<body class="bg-slate-100">

<!-- Toast de notificaciones -->
<div id="toast" class="toast"></div>

<!-- Sidebar -->
<aside id="sidebar" class="sidebar flex flex-col">
  <!-- Logo -->
  <div class="p-5 border-b border-white/20">
    <div class="flex items-center gap-3">
      <img src="https://www.genspark.ai/api/files/s/c6D6iG1M?cache_control=3600"
           alt="Logo" class="h-10 w-auto flex-shrink-0"
           onerror="this.style.display='none'"/>
      <div>
        <div class="text-white font-black text-base leading-tight">Pagos <span style="color:#F5A400">Rápidos</span></div>
        <div class="text-blue-200 text-xs font-medium">Agencia Alban Borja</div>
      </div>
    </div>
  </div>

  <!-- Usuario actual -->
  <div class="px-4 py-3 border-b border-white/10">
    <div id="sidebarUser" class="flex items-center gap-3">
      <div id="userAvatar" class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style="background:#F5A400">?</div>
      <div class="min-w-0">
        <div id="userName" class="text-white font-semibold text-sm truncate">Cargando...</div>
        <div id="userRol" class="text-blue-200 text-xs font-medium">–</div>
      </div>
    </div>
  </div>

  <!-- Navegación -->
  <nav class="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
    <button onclick="showPage('dashboard')" class="nav-item active w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-white/90 font-medium text-sm" id="nav-dashboard">
      <i class="fas fa-th-large w-5 text-center"></i><span class="sidebar-text">Dashboard</span>
    </button>
    <button onclick="showPage('caja')" class="nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-white/90 font-medium text-sm" id="nav-caja">
      <i class="fas fa-cash-register w-5 text-center"></i><span class="sidebar-text">Mi Caja</span>
    </button>
    <button onclick="showPage('movimientos')" class="nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-white/90 font-medium text-sm" id="nav-movimientos">
      <i class="fas fa-exchange-alt w-5 text-center"></i><span class="sidebar-text">Movimientos</span>
    </button>
    <button onclick="showPage('pendientes')" class="nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-white/90 font-medium text-sm" id="nav-pendientes">
      <i class="fas fa-file-invoice-dollar w-5 text-center"></i><span class="sidebar-text">Pendientes</span>
    </button>

    <!-- Solo admin -->
    <div id="adminNav" class="hidden">
      <div class="px-4 py-2 text-xs font-bold text-blue-300 uppercase tracking-widest mt-2">Administración</div>
      <button onclick="showPage('admin')" class="nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-white/90 font-medium text-sm" id="nav-admin">
        <i class="fas fa-chart-pie w-5 text-center"></i><span class="sidebar-text">Panel Admin</span>
      </button>
      <button onclick="showPage('trabajadores')" class="nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-white/90 font-medium text-sm" id="nav-trabajadores">
        <i class="fas fa-users w-5 text-center"></i><span class="sidebar-text">Trabajadores</span>
      </button>
      <button onclick="showPage('reportes')" class="nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-white/90 font-medium text-sm" id="nav-reportes">
        <i class="fas fa-chart-bar w-5 text-center"></i><span class="sidebar-text">Reportes</span>
      </button>
    </div>
  </nav>

  <!-- Botón notificaciones + logout -->
  <div class="p-4 border-t border-white/10 space-y-2">
    <button onclick="showPage('alertas')" class="nav-item relative w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-white/90 font-medium text-sm" id="nav-alertas">
      <div class="relative">
        <i class="fas fa-bell w-5 text-center"></i>
        <span id="alertaBadge" class="hidden alert-badge">0</span>
      </div>
      <span class="sidebar-text">Alertas</span>
    </button>
    <button onclick="showPage('perfil')" class="nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-white/90 font-medium text-sm">
      <i class="fas fa-cog w-5 text-center"></i><span class="sidebar-text">Mi Perfil</span>
    </button>
    <button onclick="logout()" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-300 hover:bg-red-500/20 font-medium text-sm transition-all">
      <i class="fas fa-sign-out-alt w-5 text-center"></i><span class="sidebar-text">Cerrar Sesión</span>
    </button>
  </div>
</aside>

<!-- Main Content -->
<main id="main-content">
  <!-- Topbar móvil -->
  <div class="md:hidden bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-50 shadow-sm">
    <button onclick="toggleSidebar()" class="text-gray-600 text-xl"><i class="fas fa-bars"></i></button>
    <span class="font-bold text-gray-800">Pagos <span style="color:#F5A400">Rápidos</span></span>
  </div>

  <div class="p-6 max-w-7xl mx-auto">

    <!-- ═══════════════════════════════════════════════════════ DASHBOARD -->
    <div id="page-dashboard" class="page active">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-black text-gray-800">Dashboard</h1>
          <p id="fechaHoy" class="text-gray-500 text-sm mt-0.5"></p>
        </div>
        <button onclick="loadDashboard()" class="btn btn-outline btn-sm"><i class="fas fa-sync-alt"></i> Actualizar</button>
      </div>

      <!-- Stat cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" id="statCards">
        <div class="card p-5 stat-card" style="border-left-color:#1148AD">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Ingresos Hoy</span>
            <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:#dbeafe"><i class="fas fa-arrow-down text-blue-600"></i></div>
          </div>
          <div id="stat-ingresos" class="text-2xl font-black text-gray-800">$0.00</div>
          <div id="stat-ingresos-mov" class="text-xs text-gray-500 mt-1">0 movimientos</div>
        </div>
        <div class="card p-5 stat-card" style="border-left-color:#dc2626">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Egresos Hoy</span>
            <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50"><i class="fas fa-arrow-up text-red-500"></i></div>
          </div>
          <div id="stat-egresos" class="text-2xl font-black text-gray-800">$0.00</div>
          <div id="stat-egresos-cat" class="text-xs text-gray-500 mt-1">–</div>
        </div>
        <div class="card p-5 stat-card" style="border-left-color:#F5A400">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Por Cobrar</span>
            <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-yellow-50"><i class="fas fa-file-invoice-dollar text-yellow-600"></i></div>
          </div>
          <div id="stat-pendientes" class="text-2xl font-black text-gray-800">$0.00</div>
          <div id="stat-pendientes-count" class="text-xs text-gray-500 mt-1">0 pendientes</div>
        </div>
        <div class="card p-5 stat-card" style="border-left-color:#16a34a">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Saldo Caja</span>
            <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50"><i class="fas fa-wallet text-green-600"></i></div>
          </div>
          <div id="stat-saldo" class="text-2xl font-black text-gray-800">$0.00</div>
          <div id="stat-caja-estado" class="text-xs text-gray-500 mt-1">–</div>
        </div>
      </div>

      <!-- Chart + Alertas vencimiento -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div class="card p-5 lg:col-span-2">
          <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-chart-area text-blue-600"></i> Flujo de Caja – Últimos 7 días</h3>
          <canvas id="chartFlujo" height="200"></canvas>
        </div>
        <div class="card p-5">
          <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-clock text-yellow-500"></i> Próximos a Vencer</h3>
          <div id="proximosVencer" class="space-y-2 text-sm text-gray-500">Cargando...</div>
        </div>
      </div>

      <!-- Últimos movimientos -->
      <div class="card p-5">
        <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-history text-blue-600"></i> Últimos Movimientos</h3>
        <div id="ultimosMovimientos" class="text-sm text-gray-500">Cargando...</div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ MI CAJA -->
    <div id="page-caja" class="page">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-black text-gray-800">Mi Caja</h1>
          <p class="text-gray-500 text-sm mt-0.5">Control de caja del día</p>
        </div>
        <div class="flex gap-2">
          <button onclick="loadCaja()" class="btn btn-outline btn-sm"><i class="fas fa-sync-alt"></i></button>
          <button onclick="openModalMovimiento('ingreso')" class="btn btn-success"><i class="fas fa-plus"></i> Ingreso</button>
          <button onclick="openModalMovimiento('egreso')" class="btn btn-danger"><i class="fas fa-minus"></i> Egreso</button>
        </div>
      </div>

      <!-- Info caja -->
      <div id="cajaInfo" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div class="card p-5 text-center">
          <div class="text-xs font-bold text-gray-500 uppercase mb-1">Saldo Inicial</div>
          <div id="cajaSaldoInicial" class="text-3xl font-black" style="color:#1148AD">$0.00</div>
        </div>
        <div class="card p-5 text-center">
          <div class="text-xs font-bold text-gray-500 uppercase mb-1">Saldo Actual</div>
          <div id="cajaSaldoActual" class="text-3xl font-black text-green-600">$0.00</div>
        </div>
        <div class="card p-5 text-center">
          <div class="text-xs font-bold text-gray-500 uppercase mb-1">Estado</div>
          <div id="cajaEstado" class="text-lg font-bold mt-1">–</div>
        </div>
      </div>

      <!-- Tabs ingresos/egresos/cuadre -->
      <div class="card p-5 mb-4">
        <div class="flex gap-2 flex-wrap mb-4">
          <button onclick="filterMovCaja('todos')" class="tab-btn active" id="tab-todos">Todos</button>
          <button onclick="filterMovCaja('ingreso')" class="tab-btn" id="tab-ingreso"><i class="fas fa-arrow-down text-green-500 mr-1"></i>Ingresos</button>
          <button onclick="filterMovCaja('egreso')" class="tab-btn" id="tab-egreso"><i class="fas fa-arrow-up text-red-500 mr-1"></i>Egresos</button>
          <div class="ml-auto">
            <button onclick="openModalCuadre()" class="btn btn-yellow" id="btnCuadre"><i class="fas fa-calculator"></i> Cuadrar Caja</button>
          </div>
        </div>
        <div id="movimientosCaja" class="space-y-2">
          <div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><br>Cargando...</div>
        </div>
      </div>

      <!-- Resumen caja -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="card p-4 text-center">
          <div class="text-xs text-gray-500 font-semibold uppercase mb-1">Ingresos</div>
          <div id="totalIngCaja" class="text-xl font-black text-green-600">$0.00</div>
        </div>
        <div class="card p-4 text-center">
          <div class="text-xs text-gray-500 font-semibold uppercase mb-1">Egresos</div>
          <div id="totalEgCaja" class="text-xl font-black text-red-600">$0.00</div>
        </div>
        <div class="card p-4 text-center">
          <div class="text-xs text-gray-500 font-semibold uppercase mb-1">Neto</div>
          <div id="totalNetoCaja" class="text-xl font-black" style="color:#1148AD">$0.00</div>
        </div>
        <div class="card p-4 text-center">
          <div class="text-xs text-gray-500 font-semibold uppercase mb-1">Movimientos</div>
          <div id="totalMovCaja" class="text-xl font-black text-gray-700">0</div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ MOVIMIENTOS -->
    <div id="page-movimientos" class="page">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-black text-gray-800">Historial de Movimientos</h1>
          <p class="text-gray-500 text-sm mt-0.5">Todos tus ingresos y egresos</p>
        </div>
        <div class="flex gap-2">
          <input type="date" id="filtroFechaIni" class="form-input w-36 text-sm" onchange="loadMovimientos()"/>
          <input type="date" id="filtroFechaFin" class="form-input w-36 text-sm" onchange="loadMovimientos()"/>
        </div>
      </div>
      <div class="card p-5">
        <div class="flex gap-2 mb-4 flex-wrap">
          <button onclick="filtrarMovTipo('todos')" class="tab-btn active" id="mvtab-todos">Todos</button>
          <button onclick="filtrarMovTipo('ingreso')" class="tab-btn" id="mvtab-ingreso">Ingresos</button>
          <button onclick="filtrarMovTipo('egreso')" class="tab-btn" id="mvtab-egreso">Egresos</button>
        </div>
        <div id="tablaMovimientos" class="overflow-x-auto">
          <div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ PENDIENTES -->
    <div id="page-pendientes" class="page">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-black text-gray-800">Pendientes / Cuentas por Cobrar</h1>
          <p class="text-gray-500 text-sm mt-0.5">Gestiona las deudas de tus clientes</p>
        </div>
        <button onclick="openModalPendiente()" class="btn btn-primary"><i class="fas fa-plus"></i> Nuevo Pendiente</button>
      </div>

      <!-- Stats pendientes -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" id="statsPendientes">
        <div class="card p-4 stat-card" style="border-left-color:#F5A400">
          <div class="text-xs text-gray-500 font-bold uppercase mb-1">Por Cobrar</div>
          <div id="pend-total" class="text-2xl font-black" style="color:#F5A400">$0.00</div>
        </div>
        <div class="card p-4 stat-card" style="border-left-color:#dc2626">
          <div class="text-xs text-gray-500 font-bold uppercase mb-1">Vencidos</div>
          <div id="pend-vencidos" class="text-2xl font-black text-red-600">0</div>
        </div>
        <div class="card p-4 stat-card" style="border-left-color:#16a34a">
          <div class="text-xs text-gray-500 font-bold uppercase mb-1">Cobrados</div>
          <div id="pend-cobrados" class="text-2xl font-black text-green-600">$0.00</div>
        </div>
        <div class="card p-4 stat-card" style="border-left-color:#1148AD">
          <div class="text-xs text-gray-500 font-bold uppercase mb-1">Activos</div>
          <div id="pend-activos" class="text-2xl font-black" style="color:#1148AD">0</div>
        </div>
      </div>

      <!-- Filtros -->
      <div class="card p-4 mb-4">
        <div class="flex gap-2 flex-wrap">
          <button onclick="filtrarPendientes('todos')" class="tab-btn active" id="ptab-todos">Todos</button>
          <button onclick="filtrarPendientes('pendiente')" class="tab-btn" id="ptab-pendiente">Pendientes</button>
          <button onclick="filtrarPendientes('parcial')" class="tab-btn" id="ptab-parcial">Parciales</button>
          <button onclick="filtrarPendientes('vencidos')" class="tab-btn" id="ptab-vencidos">Vencidos <span id="badge-vencidos" class="ml-1 badge badge-red">0</span></button>
          <button onclick="filtrarPendientes('pagado')" class="tab-btn" id="ptab-pagado">Pagados</button>
        </div>
      </div>

      <div id="tablaPendientes">
        <div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ ADMIN -->
    <div id="page-admin" class="page">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-black text-gray-800">Panel Administrador</h1>
          <p class="text-gray-500 text-sm mt-0.5">Vista consolidada de todos los trabajadores</p>
        </div>
        <div class="flex gap-2">
          <button onclick="loadAdmin()" class="btn btn-outline btn-sm"><i class="fas fa-sync-alt"></i> Actualizar</button>
          <button onclick="showPage('trabajadores')" class="btn btn-primary btn-sm"><i class="fas fa-users"></i> Trabajadores</button>
        </div>
      </div>

      <!-- Stats admin -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="card p-5 stat-card" style="border-left-color:#1148AD">
          <div class="text-xs text-gray-500 font-bold uppercase mb-1">Ingresos Totales Hoy</div>
          <div id="adm-ingresos" class="text-2xl font-black" style="color:#1148AD">$0.00</div>
        </div>
        <div class="card p-5 stat-card" style="border-left-color:#dc2626">
          <div class="text-xs text-gray-500 font-bold uppercase mb-1">Egresos Totales Hoy</div>
          <div id="adm-egresos" class="text-2xl font-black text-red-600">$0.00</div>
        </div>
        <div class="card p-5 stat-card" style="border-left-color:#F5A400">
          <div class="text-xs text-gray-500 font-bold uppercase mb-1">Cajas por Aprobar</div>
          <div id="adm-por-aprobar" class="text-2xl font-black" style="color:#F5A400">0</div>
        </div>
        <div class="card p-5 stat-card" style="border-left-color:#dc2626">
          <div class="text-xs text-gray-500 font-bold uppercase mb-1">Pendientes Vencidos</div>
          <div id="adm-vencidos" class="text-2xl font-black text-red-600">0</div>
        </div>
      </div>

      <!-- Tabla trabajadores hoy -->
      <div class="card p-5 mb-6">
        <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-users text-blue-600"></i> Resumen de Trabajadores – Hoy</h3>
        <div id="adminTrabajadoresHoy" class="overflow-x-auto">
          <div class="text-center py-6 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
        </div>
      </div>

      <!-- Cajas por aprobar -->
      <div class="card p-5 mb-6">
        <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-check-circle text-yellow-500"></i> Cuadres Pendientes de Aprobación
          <span id="badgePorAprobar" class="badge badge-yellow ml-2">0</span>
        </h3>
        <div id="cajasAprobar">
          <div class="text-center py-6 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
        </div>
      </div>

      <!-- Gráfica tendencia -->
      <div class="card p-5">
        <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-chart-line text-blue-600"></i> Tendencia Semanal</h3>
        <canvas id="chartAdmin" height="120"></canvas>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ TRABAJADORES -->
    <div id="page-trabajadores" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-black text-gray-800">Gestión de Trabajadores</h1>
        <button onclick="openModalTrabajador()" class="btn btn-primary"><i class="fas fa-user-plus"></i> Nuevo Trabajador</button>
      </div>
      <div class="card p-5">
        <div id="tablaTrabajadores">
          <div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ REPORTES -->
    <div id="page-reportes" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-black text-gray-800">Reportes Financieros</h1>
        <div class="flex gap-2 items-center">
          <input type="date" id="repFechaIni" class="form-input w-36 text-sm"/>
          <input type="date" id="repFechaFin" class="form-input w-36 text-sm"/>
          <button onclick="loadReporte()" class="btn btn-primary btn-sm"><i class="fas fa-search"></i> Consultar</button>
        </div>
      </div>
      <div id="contenidoReporte">
        <div class="card p-16 text-center text-gray-400">
          <i class="fas fa-chart-bar text-5xl mb-4"></i>
          <p class="font-semibold">Selecciona un rango de fechas y presiona Consultar</p>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ ALERTAS -->
    <div id="page-alertas" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-black text-gray-800">Alertas y Notificaciones</h1>
        <button onclick="marcarTodasLeidas()" class="btn btn-outline btn-sm"><i class="fas fa-check-double"></i> Marcar todas leídas</button>
      </div>
      <div id="listaAlertas" class="space-y-3">
        <div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ PERFIL -->
    <div id="page-perfil" class="page">
      <h1 class="text-2xl font-black text-gray-800 mb-6">Mi Perfil</h1>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card p-6">
          <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-user text-blue-600"></i> Información Personal</h3>
          <div id="perfilInfo" class="space-y-3 text-sm text-gray-600">Cargando...</div>
        </div>
        <div class="card p-6">
          <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-lock text-blue-600"></i> Cambiar Contraseña</h3>
          <form id="formPassword" class="space-y-4">
            <div><label class="form-label">Contraseña Actual</label><input type="password" id="pwActual" class="form-input" placeholder="••••••••"/></div>
            <div><label class="form-label">Nueva Contraseña</label><input type="password" id="pwNueva" class="form-input" placeholder="Mínimo 6 caracteres"/></div>
            <div><label class="form-label">Confirmar Nueva</label><input type="password" id="pwConfirm" class="form-input" placeholder="Repite la contraseña"/></div>
            <button type="submit" class="btn btn-primary w-full"><i class="fas fa-save"></i> Actualizar Contraseña</button>
          </form>
        </div>
      </div>
    </div>

  </div><!-- /max-w -->
</main><!-- /main-content -->

<!-- ═══════════════════════════════════════════════════════ MODALES -->

<!-- Modal Movimiento -->
<div id="modalMovimiento" class="modal-overlay hidden" onclick="closeModalIf(event,'modalMovimiento')">
  <div class="modal-box">
    <div class="p-6 border-b flex items-center justify-between">
      <h2 id="modalMovTitulo" class="text-xl font-black text-gray-800">Nuevo Ingreso</h2>
      <button onclick="closeModal('modalMovimiento')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"><i class="fas fa-times"></i></button>
    </div>
    <form id="formMovimiento" class="p-6 space-y-4">
      <input type="hidden" id="movTipo"/>
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2"><label class="form-label">Categoría *</label><select id="movCategoria" class="form-input" required></select></div>
        <div class="col-span-2"><label class="form-label">Descripción *</label><input id="movDescripcion" type="text" class="form-input" placeholder="Describe el movimiento..." required/></div>
        <div><label class="form-label">Monto (USD) *</label><input id="movMonto" type="number" step="0.01" min="0.01" class="form-input" placeholder="0.00" required/></div>
        <div><label class="form-label">Referencia</label><input id="movReferencia" type="text" class="form-input" placeholder="N° recibo, transferencia..."/></div>
        <div class="col-span-2"><label class="form-label">Nombre del Cliente/Proveedor</label><input id="movCliente" type="text" class="form-input" placeholder="Nombre de la persona..."/></div>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="button" onclick="closeModal('modalMovimiento')" class="btn btn-outline flex-1">Cancelar</button>
        <button type="submit" id="btnGuardarMov" class="btn btn-primary flex-1"><i class="fas fa-save"></i> Guardar</button>
      </div>
    </form>
  </div>
</div>

<!-- Modal Cuadre -->
<div id="modalCuadre" class="modal-overlay hidden" onclick="closeModalIf(event,'modalCuadre')">
  <div class="modal-box">
    <div class="p-6 border-b flex items-center justify-between">
      <h2 class="text-xl font-black text-gray-800"><i class="fas fa-calculator mr-2 text-yellow-500"></i>Cuadre de Caja</h2>
      <button onclick="closeModal('modalCuadre')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-6 space-y-4">
      <div id="resumenCuadre" class="space-y-2 text-sm bg-gray-50 rounded-xl p-4 mb-2"></div>
      <div>
        <label class="form-label text-base">💵 Saldo Físico en Caja (lo que tienes en mano) *</label>
        <input id="saldoFisico" type="number" step="0.01" min="0" class="form-input text-2xl font-bold text-center" placeholder="0.00" oninput="calcularDiferencia()"/>
      </div>
      <div id="resultadoCuadre" class="cuadre-card hidden"></div>
      <div>
        <label class="form-label">Observaciones</label>
        <textarea id="cuadreObs" class="form-input" rows="2" placeholder="Observaciones del cierre..."></textarea>
      </div>
      <div class="flex gap-3">
        <button onclick="closeModal('modalCuadre')" class="btn btn-outline flex-1">Cancelar</button>
        <button onclick="ejecutarCuadre()" class="btn btn-yellow flex-1"><i class="fas fa-check"></i> Confirmar Cuadre</button>
      </div>
    </div>
  </div>
</div>

<!-- Modal Pendiente -->
<div id="modalPendiente" class="modal-overlay hidden" onclick="closeModalIf(event,'modalPendiente')">
  <div class="modal-box">
    <div class="p-6 border-b flex items-center justify-between">
      <h2 id="tituloPendiente" class="text-xl font-black text-gray-800">Nuevo Pendiente</h2>
      <button onclick="closeModal('modalPendiente')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"><i class="fas fa-times"></i></button>
    </div>
    <form id="formPendiente" class="p-6 space-y-4">
      <input type="hidden" id="pendId"/>
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2"><label class="form-label">Nombre del Cliente *</label><input id="pCliente" type="text" class="form-input" required/></div>
        <div><label class="form-label">Cédula del Cliente</label><input id="pCedula" type="text" class="form-input" placeholder="Opcional"/></div>
        <div><label class="form-label">Teléfono</label><input id="pTelefono" type="tel" class="form-input" placeholder="Opcional"/></div>
        <div class="col-span-2"><label class="form-label">Descripción de la Deuda *</label><input id="pDescripcion" type="text" class="form-input" required/></div>
        <div><label class="form-label">Monto Total (USD) *</label><input id="pMonto" type="number" step="0.01" min="0.01" class="form-input" required/></div>
        <div><label class="form-label">Prioridad</label>
          <select id="pPrioridad" class="form-input">
            <option value="baja">🟢 Baja</option>
            <option value="normal" selected>🔵 Normal</option>
            <option value="alta">🟠 Alta</option>
            <option value="urgente">🔴 Urgente</option>
          </select>
        </div>
        <div><label class="form-label">Fecha de Emisión *</label><input id="pFechaEmi" type="date" class="form-input" required/></div>
        <div><label class="form-label">Fecha de Vencimiento *</label><input id="pFechaVen" type="date" class="form-input" required/></div>
        <div class="col-span-2"><label class="form-label">Notas</label><textarea id="pNotas" class="form-input" rows="2" placeholder="Información adicional..."></textarea></div>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="button" onclick="closeModal('modalPendiente')" class="btn btn-outline flex-1">Cancelar</button>
        <button type="submit" class="btn btn-primary flex-1"><i class="fas fa-save"></i> Guardar</button>
      </div>
    </form>
  </div>
</div>

<!-- Modal Pagar Pendiente -->
<div id="modalPagar" class="modal-overlay hidden" onclick="closeModalIf(event,'modalPagar')">
  <div class="modal-box">
    <div class="p-6 border-b flex items-center justify-between">
      <h2 class="text-xl font-black text-gray-800"><i class="fas fa-hand-holding-dollar mr-2 text-green-500"></i>Registrar Pago</h2>
      <button onclick="closeModal('modalPagar')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-6 space-y-4">
      <div id="infoPendientePago" class="bg-blue-50 rounded-xl p-4 text-sm"></div>
      <div>
        <label class="form-label">Monto a Pagar (USD) *</label>
        <input id="pagoMonto" type="number" step="0.01" min="0.01" class="form-input text-2xl font-bold text-center" placeholder="0.00"/>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="form-label">Método de Pago</label>
          <select id="pagoMetodo" class="form-input">
            <option value="efectivo">💵 Efectivo</option>
            <option value="transferencia">📱 Transferencia</option>
            <option value="cheque">📄 Cheque</option>
            <option value="otro">📌 Otro</option>
          </select>
        </div>
        <div><label class="form-label">Referencia</label><input id="pagoRef" type="text" class="form-input" placeholder="N° transacción..."/></div>
      </div>
      <div><label class="form-label">Observaciones</label><textarea id="pagoObs" class="form-input" rows="2" placeholder="..."></textarea></div>
      <div class="flex gap-3">
        <button onclick="closeModal('modalPagar')" class="btn btn-outline flex-1">Cancelar</button>
        <button onclick="ejecutarPago()" class="btn btn-success flex-1"><i class="fas fa-check"></i> Confirmar Pago</button>
      </div>
    </div>
  </div>
</div>

<!-- Modal Trabajador -->
<div id="modalTrabajador" class="modal-overlay hidden" onclick="closeModalIf(event,'modalTrabajador')">
  <div class="modal-box">
    <div class="p-6 border-b flex items-center justify-between">
      <h2 id="tituloTrabajador" class="text-xl font-black text-gray-800">Nuevo Trabajador</h2>
      <button onclick="closeModal('modalTrabajador')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"><i class="fas fa-times"></i></button>
    </div>
    <form id="formTrabajador" class="p-6 space-y-4">
      <input type="hidden" id="trabId"/>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">Cédula *</label><input id="trabCedula" type="text" class="form-input" required/></div>
        <div><label class="form-label">Email</label><input id="trabEmail" type="email" class="form-input"/></div>
        <div><label class="form-label">Nombre *</label><input id="trabNombre" type="text" class="form-input" required/></div>
        <div><label class="form-label">Apellido *</label><input id="trabApellido" type="text" class="form-input" required/></div>
        <div class="col-span-2"><label class="form-label">Contraseña *</label><input id="trabPassword" type="password" class="form-input" placeholder="Mínimo 6 caracteres"/></div>
        <div class="col-span-2">
          <label class="form-label">Color de Avatar</label>
          <div class="flex gap-2 flex-wrap" id="colorPicker">
            <div onclick="selectColor('#1148AD')" class="w-8 h-8 rounded-full cursor-pointer ring-2 ring-offset-2 ring-blue-600" style="background:#1148AD" title="Azul"></div>
            <div onclick="selectColor('#7c3aed')" class="w-8 h-8 rounded-full cursor-pointer" style="background:#7c3aed" title="Morado"></div>
            <div onclick="selectColor('#dc2626')" class="w-8 h-8 rounded-full cursor-pointer" style="background:#dc2626" title="Rojo"></div>
            <div onclick="selectColor('#ea580c')" class="w-8 h-8 rounded-full cursor-pointer" style="background:#ea580c" title="Naranja"></div>
            <div onclick="selectColor('#16a34a')" class="w-8 h-8 rounded-full cursor-pointer" style="background:#16a34a" title="Verde"></div>
            <div onclick="selectColor('#0891b2')" class="w-8 h-8 rounded-full cursor-pointer" style="background:#0891b2" title="Cyan"></div>
            <div onclick="selectColor('#be185d')" class="w-8 h-8 rounded-full cursor-pointer" style="background:#be185d" title="Rosa"></div>
            <div onclick="selectColor('#F5A400')" class="w-8 h-8 rounded-full cursor-pointer" style="background:#F5A400" title="Amarillo"></div>
          </div>
          <input type="hidden" id="trabColor" value="#1148AD"/>
        </div>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="button" onclick="closeModal('modalTrabajador')" class="btn btn-outline flex-1">Cancelar</button>
        <button type="submit" class="btn btn-primary flex-1"><i class="fas fa-save"></i> Guardar</button>
      </div>
    </form>
  </div>
</div>

<script>
// ════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════════════════════════
let TOKEN = localStorage.getItem('pr_token') || '';
let USUARIO = JSON.parse(localStorage.getItem('pr_user') || 'null');
let CAJA_ACTUAL = null;
let MOVIMIENTOS_CAJA = [];
let PENDIENTES_DATA = [];
let PENDIENTE_ACTUAL_ID = null;
let chartFlujo = null;
let chartAdmin = null;
let movFiltroActual = 'todos';
let pendFiltroActual = 'todos';

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  if (!TOKEN) { window.location.href = '/login'; return; }
  const ok = await verificarSesion();
  if (!ok) return;
  initUI();
  loadDashboard();
  loadAlertas();
  setInterval(loadAlertas, 60000);
});

async function verificarSesion() {
  try {
    const r = await api('GET', '/api/auth/me');
    if (!r.ok) { logout(); return false; }
    const data = await r.json();
    USUARIO = data;
    localStorage.setItem('pr_user', JSON.stringify(data));
    return true;
  } catch { logout(); return false; }
}

function initUI() {
  // Fecha
  document.getElementById('fechaHoy').textContent = new Date().toLocaleDateString('es-ES', {weekday:'long',year:'numeric',month:'long',day:'numeric'});
  // Sidebar usuario
  const ini = (USUARIO?.nombre?.[0] || '?').toUpperCase();
  document.getElementById('userAvatar').textContent = ini;
  document.getElementById('userAvatar').style.background = USUARIO?.avatar_color || '#F5A400';
  document.getElementById('userName').textContent = USUARIO ? USUARIO.nombre + ' ' + USUARIO.apellido : '';
  document.getElementById('userRol').textContent = USUARIO?.rol === 'admin' ? '⚙️ Administrador' : '👤 Trabajador';
  if (USUARIO?.rol === 'admin') document.getElementById('adminNav').classList.remove('hidden');
  // Perfil
  loadPerfil();
  // Fechas por defecto para filtros
  const hoy = new Date().toISOString().split('T')[0];
  const hace30 = new Date(Date.now()-30*86400000).toISOString().split('T')[0];
  document.getElementById('filtroFechaIni').value = hace30;
  document.getElementById('filtroFechaFin').value = hoy;
  document.getElementById('repFechaIni').value = hace30;
  document.getElementById('repFechaFin').value = hoy;
  const hoyD = document.getElementById('pFechaEmi');
  if(hoyD) hoyD.value = hoy;
  // Form listeners
  document.getElementById('formMovimiento').addEventListener('submit', guardarMovimiento);
  document.getElementById('formPendiente').addEventListener('submit', guardarPendiente);
  document.getElementById('formTrabajador').addEventListener('submit', guardarTrabajador);
  document.getElementById('formPassword').addEventListener('submit', cambiarPassword);
}

// ════════════════════════════════════════════════════════════════
// API HELPER
// ════════════════════════════════════════════════════════════════
async function api(method, url, body = null) {
  const opts = { method, headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts);
}

// ════════════════════════════════════════════════════════════════
// NAVEGACIÓN
// ════════════════════════════════════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  const nav = document.getElementById('nav-' + name);
  if (page) page.classList.add('active');
  if (nav) nav.classList.add('active');
  // Cerrar sidebar en móvil
  document.getElementById('sidebar').classList.remove('open');
  // Cargar datos de la página
  if (name === 'dashboard') loadDashboard();
  else if (name === 'caja') loadCaja();
  else if (name === 'movimientos') loadMovimientos();
  else if (name === 'pendientes') loadPendientes();
  else if (name === 'admin') loadAdmin();
  else if (name === 'trabajadores') loadTrabajadores();
  else if (name === 'alertas') loadAlertas();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ════════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════════
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  t.className = \`toast toast-\${type} show\`;
  t.innerHTML = \`<i class="fas \${icons[type]}"></i><span>\${msg}</span>\`;
  setTimeout(() => t.className = 'toast', 3500);
}

// ════════════════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════════════════
const fmt = (v) => '\$' + Number(v || 0).toLocaleString('es-US', {minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {day:'2-digit',month:'short',year:'numeric'}) : '–';
const estadoBadge = (e) => {
  const map = { abierta:'badge-blue', cuadrada:'badge-yellow', aprobada:'badge-green', rechazada:'badge-red',
                pendiente:'badge-yellow', parcial:'badge-orange', pagado:'badge-green', vencido:'badge-red', anulado:'badge-gray' };
  const label = { abierta:'Abierta', cuadrada:'Por Aprobar', aprobada:'Aprobada', rechazada:'Rechazada',
                  pendiente:'Pendiente', parcial:'Parcial', pagado:'Pagado', vencido:'Vencido', anulado:'Anulado' };
  return \`<span class="badge \${map[e]||'badge-gray'}">\${label[e]||e}</span>\`;
};
const prioridadBadge = (p) => {
  const map = { baja:'badge-gray', normal:'badge-blue', alta:'badge-orange', urgente:'badge-red' };
  const icons = { baja:'🟢', normal:'🔵', alta:'🟠', urgente:'🔴' };
  return \`<span class="badge \${map[p]||'badge-gray'}">\${icons[p]||''} \${p}</span>\`;
};

function diasRestantes(fechaVen) {
  const dias = Math.ceil((new Date(fechaVen+'T00:00:00') - new Date()) / 86400000);
  if (dias < 0) return \`<span class="text-red-600 font-bold">Vencido hace \${Math.abs(dias)}d</span>\`;
  if (dias === 0) return \`<span class="text-red-500 font-bold">Vence hoy</span>\`;
  if (dias <= 3) return \`<span class="text-yellow-600 font-bold">\${dias}d para vencer</span>\`;
  return \`<span class="text-gray-500">\${dias} días</span>\`;
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    // Caja de hoy
    const rCaja = await api('GET', '/api/cajas/hoy');
    if (rCaja.ok) {
      const { caja } = await rCaja.json();
      CAJA_ACTUAL = caja;
      const saldo = Number(caja.saldo_inicial) + Number(caja.total_ingresos||0) - Number(caja.total_egresos||0);
      document.getElementById('stat-ingresos').textContent = fmt(caja.total_ingresos);
      document.getElementById('stat-ingresos-mov').textContent = caja.num_movimientos + ' movimientos';
      document.getElementById('stat-egresos').textContent = fmt(caja.total_egresos);
      document.getElementById('stat-saldo').textContent = fmt(saldo);
      document.getElementById('stat-caja-estado').innerHTML = estadoBadge(caja.estado);
    }
    // Pendientes
    const rPend = await api('GET', '/api/pendientes/resumen');
    if (rPend.ok) {
      const { resumen } = await rPend.json();
      document.getElementById('stat-pendientes').textContent = fmt(resumen.monto_por_cobrar);
      document.getElementById('stat-pendientes-count').textContent = (resumen.cant_pendientes||0) + ' pendientes activos';
    }
    // Tendencia
    const rSem = await api('GET', '/api/cajas/resumen/semana');
    if (rSem.ok) {
      const { semana } = await rSem.json();
      renderChartFlujo(semana);
    }
    // Últimos movimientos
    const rMov = await api('GET', '/api/movimientos?limit=8');
    if (rMov.ok) {
      const { movimientos } = await rMov.json();
      renderUltimosMovimientos(movimientos);
    }
    // Próximos a vencer
    const rVenc = await api('GET', '/api/pendientes?limit=5');
    if (rVenc.ok) {
      const { pendientes } = await rVenc.json();
      renderProximosVencer(pendientes.filter(p => p.estado !== 'pagado' && p.estado !== 'anulado').slice(0,5));
    }
  } catch(e) { console.error('Dashboard error:', e); }
}

function renderChartFlujo(datos) {
  const ctx = document.getElementById('chartFlujo');
  if (!ctx) return;
  if (chartFlujo) chartFlujo.destroy();
  chartFlujo = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: datos.map(d => fmtDate(d.fecha)),
      datasets: [
        { label: 'Ingresos', data: datos.map(d => d.ingresos), backgroundColor: 'rgba(17,72,173,0.8)', borderRadius: 6 },
        { label: 'Egresos', data: datos.map(d => d.egresos), backgroundColor: 'rgba(220,38,38,0.7)', borderRadius: 6 }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '\$'+v } } } }
  });
}

function renderProximosVencer(pends) {
  const el = document.getElementById('proximosVencer');
  if (!pends.length) { el.innerHTML = '<div class="text-center text-gray-400 py-4"><i class="fas fa-check-circle text-2xl mb-2 text-green-400"></i><br>¡Sin vencimientos próximos!</div>'; return; }
  el.innerHTML = pends.map(p => \`
    <div class="p-3 rounded-xl border \${Number(p.esta_vencido) ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}">
      <div class="font-semibold text-gray-800 text-xs truncate">\${p.cliente_nombre}</div>
      <div class="flex justify-between items-center mt-1">
        <span class="text-xs font-bold" style="color:#1148AD">\${fmt(p.monto_pendiente)}</span>
        <span class="text-xs">\${diasRestantes(p.fecha_vencimiento)}</span>
      </div>
    </div>
  \`).join('');
}

function renderUltimosMovimientos(movs) {
  const el = document.getElementById('ultimosMovimientos');
  if (!movs.length) { el.innerHTML = '<div class="text-center text-gray-400 py-8"><i class="fas fa-inbox text-3xl mb-2"></i><br>Sin movimientos aún</div>'; return; }
  el.innerHTML = \`<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="border-b text-xs text-gray-500 uppercase">
      <th class="pb-2 text-left">Descripción</th><th class="pb-2 text-left">Categoría</th>
      <th class="pb-2 text-right">Monto</th><th class="pb-2 text-center">Tipo</th>
    </tr></thead>
    <tbody>\${movs.map(m => \`<tr class="table-row border-b last:border-0">
      <td class="py-2.5 font-medium text-gray-800">\${m.descripcion}</td>
      <td class="py-2.5 text-gray-500 text-xs">\${m.categoria}</td>
      <td class="py-2.5 text-right font-bold \${m.tipo==='ingreso'?'text-green-600':'text-red-600'}">\${m.tipo==='ingreso'?'+':'-'}\${fmt(m.monto)}</td>
      <td class="py-2.5 text-center">\${m.tipo==='ingreso'?'<span class="badge badge-green">Ingreso</span>':'<span class="badge badge-red">Egreso</span>'}</td>
    </tr>\`).join('')}</tbody>
  </table></div>\`;
}

// ════════════════════════════════════════════════════════════════
// MI CAJA
// ════════════════════════════════════════════════════════════════
async function loadCaja() {
  try {
    const r = await api('GET', '/api/cajas/hoy');
    if (!r.ok) { showToast('Error cargando caja', 'error'); return; }
    const { caja } = await r.json();
    CAJA_ACTUAL = caja;

    const saldo = Number(caja.saldo_inicial) + Number(caja.total_ingresos||0) - Number(caja.total_egresos||0);
    document.getElementById('cajaSaldoInicial').textContent = fmt(caja.saldo_inicial);
    document.getElementById('cajaSaldoActual').textContent = fmt(saldo);
    document.getElementById('cajaEstado').innerHTML = estadoBadge(caja.estado);

    // Botón cuadre
    const btnC = document.getElementById('btnCuadre');
    if (btnC) { btnC.disabled = caja.estado !== 'abierta'; btnC.style.opacity = caja.estado !== 'abierta' ? '0.5' : '1'; }

    // Movimientos de la caja
    const rm = await api('GET', '/api/cajas/' + caja.id);
    if (rm.ok) {
      const data = await rm.json();
      MOVIMIENTOS_CAJA = data.movimientos || [];
      renderMovimientosCaja(MOVIMIENTOS_CAJA);
      // Totales
      const ingresos = MOVIMIENTOS_CAJA.filter(m=>m.tipo==='ingreso'&&!m.anulado).reduce((s,m)=>s+Number(m.monto),0);
      const egresos = MOVIMIENTOS_CAJA.filter(m=>m.tipo==='egreso'&&!m.anulado).reduce((s,m)=>s+Number(m.monto),0);
      document.getElementById('totalIngCaja').textContent = fmt(ingresos);
      document.getElementById('totalEgCaja').textContent = fmt(egresos);
      document.getElementById('totalNetoCaja').textContent = fmt(ingresos - egresos);
      document.getElementById('totalMovCaja').textContent = MOVIMIENTOS_CAJA.filter(m=>!m.anulado).length;
    }
  } catch(e) { console.error(e); showToast('Error cargando caja', 'error'); }
}

function filterMovCaja(tipo) {
  movFiltroActual = tipo;
  document.querySelectorAll('[id^="tab-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tipo)?.classList.add('active');
  const filtrados = tipo === 'todos' ? MOVIMIENTOS_CAJA : MOVIMIENTOS_CAJA.filter(m => m.tipo === tipo);
  renderMovimientosCaja(filtrados);
}

function renderMovimientosCaja(movs) {
  const el = document.getElementById('movimientosCaja');
  if (!movs.length) { el.innerHTML = '<div class="text-center py-12 text-gray-400"><i class="fas fa-receipt text-4xl mb-3"></i><br><p class="font-semibold">Sin movimientos aún</p><p class="text-sm mt-1">Registra tu primer ingreso o egreso</p></div>'; return; }
  el.innerHTML = movs.map(m => \`
    <div class="flex items-center gap-3 p-3 rounded-xl border \${m.anulado ? 'opacity-50 bg-gray-50 border-gray-200' : 'bg-white border-gray-100 hover:border-blue-100'} transition-all">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 \${m.tipo==='ingreso'?'bg-green-100':'bg-red-100'}">
        <i class="fas \${m.tipo==='ingreso'?'fa-arrow-down text-green-600':'fa-arrow-up text-red-600'}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-gray-800 text-sm truncate">\${m.descripcion} \${m.anulado?'<span class="badge badge-gray ml-1">Anulado</span>':''}</div>
        <div class="text-xs text-gray-500">\${m.categoria} \${m.cliente_nombre?'· '+m.cliente_nombre:''}</div>
      </div>
      <div class="text-right flex-shrink-0">
        <div class="font-black \${m.tipo==='ingreso'?'text-green-600':'text-red-600'}">\${m.tipo==='ingreso'?'+':'-'}\${fmt(m.monto)}</div>
        <div class="text-xs text-gray-400">\${new Date(m.fecha_movimiento).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      \${!m.anulado && CAJA_ACTUAL?.estado === 'abierta' ? \`<button onclick="anularMovimiento(\${m.id})" class="ml-2 w-7 h-7 rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-gray-400 text-xs transition-all" title="Anular"><i class="fas fa-trash"></i></button>\` : ''}
    </div>
  \`).join('');
}

// ════════════════════════════════════════════════════════════════
// MOVIMIENTO MODAL
// ════════════════════════════════════════════════════════════════
async function openModalMovimiento(tipo) {
  if (!CAJA_ACTUAL || CAJA_ACTUAL.estado !== 'abierta') {
    showToast('La caja está cerrada. No puedes agregar movimientos.', 'error'); return;
  }
  document.getElementById('movTipo').value = tipo;
  document.getElementById('modalMovTitulo').innerHTML = tipo === 'ingreso' ?
    '<i class="fas fa-arrow-down text-green-500 mr-2"></i>Nuevo Ingreso' :
    '<i class="fas fa-arrow-up text-red-500 mr-2"></i>Nuevo Egreso';
  document.getElementById('btnGuardarMov').className = tipo === 'ingreso' ? 'btn btn-success flex-1' : 'btn btn-danger flex-1';
  document.getElementById('formMovimiento').reset();
  document.getElementById('movTipo').value = tipo;
  // Cargar categorías
  const r = await api('GET', '/api/movimientos/categorias?tipo=' + tipo);
  if (r.ok) {
    const { categorias } = await r.json();
    document.getElementById('movCategoria').innerHTML = categorias.map(c => \`<option value="\${c.nombre}">\${c.nombre}</option>\`).join('');
  }
  document.getElementById('modalMovimiento').classList.remove('hidden');
}

async function guardarMovimiento(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarMov');
  btn.disabled = true; btn.innerHTML = '<span class="loading-spin"></span> Guardando...';
  try {
    const r = await api('POST', '/api/movimientos', {
      caja_id: CAJA_ACTUAL.id,
      tipo: document.getElementById('movTipo').value,
      categoria: document.getElementById('movCategoria').value,
      descripcion: document.getElementById('movDescripcion').value,
      monto: document.getElementById('movMonto').value,
      referencia: document.getElementById('movReferencia').value,
      cliente_nombre: document.getElementById('movCliente').value
    });
    const data = await r.json();
    if (r.ok) {
      closeModal('modalMovimiento');
      showToast('Movimiento registrado correctamente', 'success');
      loadCaja(); loadDashboard();
    } else { showToast(data.error || 'Error al guardar', 'error'); }
  } catch { showToast('Error de conexión', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
}

async function anularMovimiento(id) {
  if (!confirm('¿Seguro que deseas anular este movimiento?')) return;
  const r = await api('DELETE', '/api/movimientos/' + id, { motivo: 'Anulado por el usuario' });
  if (r.ok) { showToast('Movimiento anulado', 'info'); loadCaja(); }
  else { const d = await r.json(); showToast(d.error || 'Error al anular', 'error'); }
}

// ════════════════════════════════════════════════════════════════
// CUADRE MODAL
// ════════════════════════════════════════════════════════════════
function openModalCuadre() {
  if (!CAJA_ACTUAL || CAJA_ACTUAL.estado !== 'abierta') {
    showToast('La caja no está disponible para cuadre', 'error'); return;
  }
  const ingresos = MOVIMIENTOS_CAJA.filter(m=>m.tipo==='ingreso'&&!m.anulado).reduce((s,m)=>s+Number(m.monto),0);
  const egresos = MOVIMIENTOS_CAJA.filter(m=>m.tipo==='egreso'&&!m.anulado).reduce((s,m)=>s+Number(m.monto),0);
  const saldoEsperado = Number(CAJA_ACTUAL.saldo_inicial) + ingresos - egresos;
  document.getElementById('resumenCuadre').innerHTML = \`
    <div class="grid grid-cols-2 gap-2 text-sm">
      <div class="flex justify-between"><span class="text-gray-600">Saldo inicial:</span><span class="font-bold">\${fmt(CAJA_ACTUAL.saldo_inicial)}</span></div>
      <div class="flex justify-between"><span class="text-gray-600">+ Ingresos:</span><span class="font-bold text-green-600">+\${fmt(ingresos)}</span></div>
      <div class="flex justify-between"><span class="text-gray-600">- Egresos:</span><span class="font-bold text-red-600">-\${fmt(egresos)}</span></div>
      <div class="flex justify-between border-t pt-2"><span class="font-bold text-gray-700">Saldo esperado:</span><span class="font-black" style="color:#1148AD">\${fmt(saldoEsperado)}</span></div>
    </div>
  \`;
  document.getElementById('saldoFisico').value = '';
  document.getElementById('resultadoCuadre').classList.add('hidden');
  document.getElementById('cuadreObs').value = '';
  document.getElementById('modalCuadre').classList.remove('hidden');
}

function calcularDiferencia() {
  const ingresos = MOVIMIENTOS_CAJA.filter(m=>m.tipo==='ingreso'&&!m.anulado).reduce((s,m)=>s+Number(m.monto),0);
  const egresos = MOVIMIENTOS_CAJA.filter(m=>m.tipo==='egreso'&&!m.anulado).reduce((s,m)=>s+Number(m.monto),0);
  const saldoEsperado = Number(CAJA_ACTUAL.saldo_inicial) + ingresos - egresos;
  const saldoFisico = Number(document.getElementById('saldoFisico').value);
  if (isNaN(saldoFisico)) return;
  const diferencia = saldoFisico - saldoEsperado;
  const div = document.getElementById('resultadoCuadre');
  div.classList.remove('hidden');
  if (diferencia === 0) {
    div.className = 'cuadre-card ok';
    div.innerHTML = '<div class="flex items-center gap-2 text-green-700 font-bold"><i class="fas fa-check-circle text-2xl"></i> ¡Caja cuadrada perfectamente! Diferencia: $0.00</div>';
  } else if (Math.abs(diferencia) <= 5) {
    div.className = 'cuadre-card warn';
    div.innerHTML = \`<div class="flex items-center gap-2 font-bold" style="color:#ca8a04"><i class="fas fa-exclamation-triangle text-2xl"></i> Diferencia menor: \${fmt(diferencia)} (dentro del margen permitido)</div>\`;
  } else {
    div.className = 'cuadre-card danger';
    div.innerHTML = \`<div class="flex items-center gap-2 text-red-700 font-bold"><i class="fas fa-times-circle text-2xl"></i> Diferencia significativa: \${fmt(diferencia)}</div><p class="text-sm text-red-600 mt-1">Se notificará al administrador.</p>\`;
  }
}

async function ejecutarCuadre() {
  const saldoFisico = Number(document.getElementById('saldoFisico').value);
  if (!saldoFisico && saldoFisico !== 0) { showToast('Ingresa el saldo físico en caja', 'error'); return; }
  if (!confirm('¿Confirmar el cuadre de caja? Esta acción no se puede deshacer.')) return;
  const r = await api('POST', '/api/cajas/cuadre', {
    caja_id: CAJA_ACTUAL.id, saldo_fisico: saldoFisico,
    observaciones: document.getElementById('cuadreObs').value
  });
  const data = await r.json();
  if (r.ok) {
    closeModal('modalCuadre');
    showToast('¡Caja cuadrada correctamente! Esperando aprobación del administrador.', 'success');
    loadCaja(); loadDashboard();
  } else { showToast(data.error || 'Error al cuadrar', 'error'); }
}

// ════════════════════════════════════════════════════════════════
// MOVIMIENTOS HISTORIAL
// ════════════════════════════════════════════════════════════════
let movsTodos = [];
async function loadMovimientos() {
  const fi = document.getElementById('filtroFechaIni').value;
  const ff = document.getElementById('filtroFechaFin').value;
  let url = '/api/movimientos?limit=200';
  if (fi) url += '&fecha_inicio=' + fi;
  if (ff) url += '&fecha_fin=' + ff;
  const r = await api('GET', url);
  if (!r.ok) { showToast('Error cargando movimientos', 'error'); return; }
  const { movimientos } = await r.json();
  movsTodos = movimientos;
  filtrarMovTipo('todos');
}

function filtrarMovTipo(tipo) {
  document.querySelectorAll('[id^="mvtab-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('mvtab-' + tipo)?.classList.add('active');
  const filtrados = tipo === 'todos' ? movsTodos : movsTodos.filter(m => m.tipo === tipo);
  renderTablaMovimientos(filtrados);
}

function renderTablaMovimientos(movs) {
  const el = document.getElementById('tablaMovimientos');
  if (!movs.length) { el.innerHTML = '<div class="text-center py-12 text-gray-400"><i class="fas fa-inbox text-4xl mb-3"></i><br>Sin movimientos en el período</div>'; return; }
  el.innerHTML = \`<table class="w-full text-sm">
    <thead class="bg-gray-50"><tr>
      <th class="p-3 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
      <th class="p-3 text-left text-xs font-bold text-gray-500 uppercase">Descripción</th>
      <th class="p-3 text-left text-xs font-bold text-gray-500 uppercase">Categoría</th>
      <th class="p-3 text-left text-xs font-bold text-gray-500 uppercase">Cliente</th>
      <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Monto</th>
      <th class="p-3 text-center text-xs font-bold text-gray-500 uppercase">Tipo</th>
    </tr></thead>
    <tbody class="divide-y divide-gray-100">\${movs.map(m => \`<tr class="table-row \${m.anulado ? 'opacity-50' : ''}">
      <td class="p-3 text-gray-500 whitespace-nowrap">\${new Date(m.fecha_movimiento).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
      <td class="p-3 font-medium text-gray-800">\${m.descripcion} \${m.anulado ? '<span class="badge badge-gray ml-1">Anulado</span>' : ''}</td>
      <td class="p-3 text-gray-500">\${m.categoria}</td>
      <td class="p-3 text-gray-500">\${m.cliente_nombre || '–'}</td>
      <td class="p-3 text-right font-black \${m.tipo==='ingreso'?'text-green-600':'text-red-600'}">\${m.tipo==='ingreso'?'+':'-'}\${fmt(m.monto)}</td>
      <td class="p-3 text-center">\${m.tipo==='ingreso'?'<span class="badge badge-green">Ingreso</span>':'<span class="badge badge-red">Egreso</span>'}</td>
    </tr>\`).join('')}</tbody>
  </table>\`;
}

// ════════════════════════════════════════════════════════════════
// PENDIENTES
// ════════════════════════════════════════════════════════════════
async function loadPendientes() {
  const [rPend, rRes] = await Promise.all([
    api('GET', '/api/pendientes?limit=200'),
    api('GET', '/api/pendientes/resumen')
  ]);
  if (rPend.ok) { const { pendientes } = await rPend.json(); PENDIENTES_DATA = pendientes; }
  if (rRes.ok) {
    const { resumen } = await rRes.json();
    document.getElementById('pend-total').textContent = fmt(resumen.monto_por_cobrar);
    document.getElementById('pend-vencidos').textContent = resumen.cant_vencidos || 0;
    document.getElementById('pend-cobrados').textContent = fmt(resumen.monto_cobrado);
    document.getElementById('pend-activos').textContent = resumen.cant_pendientes || 0;
    document.getElementById('badge-vencidos').textContent = resumen.cant_vencidos || 0;
  }
  filtrarPendientes('todos');
}

function filtrarPendientes(filtro) {
  pendFiltroActual = filtro;
  document.querySelectorAll('[id^="ptab-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('ptab-' + filtro)?.classList.add('active');
  let lista = PENDIENTES_DATA;
  if (filtro === 'vencidos') lista = lista.filter(p => new Date(p.fecha_vencimiento+'T00:00:00') < new Date() && !['pagado','anulado'].includes(p.estado));
  else if (filtro !== 'todos') lista = lista.filter(p => p.estado === filtro);
  renderTablaPendientes(lista);
}

function renderTablaPendientes(pends) {
  const el = document.getElementById('tablaPendientes');
  if (!pends.length) { el.innerHTML = '<div class="card p-16 text-center text-gray-400"><i class="fas fa-check-circle text-5xl mb-3 text-green-400"></i><br><p class="font-semibold">¡Sin pendientes en esta categoría!</p></div>'; return; }
  el.innerHTML = \`<div class="space-y-3">\${pends.map(p => {
    const venc = Number(p.esta_vencido);
    return \`<div class="card p-4 \${venc ? 'vencido-row border-l-4 border-red-400' : p.prioridad === 'urgente' ? 'urgente-row border-l-4 border-orange-400' : ''}">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-black text-gray-800">\${p.cliente_nombre}</span>
            \${estadoBadge(p.estado)} \${prioridadBadge(p.prioridad)}
            \${venc ? '<span class="badge badge-red"><i class="fas fa-exclamation-triangle mr-1"></i>VENCIDO</span>' : ''}
          </div>
          <p class="text-sm text-gray-600 mt-1">\${p.descripcion}</p>
          <div class="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
            \${p.cliente_cedula ? \`<span><i class="fas fa-id-card mr-1"></i>\${p.cliente_cedula}</span>\` : ''}
            \${p.cliente_telefono ? \`<span><i class="fas fa-phone mr-1"></i>\${p.cliente_telefono}</span>\` : ''}
            <span><i class="fas fa-calendar mr-1"></i>Emitido: \${fmtDate(p.fecha_emision)}</span>
            <span><i class="fas fa-clock mr-1"></i>Vence: \${fmtDate(p.fecha_vencimiento)}</span>
            <span>\${diasRestantes(p.fecha_vencimiento)}</span>
          </div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-2xl font-black" style="color:#1148AD">\${fmt(p.monto_pendiente)}</div>
          <div class="text-xs text-gray-500">de \${fmt(p.monto_total)}</div>
          \${p.monto_pagado > 0 ? \`<div class="mt-1 progress-bar w-28 ml-auto"><div class="progress-fill" style="width:\${Math.min(100,(p.monto_pagado/p.monto_total*100)).toFixed(0)}%"></div></div>\` : ''}
          <div class="flex gap-1 mt-2 justify-end">
            \${!['pagado','anulado'].includes(p.estado) ? \`<button onclick="openModalPagar(\${p.id})" class="btn btn-success btn-sm"><i class="fas fa-hand-holding-dollar"></i> Cobrar</button>\` : ''}
            <button onclick="openModalPendiente(\${p.id})" class="btn btn-outline btn-sm"><i class="fas fa-edit"></i></button>
          </div>
        </div>
      </div>
    </div>\`;
  }).join('')}</div>\`;
}

function openModalPendiente(id = null) {
  document.getElementById('tituloPendiente').textContent = id ? 'Editar Pendiente' : 'Nuevo Pendiente';
  document.getElementById('formPendiente').reset();
  document.getElementById('pendId').value = id || '';
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('pFechaEmi').value = hoy;
  if (id) {
    const p = PENDIENTES_DATA.find(x => x.id == id);
    if (p) {
      document.getElementById('pCliente').value = p.cliente_nombre;
      document.getElementById('pCedula').value = p.cliente_cedula || '';
      document.getElementById('pTelefono').value = p.cliente_telefono || '';
      document.getElementById('pDescripcion').value = p.descripcion;
      document.getElementById('pMonto').value = p.monto_total;
      document.getElementById('pPrioridad').value = p.prioridad;
      document.getElementById('pFechaEmi').value = p.fecha_emision;
      document.getElementById('pFechaVen').value = p.fecha_vencimiento;
      document.getElementById('pNotas').value = p.notas || '';
    }
  }
  document.getElementById('modalPendiente').classList.remove('hidden');
}

async function guardarPendiente(e) {
  e.preventDefault();
  const id = document.getElementById('pendId').value;
  const body = {
    cliente_nombre: document.getElementById('pCliente').value,
    cliente_cedula: document.getElementById('pCedula').value,
    cliente_telefono: document.getElementById('pTelefono').value,
    descripcion: document.getElementById('pDescripcion').value,
    monto_total: document.getElementById('pMonto').value,
    prioridad: document.getElementById('pPrioridad').value,
    fecha_emision: document.getElementById('pFechaEmi').value,
    fecha_vencimiento: document.getElementById('pFechaVen').value,
    notas: document.getElementById('pNotas').value
  };
  const method = id ? 'PUT' : 'POST';
  const url = id ? '/api/pendientes/' + id : '/api/pendientes';
  const r = await api(method, url, body);
  const data = await r.json();
  if (r.ok) {
    closeModal('modalPendiente');
    showToast(id ? 'Pendiente actualizado' : 'Pendiente creado correctamente', 'success');
    loadPendientes();
  } else { showToast(data.error || 'Error al guardar', 'error'); }
}

function openModalPagar(id) {
  PENDIENTE_ACTUAL_ID = id;
  const p = PENDIENTES_DATA.find(x => x.id == id);
  if (!p) return;
  document.getElementById('infoPendientePago').innerHTML = \`
    <div class="font-bold text-blue-800 mb-1">\${p.cliente_nombre}</div>
    <div class="text-gray-600 text-xs">\${p.descripcion}</div>
    <div class="flex justify-between mt-2">
      <span class="text-gray-600">Monto pendiente:</span>
      <span class="font-black" style="color:#1148AD">\${fmt(p.monto_pendiente)}</span>
    </div>
  \`;
  document.getElementById('pagoMonto').value = p.monto_pendiente;
  document.getElementById('pagoMetodo').value = 'efectivo';
  document.getElementById('pagoRef').value = '';
  document.getElementById('pagoObs').value = '';
  document.getElementById('modalPagar').classList.remove('hidden');
}

async function ejecutarPago() {
  const monto = Number(document.getElementById('pagoMonto').value);
  if (!monto || monto <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
  const body = {
    monto, metodo_pago: document.getElementById('pagoMetodo').value,
    referencia: document.getElementById('pagoRef').value,
    observaciones: document.getElementById('pagoObs').value,
    caja_id: CAJA_ACTUAL?.id || null
  };
  const r = await api('POST', '/api/pendientes/' + PENDIENTE_ACTUAL_ID + '/pagar', body);
  const data = await r.json();
  if (r.ok) {
    closeModal('modalPagar');
    showToast('¡Pago registrado exitosamente!', 'success');
    loadPendientes(); loadCaja();
  } else { showToast(data.error || 'Error al registrar pago', 'error'); }
}

// ════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ════════════════════════════════════════════════════════════════
async function loadAdmin() {
  const r = await api('GET', '/api/admin/dashboard');
  if (!r.ok) { showToast('Error cargando panel admin', 'error'); return; }
  const data = await r.json();

  document.getElementById('adm-ingresos').textContent = fmt(data.resumenHoy?.ingresos_hoy);
  document.getElementById('adm-egresos').textContent = fmt(data.resumenHoy?.egresos_hoy);
  document.getElementById('adm-por-aprobar').textContent = data.resumenHoy?.cajas_por_aprobar || 0;
  document.getElementById('adm-vencidos').textContent = data.resumenPendientes?.vencidos || 0;
  document.getElementById('badgePorAprobar').textContent = data.resumenHoy?.cajas_por_aprobar || 0;

  // Tabla trabajadores hoy
  renderAdminTrabajadores(data.trabajadores || []);

  // Cajas por aprobar
  const rCajas = await api('GET', '/api/admin/cajas-pendientes');
  if (rCajas.ok) { const { cajas } = await rCajas.json(); renderCajasAprobar(cajas); }

  // Gráfica
  if (data.tendencia) renderChartAdmin(data.tendencia);
}

function renderAdminTrabajadores(trabajadores) {
  const el = document.getElementById('adminTrabajadoresHoy');
  if (!trabajadores.length) { el.innerHTML = '<div class="text-center py-6 text-gray-400">Sin trabajadores registrados</div>'; return; }
  el.innerHTML = \`<table class="w-full text-sm">
    <thead class="bg-gray-50"><tr>
      <th class="p-3 text-left text-xs font-bold text-gray-500 uppercase">Trabajador</th>
      <th class="p-3 text-center text-xs font-bold text-gray-500 uppercase">Estado Caja</th>
      <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Ingresos</th>
      <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Egresos</th>
      <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Movs.</th>
      <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Pendientes</th>
      <th class="p-3 text-center text-xs font-bold text-gray-500 uppercase">Diferencia</th>
    </tr></thead>
    <tbody class="divide-y divide-gray-100">\${trabajadores.map(t => \`<tr class="table-row">
      <td class="p-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:\${t.avatar_color||'#1148AD'}">\${t.nombre[0]}\${t.apellido[0]}</div>
          <div><div class="font-semibold text-gray-800">\${t.nombre} \${t.apellido}</div><div class="text-xs text-gray-400">\${t.cedula}</div></div>
        </div>
      </td>
      <td class="p-3 text-center">\${t.caja_estado ? estadoBadge(t.caja_estado) : '<span class="badge badge-gray">Sin caja</span>'}</td>
      <td class="p-3 text-right font-bold text-green-600">\${fmt(t.ingresos)}</td>
      <td class="p-3 text-right font-bold text-red-600">\${fmt(t.egresos)}</td>
      <td class="p-3 text-right text-gray-600">\${t.movimientos}</td>
      <td class="p-3 text-right"><span class="font-bold" style="color:#F5A400">\${t.pendientes_activos}</span><span class="text-gray-400 text-xs"> (\${fmt(t.monto_pendiente)})</span></td>
      <td class="p-3 text-center">\${t.diferencia !== null && t.diferencia !== undefined ? \`<span class="\${Math.abs(t.diferencia) > 5 ? 'text-red-600 font-bold' : 'text-gray-500'}">\${fmt(t.diferencia)}</span>\` : '–'}</td>
    </tr>\`).join('')}</tbody>
  </table>\`;
}

function renderCajasAprobar(cajas) {
  const el = document.getElementById('cajasAprobar');
  if (!cajas.length) { el.innerHTML = '<div class="text-center py-6 text-gray-400"><i class="fas fa-check-double text-2xl mb-2 text-green-400"></i><br>No hay cajas pendientes de aprobación</div>'; return; }
  el.innerHTML = \`<div class="space-y-3">\${cajas.map(c => \`<div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-yellow-200 bg-yellow-50">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background:\${c.avatar_color||'#1148AD'}">\${c.trabajador_nombre.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
      <div>
        <div class="font-bold text-gray-800">\${c.trabajador_nombre}</div>
        <div class="text-xs text-gray-500">Fecha: \${fmtDate(c.fecha)} · \${c.movimientos} movimientos</div>
      </div>
    </div>
    <div class="flex items-center gap-4 text-sm">
      <div><span class="text-gray-500">Ingresos:</span> <span class="font-bold text-green-600">\${fmt(c.ingresos)}</span></div>
      <div><span class="text-gray-500">Egresos:</span> <span class="font-bold text-red-600">\${fmt(c.egresos)}</span></div>
      <div><span class="text-gray-500">Diferencia:</span> <span class="font-bold \${Math.abs(c.diferencia||0) > 5 ? 'text-red-600' : 'text-green-600'}">\${fmt(c.diferencia)}</span></div>
      <div class="flex gap-2">
        <button onclick="aprobarCaja(\${c.id})" class="btn btn-success btn-sm"><i class="fas fa-check"></i> Aprobar</button>
        <button onclick="rechazarCaja(\${c.id})" class="btn btn-danger btn-sm"><i class="fas fa-times"></i> Rechazar</button>
      </div>
    </div>
  </div>\`).join('')}</div>\`;
}

async function aprobarCaja(id) {
  if (!confirm('¿Aprobar este cuadre de caja?')) return;
  const r = await api('POST', '/api/cajas/' + id + '/aprobar', { observaciones: 'Aprobado desde panel admin' });
  if (r.ok) { showToast('Caja aprobada correctamente', 'success'); loadAdmin(); }
  else { const d = await r.json(); showToast(d.error || 'Error', 'error'); }
}

async function rechazarCaja(id) {
  const motivo = prompt('Motivo del rechazo:');
  if (!motivo) return;
  const r = await api('POST', '/api/cajas/' + id + '/rechazar', { motivo });
  if (r.ok) { showToast('Caja rechazada', 'info'); loadAdmin(); }
  else { const d = await r.json(); showToast(d.error || 'Error', 'error'); }
}

function renderChartAdmin(tendencia) {
  const ctx = document.getElementById('chartAdmin');
  if (!ctx) return;
  if (chartAdmin) chartAdmin.destroy();
  chartAdmin = new Chart(ctx, {
    type: 'line',
    data: {
      labels: tendencia.map(d => fmtDate(d.fecha)),
      datasets: [
        { label: 'Ingresos', data: tendencia.map(d => d.ingresos), borderColor: '#1148AD', backgroundColor: 'rgba(17,72,173,0.1)', tension: 0.4, fill: true },
        { label: 'Egresos', data: tendencia.map(d => d.egresos), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.08)', tension: 0.4, fill: true }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '\$'+v } } } }
  });
}

// ════════════════════════════════════════════════════════════════
// TRABAJADORES (ADMIN)
// ════════════════════════════════════════════════════════════════
let trabajadoresData = [];
async function loadTrabajadores() {
  const r = await api('GET', '/api/admin/trabajadores');
  if (!r.ok) return;
  const { trabajadores } = await r.json();
  trabajadoresData = trabajadores;
  renderTablaTrabajadores(trabajadores);
}

function renderTablaTrabajadores(lista) {
  const el = document.getElementById('tablaTrabajadores');
  if (!lista.length) { el.innerHTML = '<div class="text-center py-12 text-gray-400">Sin trabajadores registrados</div>'; return; }
  el.innerHTML = \`<table class="w-full text-sm">
    <thead class="bg-gray-50"><tr>
      <th class="p-3 text-left text-xs font-bold text-gray-500 uppercase">Trabajador</th>
      <th class="p-3 text-center text-xs font-bold text-gray-500 uppercase">Estado</th>
      <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Total Cajas</th>
      <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Pendientes</th>
      <th class="p-3 text-center text-xs font-bold text-gray-500 uppercase">Acciones</th>
    </tr></thead>
    <tbody class="divide-y divide-gray-100">\${lista.map(t => \`<tr class="table-row">
      <td class="p-3">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style="background:\${t.avatar_color||'#1148AD'}">\${t.nombre[0]}\${t.apellido[0]}</div>
          <div><div class="font-semibold text-gray-800">\${t.nombre} \${t.apellido}</div><div class="text-xs text-gray-400">\${t.cedula} \${t.email?'· '+t.email:''}</div></div>
        </div>
      </td>
      <td class="p-3 text-center">\${t.activo ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">Inactivo</span>'}</td>
      <td class="p-3 text-right text-gray-600">\${t.total_cajas}</td>
      <td class="p-3 text-right"><span class="font-bold" style="color:#F5A400">\${t.total_pendientes}</span> (\${fmt(t.monto_pendiente_total)})</td>
      <td class="p-3 text-center flex gap-2 justify-center">
        <button onclick="openModalTrabajador(\${t.id})" class="btn btn-outline btn-sm"><i class="fas fa-edit"></i></button>
        \${t.activo ? \`<button onclick="desactivarTrabajador(\${t.id})" class="btn btn-danger btn-sm"><i class="fas fa-user-slash"></i></button>\` : ''}
      </td>
    </tr>\`).join('')}</tbody>
  </table>\`;
}

function openModalTrabajador(id = null) {
  document.getElementById('tituloTrabajador').textContent = id ? 'Editar Trabajador' : 'Nuevo Trabajador';
  document.getElementById('formTrabajador').reset();
  document.getElementById('trabId').value = id || '';
  document.getElementById('trabColor').value = '#1148AD';
  if (id) {
    const t = trabajadoresData.find(x => x.id == id);
    if (t) {
      document.getElementById('trabCedula').value = t.cedula;
      document.getElementById('trabNombre').value = t.nombre;
      document.getElementById('trabApellido').value = t.apellido;
      document.getElementById('trabEmail').value = t.email || '';
      document.getElementById('trabColor').value = t.avatar_color || '#1148AD';
    }
  }
  document.getElementById('modalTrabajador').classList.remove('hidden');
}

function selectColor(color) {
  document.getElementById('trabColor').value = color;
  document.querySelectorAll('#colorPicker div').forEach(d => { d.className = 'w-8 h-8 rounded-full cursor-pointer'; d.style.outline = ''; });
  event.target.className = 'w-8 h-8 rounded-full cursor-pointer ring-2 ring-offset-2';
  event.target.style.outlineColor = color;
  event.target.style.ringColor = color;
}

async function guardarTrabajador(e) {
  e.preventDefault();
  const id = document.getElementById('trabId').value;
  const body = {
    cedula: document.getElementById('trabCedula').value,
    nombre: document.getElementById('trabNombre').value,
    apellido: document.getElementById('trabApellido').value,
    email: document.getElementById('trabEmail').value,
    password: document.getElementById('trabPassword').value,
    avatar_color: document.getElementById('trabColor').value
  };
  const method = id ? 'PUT' : 'POST';
  const url = id ? '/api/admin/trabajadores/' + id : '/api/admin/trabajadores';
  const r = await api(method, url, body);
  const data = await r.json();
  if (r.ok) {
    closeModal('modalTrabajador');
    showToast(id ? 'Trabajador actualizado' : 'Trabajador creado correctamente', 'success');
    loadTrabajadores();
  } else { showToast(data.error || 'Error al guardar', 'error'); }
}

async function desactivarTrabajador(id) {
  if (!confirm('¿Desactivar este trabajador?')) return;
  const r = await api('DELETE', '/api/admin/trabajadores/' + id);
  if (r.ok) { showToast('Trabajador desactivado', 'info'); loadTrabajadores(); }
}

// ════════════════════════════════════════════════════════════════
// REPORTES
// ════════════════════════════════════════════════════════════════
async function loadReporte() {
  const fi = document.getElementById('repFechaIni').value;
  const ff = document.getElementById('repFechaFin').value;
  if (!fi || !ff) { showToast('Selecciona fechas de inicio y fin', 'error'); return; }
  const r = await api('GET', \`/api/admin/reporte?fecha_inicio=\${fi}&fecha_fin=\${ff}\`);
  if (!r.ok) { showToast('Error cargando reporte', 'error'); return; }
  const data = await r.json();
  const el = document.getElementById('contenidoReporte');
  el.innerHTML = \`
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="card p-5 stat-card" style="border-left-color:#1148AD"><div class="text-xs text-gray-500 font-bold uppercase mb-1">Total Ingresos</div><div class="text-2xl font-black" style="color:#1148AD">\${fmt(data.resumen?.total_ingresos)}</div></div>
      <div class="card p-5 stat-card" style="border-left-color:#dc2626"><div class="text-xs text-gray-500 font-bold uppercase mb-1">Total Egresos</div><div class="text-2xl font-black text-red-600">\${fmt(data.resumen?.total_egresos)}</div></div>
      <div class="card p-5 stat-card" style="border-left-color:#16a34a"><div class="text-xs text-gray-500 font-bold uppercase mb-1">Neto</div><div class="text-2xl font-black text-green-600">\${fmt((data.resumen?.total_ingresos||0)-(data.resumen?.total_egresos||0))}</div></div>
      <div class="card p-5 stat-card" style="border-left-color:#F5A400"><div class="text-xs text-gray-500 font-bold uppercase mb-1">Total Cajas</div><div class="text-2xl font-black" style="color:#F5A400">\${data.resumen?.total_cajas||0}</div></div>
    </div>
    <div class="card p-5">
      <h3 class="font-bold text-gray-800 mb-4">Por Trabajador</h3>
      <table class="w-full text-sm">
        <thead class="bg-gray-50"><tr>
          <th class="p-3 text-left text-xs font-bold text-gray-500 uppercase">Trabajador</th>
          <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Cajas</th>
          <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Ingresos</th>
          <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Egresos</th>
          <th class="p-3 text-right text-xs font-bold text-gray-500 uppercase">Neto</th>
        </tr></thead>
        <tbody class="divide-y divide-gray-100">\${(data.porTrabajador||[]).map(t => \`<tr class="table-row">
          <td class="p-3 font-medium text-gray-800">\${t.trabajador}<span class="text-gray-400 text-xs ml-2">\${t.cedula}</span></td>
          <td class="p-3 text-right text-gray-600">\${t.cajas}</td>
          <td class="p-3 text-right font-bold text-green-600">\${fmt(t.ingresos)}</td>
          <td class="p-3 text-right font-bold text-red-600">\${fmt(t.egresos)}</td>
          <td class="p-3 text-right font-black \${(t.ingresos-t.egresos)>=0?'text-green-700':'text-red-700'}">\${fmt(t.ingresos-t.egresos)}</td>
        </tr>\`).join('')}</tbody>
      </table>
    </div>
  \`;
}

// ════════════════════════════════════════════════════════════════
// ALERTAS
// ════════════════════════════════════════════════════════════════
async function loadAlertas() {
  const r = await api('GET', '/api/alertas?limit=30');
  if (!r.ok) return;
  const { alertas, no_leidas } = await r.json();
  // Badge
  const badge = document.getElementById('alertaBadge');
  if (no_leidas > 0) { badge.textContent = no_leidas; badge.classList.remove('hidden'); }
  else { badge.classList.add('hidden'); }
  // Lista
  const el = document.getElementById('listaAlertas');
  if (!el) return;
  if (!alertas.length) { el.innerHTML = '<div class="card p-16 text-center text-gray-400"><i class="fas fa-bell-slash text-5xl mb-3"></i><br>Sin alertas</div>'; return; }
  const iconos = { vencimiento: 'fa-clock text-yellow-500', diferencia: 'fa-exclamation-triangle text-red-500', sistema: 'fa-gear text-blue-500', info: 'fa-info-circle text-blue-400' };
  el.innerHTML = alertas.map(a => \`
    <div class="card p-4 flex gap-4 items-start \${!a.leida ? 'border-l-4 border-blue-500' : ''}">
      <div class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-lg"><i class="fas \${iconos[a.tipo]||'fa-bell text-gray-400'}"></i></div>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-gray-800">\${a.titulo} \${!a.leida ? '<span class="badge badge-blue ml-2">Nueva</span>' : ''}</div>
        <p class="text-sm text-gray-600 mt-0.5">\${a.mensaje}</p>
        <div class="text-xs text-gray-400 mt-1">\${new Date(a.fecha_creacion).toLocaleString('es-ES')}</div>
      </div>
      \${!a.leida ? \`<button onclick="marcarLeida(\${a.id})" class="btn btn-outline btn-sm flex-shrink-0"><i class="fas fa-check"></i></button>\` : ''}
    </div>
  \`).join('');
}

async function marcarLeida(id) {
  await api('PUT', '/api/alertas/' + id + '/leer');
  loadAlertas();
}

async function marcarTodasLeidas() {
  await api('PUT', '/api/alertas/leer-todas');
  showToast('Todas las alertas marcadas como leídas', 'info');
  loadAlertas();
}

// ════════════════════════════════════════════════════════════════
// PERFIL
// ════════════════════════════════════════════════════════════════
function loadPerfil() {
  if (!USUARIO) return;
  const el = document.getElementById('perfilInfo');
  if (el) el.innerHTML = \`
    <div class="flex items-center gap-4 mb-4">
      <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black" style="background:\${USUARIO.avatar_color||'#1148AD'}">\${USUARIO.nombre?.[0]||''}\${USUARIO.apellido?.[0]||''}</div>
      <div>
        <div class="text-xl font-black text-gray-800">\${USUARIO.nombre} \${USUARIO.apellido}</div>
        <div class="text-sm text-gray-500">\${USUARIO.rol === 'admin' ? '⚙️ Administrador' : '👤 Trabajador'}</div>
      </div>
    </div>
    <div class="space-y-2 text-sm">
      <div class="flex gap-3"><span class="text-gray-500 w-24">Cédula:</span><span class="font-semibold">\${USUARIO.cedula}</span></div>
      <div class="flex gap-3"><span class="text-gray-500 w-24">Email:</span><span class="font-semibold">\${USUARIO.email||'No registrado'}</span></div>
      <div class="flex gap-3"><span class="text-gray-500 w-24">Rol:</span><span class="font-semibold capitalize">\${USUARIO.rol}</span></div>
    </div>
  \`;
}

async function cambiarPassword(e) {
  e.preventDefault();
  const actual = document.getElementById('pwActual').value;
  const nueva = document.getElementById('pwNueva').value;
  const confirm = document.getElementById('pwConfirm').value;
  if (nueva !== confirm) { showToast('Las contraseñas nuevas no coinciden', 'error'); return; }
  if (nueva.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
  const r = await api('POST', '/api/auth/cambiar-password', { password_actual: actual, password_nueva: nueva });
  const data = await r.json();
  if (r.ok) { showToast('¡Contraseña actualizada!', 'success'); document.getElementById('formPassword').reset(); }
  else { showToast(data.error || 'Error al cambiar contraseña', 'error'); }
}

// ════════════════════════════════════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════════════════════════════════════
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function closeModalIf(e, id) { if (e.target.id === id) closeModal(id); }

// ════════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════════
async function logout() {
  try { await api('POST', '/api/auth/logout'); } catch {}
  localStorage.removeItem('pr_token');
  localStorage.removeItem('pr_user');
  window.location.href = '/login';
}
</script>
</body>
</html>`;
}
