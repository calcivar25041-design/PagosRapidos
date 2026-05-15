export function renderLogin(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Pagos Rápidos – Iniciar Sesión</title>
  <link rel="icon" type="image/png" href="/static/logo.png"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { font-family: 'Inter', sans-serif; }
    .gradient-bg { background: linear-gradient(135deg, #0d3b8e 0%, #1148AD 40%, #1a5cc8 70%, #0d3b8e 100%); }
    .card-glass { background: rgba(255,255,255,0.97); backdrop-filter: blur(20px); }
    .input-field { transition: all 0.2s ease; border: 2px solid #e5e7eb; }
    .input-field:focus { border-color: #1148AD; box-shadow: 0 0 0 4px rgba(17,72,173,0.12); outline: none; }
    .btn-primary { background: linear-gradient(135deg, #1148AD, #1a5cc8); transition: all 0.2s ease; }
    .btn-primary:hover { background: linear-gradient(135deg, #0d3b8e, #1148AD); transform: translateY(-1px); box-shadow: 0 8px 25px rgba(17,72,173,0.4); }
    .btn-primary:active { transform: translateY(0); }
    .logo-glow { filter: drop-shadow(0 4px 20px rgba(17,72,173,0.3)); }
    .floating { animation: float 3s ease-in-out infinite; }
    @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
    .speed-line { position: absolute; height: 3px; border-radius: 2px; background: rgba(245,164,0,0.6); animation: speed 2s linear infinite; }
    @keyframes speed { 0% { transform: translateX(-100px); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateX(400px); opacity: 0; } }
    .shake { animation: shake 0.4s ease; }
    @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
    .slide-up { animation: slideUp 0.5s ease-out; }
    @keyframes slideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
  </style>
</head>
<body class="gradient-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden">

  <!-- Líneas decorativas de velocidad -->
  <div class="speed-line" style="top:20%;width:120px;animation-delay:0s;"></div>
  <div class="speed-line" style="top:40%;width:80px;animation-delay:0.7s;"></div>
  <div class="speed-line" style="top:65%;width:140px;animation-delay:1.3s;"></div>
  <div class="speed-line" style="top:80%;width:60px;animation-delay:0.4s;"></div>

  <!-- Círculos decorativos de fondo -->
  <div class="absolute top-10 right-10 w-64 h-64 rounded-full opacity-10" style="background:radial-gradient(circle,#F5A400,transparent);"></div>
  <div class="absolute bottom-10 left-10 w-48 h-48 rounded-full opacity-10" style="background:radial-gradient(circle,#F5A400,transparent);"></div>

  <div class="card-glass rounded-3xl shadow-2xl w-full max-w-md p-8 slide-up relative z-10">

    <!-- Logo -->
    <div class="flex flex-col items-center mb-8">
      <div class="floating mb-4">
        <img src="https://www.genspark.ai/api/files/s/c6D6iG1M?cache_control=3600"
             alt="Pagos Rápidos" class="logo-glow" style="height:110px;width:auto;"
             onerror="this.style.display='none';document.getElementById('logo-fallback').style.display='flex'"/>
        <div id="logo-fallback" class="hidden items-center justify-center w-24 h-24 rounded-2xl text-white text-4xl font-black" style="background:linear-gradient(135deg,#1148AD,#F5A400);">R</div>
      </div>
      <h1 class="text-2xl font-black text-gray-800">Pagos <span style="color:#F5A400;">Rápidos</span></h1>
      <p class="text-sm text-gray-500 font-medium tracking-widest uppercase mt-1">Agencia Alban Borja</p>
    </div>

    <!-- Formulario -->
    <form id="loginForm" class="space-y-5">
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">
          <i class="fas fa-id-card mr-1.5" style="color:#1148AD;"></i>Cédula de Identidad
        </label>
        <input id="cedula" type="text" placeholder="Ingresa tu cédula"
               class="input-field w-full px-4 py-3 rounded-xl text-gray-800 font-medium bg-gray-50"
               autocomplete="username" maxlength="20"/>
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">
          <i class="fas fa-lock mr-1.5" style="color:#1148AD;"></i>Contraseña
        </label>
        <div class="relative">
          <input id="password" type="password" placeholder="••••••••"
                 class="input-field w-full px-4 py-3 pr-12 rounded-xl text-gray-800 font-medium bg-gray-50"
                 autocomplete="current-password"/>
          <button type="button" onclick="togglePassword()"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
            <i id="eyeIcon" class="fas fa-eye"></i>
          </button>
        </div>
      </div>

      <!-- Error message -->
      <div id="errorMsg" class="hidden bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
        <i class="fas fa-exclamation-circle text-red-500"></i>
        <span id="errorText"></span>
      </div>

      <button type="submit" id="loginBtn" class="btn-primary w-full text-white font-bold py-3.5 rounded-xl text-base tracking-wide flex items-center justify-center gap-2">
        <i class="fas fa-sign-in-alt"></i>
        <span>Ingresar al Sistema</span>
      </button>
    </form>

    <!-- Info de demo -->
    <div class="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100">
      <p class="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
        <i class="fas fa-info-circle"></i> Credenciales de acceso inicial
      </p>
      <div class="space-y-1 text-xs text-blue-600">
        <div class="flex gap-2"><span class="font-bold w-20">Admin:</span><span>0000000001 / Admin123!</span></div>
        <div class="flex gap-2"><span class="font-bold w-20">Trabajador:</span><span>1001234567 / Pass123!</span></div>
      </div>
    </div>

    <p class="text-center text-xs text-gray-400 mt-6">
      <i class="fas fa-shield-alt mr-1"></i>Sistema seguro v1.0 © 2024 Pagos Rápidos
    </p>
  </div>

  <script>
    function togglePassword() {
      const pw = document.getElementById('password');
      const icon = document.getElementById('eyeIcon');
      if (pw.type === 'password') { pw.type = 'text'; icon.className = 'fas fa-eye-slash'; }
      else { pw.type = 'password'; icon.className = 'fas fa-eye'; }
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('loginBtn');
      const errorMsg = document.getElementById('errorMsg');
      const errorText = document.getElementById('errorText');
      const cedula = document.getElementById('cedula').value.trim();
      const password = document.getElementById('password').value;

      if (!cedula || !password) {
        errorText.textContent = 'Completa todos los campos';
        errorMsg.classList.remove('hidden');
        document.getElementById('loginForm').classList.add('shake');
        setTimeout(() => document.getElementById('loginForm').classList.remove('shake'), 400);
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Verificando...</span>';
      errorMsg.classList.add('hidden');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cedula, password })
        });
        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem('pr_token', data.token);
          localStorage.setItem('pr_user', JSON.stringify(data.usuario));
          btn.innerHTML = '<i class="fas fa-check"></i><span>¡Bienvenido!</span>';
          btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
          setTimeout(() => window.location.href = '/', 600);
        } else {
          errorText.textContent = data.error || 'Error al iniciar sesión';
          errorMsg.classList.remove('hidden');
          document.getElementById('loginForm').classList.add('shake');
          setTimeout(() => document.getElementById('loginForm').classList.remove('shake'), 400);
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Ingresar al Sistema</span>';
        }
      } catch(err) {
        errorText.textContent = 'Error de conexión. Intenta nuevamente.';
        errorMsg.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Ingresar al Sistema</span>';
      }
    });

    // Enter key en cédula → focus a password
    document.getElementById('cedula').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('password').focus();
    });

    // Si ya hay sesión, redirigir
    const token = localStorage.getItem('pr_token');
    if (token) {
      fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => { if (r.ok) window.location.href = '/'; })
        .catch(() => {});
    }
  </script>
</body>
</html>`
}
