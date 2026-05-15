import { Hono } from 'hono'
import { migrateDatabase, initDatabase, ensureAdminExists } from '../startup'

type Bindings = { DB: D1Database }

export const authRoutes = new Hono<{ Bindings: Bindings }>()

// ─── SHA-256 idéntico al usado en startup.ts ─────────────────────────────────
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'pagosrapidos_salt_2024')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Soportar hashes legados con prefijo $admin$ / $user$ (migración suave)
  if (storedHash.startsWith('$admin$')) return password === storedHash.slice(7)
  if (storedHash.startsWith('$user$'))  return password === storedHash.slice(6)
  // Hash SHA-256 estándar
  const computed = await hashPassword(password)
  return computed === storedHash
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 64; i++) token += chars.charAt(Math.floor(Math.random() * chars.length))
  return `pr_${token}_${Date.now()}`
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const { cedula, password } = body
    if (!cedula || !password) return c.json({ error: 'Cédula y contraseña son requeridos' }, 400)

    const usuario = await c.env.DB.prepare(
      `SELECT * FROM usuarios WHERE cedula = ? AND activo = 1 LIMIT 1`
    ).bind(cedula.trim()).first<any>()

    if (!usuario) return c.json({ error: 'Cédula o contraseña incorrectos' }, 401)

    const ok = await verifyPassword(password, usuario.password_hash)
    if (!ok) return c.json({ error: 'Cédula o contraseña incorrectos' }, 401)

    const token = generateToken()
    const expiracion = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

    // Invalidar sesiones anteriores del usuario
    await c.env.DB.prepare(
      `UPDATE sesiones SET expires_at = datetime('now') WHERE usuario_id = ?`
    ).bind(usuario.id).run()

    await c.env.DB.prepare(
      `INSERT INTO sesiones (usuario_id, token, expires_at) VALUES (?, ?, ?)`
    ).bind(usuario.id, token, expiracion).run()

    await c.env.DB.prepare(
      `UPDATE usuarios SET ultimo_login = datetime('now') WHERE id = ?`
    ).bind(usuario.id).run()

    // audit_log — ignorar si falla (tabla puede no existir aún)
    try {
      await c.env.DB.prepare(
        `INSERT INTO audit_logs (usuario_id, accion, tabla) VALUES (?, 'LOGIN', 'usuarios')`
      ).bind(usuario.id).run()
    } catch {}

    // Color de avatar por rol
    const avatarColor =
      usuario.rol === 'superadmin' ? '#B45309' :
      usuario.rol === 'supervisor' ? '#6D28D9' : '#1148AD'

    return c.json({
      success: true,
      token,
      usuario: {
        id: usuario.id,
        cedula: usuario.cedula,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
        avatar_color: avatarColor
      }
    })
  } catch (err: any) {
    console.error('Login error:', err)
    return c.json({ error: 'Error al iniciar sesión: ' + err.message }, 500)
  }
})

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
authRoutes.post('/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || ''
  if (token) {
    await c.env.DB.prepare(
      `UPDATE sesiones SET expires_at = datetime('now') WHERE token = ?`
    ).bind(token).run()
  }
  return c.json({ success: true })
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
authRoutes.get('/me', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') ||
                c.req.header('X-Token') || ''
  if (!token) return c.json({ error: 'No autorizado' }, 401)

  const sesion = await c.env.DB.prepare(
    `SELECT s.*, u.id as uid, u.cedula, u.nombre, u.apellido, u.rol, u.email, u.activo
     FROM sesiones s JOIN usuarios u ON s.usuario_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now') LIMIT 1`
  ).bind(token).first<any>()

  if (!sesion) return c.json({ error: 'Sesión inválida' }, 401)
  if (!sesion.activo) return c.json({ error: 'Usuario inactivo' }, 403)

  const avatarColor =
    sesion.rol === 'superadmin' ? '#B45309' :
    sesion.rol === 'supervisor' ? '#6D28D9' : '#1148AD'

  return c.json({
    id: sesion.uid,
    cedula: sesion.cedula,
    nombre: sesion.nombre,
    apellido: sesion.apellido,
    email: sesion.email,
    rol: sesion.rol,
    avatar_color: avatarColor
  })
})

// ─── POST /api/auth/cambiar-password ─────────────────────────────────────────
authRoutes.post('/cambiar-password', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || ''
  if (!token) return c.json({ error: 'No autorizado' }, 401)

  const sesion = await c.env.DB.prepare(
    `SELECT s.usuario_id, u.password_hash, u.rol, u.cedula
     FROM sesiones s JOIN usuarios u ON s.usuario_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now') LIMIT 1`
  ).bind(token).first<any>()
  if (!sesion) return c.json({ error: 'Sesión inválida' }, 401)

  const { password_actual, password_nueva } = await c.req.json()
  if (!password_actual || !password_nueva) return c.json({ error: 'Datos incompletos' }, 400)
  if (password_nueva.length < 6) return c.json({ error: 'La contraseña debe tener mínimo 6 caracteres' }, 400)

  const ok = await verifyPassword(password_actual, sesion.password_hash)
  if (!ok) return c.json({ error: 'Contraseña actual incorrecta' }, 400)

  const nuevoHash = await hashPassword(password_nueva)
  await c.env.DB.prepare(
    `UPDATE usuarios SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(nuevoHash, sesion.usuario_id).run()

  return c.json({ success: true, message: 'Contraseña actualizada correctamente' })
})

// ─── GET /api/auth/check-setup ────────────────────────────────────────────────
// Endpoint público: verifica si hay superadmin registrado
authRoutes.get('/check-setup', async (c) => {
  try {
    // Buscar superadmin OR admin (por compatibilidad con schema viejo)
    const admin = await c.env.DB.prepare(
      `SELECT id FROM usuarios WHERE rol IN ('superadmin','admin') LIMIT 1`
    ).first()
    return c.json({ necesita_setup: !admin })
  } catch {
    return c.json({ necesita_setup: true })
  }
})

// ─── POST /api/auth/setup ─────────────────────────────────────────────────────
// Endpoint público: fuerza la creación/migración del superadmin propietario
// Útil para inicialización y para recuperación de acceso
authRoutes.post('/setup', async (c) => {
  try {
    // Siempre ejecutar migración + ensureAdmin
    await migrateDatabase(c.env.DB)
    await initDatabase(c.env.DB)
    await ensureAdminExists(c.env.DB)

    const admin = await c.env.DB.prepare(
      `SELECT id, cedula, nombre, rol FROM usuarios WHERE cedula = '1314221597' LIMIT 1`
    ).first<any>()

    return c.json({
      success: true,
      message: 'Sistema inicializado correctamente',
      superadmin: admin ? {
        cedula: admin.cedula,
        nombre: admin.nombre,
        rol: admin.rol
      } : null
    })
  } catch (err: any) {
    console.error('Setup error:', err)
    return c.json({ error: 'Error en setup: ' + err.message }, 500)
  }
})

// ─── GET /api/auth/debug ─────────────────────────────────────────────────────
// Diagnóstico completo: tablas, vistas, triggers, índices, usuarios
authRoutes.get('/debug', async (c) => {
  try {
    // Todos los objetos del schema (tablas, vistas, triggers, índices)
    const schema = await c.env.DB.prepare(
      `SELECT name, type, sql FROM sqlite_master ORDER BY type, name`
    ).all<any>()

    const usuarios = await c.env.DB.prepare(
      `SELECT id, cedula, nombre, rol, activo, substr(password_hash,1,10) as hash_pre FROM usuarios LIMIT 20`
    ).all<any>()

    // Buscar cualquier referencia a usuarios_old en el schema
    const refs = (schema.results || []).filter((r: any) =>
      (r.sql || '').includes('usuarios_old')
    )

    // Probar cada paso del login por separado
    const loginSteps: any = {}
    try {
      const u = await c.env.DB.prepare(
        `SELECT id, cedula, rol, activo FROM usuarios WHERE cedula='1314221597' LIMIT 1`
      ).first()
      loginSteps.step1_find_user = u ? 'OK' : 'NOT FOUND'
    } catch (e: any) { loginSteps.step1_find_user = 'ERROR: ' + e.message }

    try {
      await c.env.DB.prepare(
        `UPDATE sesiones SET expires_at = datetime('now') WHERE usuario_id = 999999`
      ).run()
      loginSteps.step2_update_sesiones = 'OK'
    } catch (e: any) { loginSteps.step2_update_sesiones = 'ERROR: ' + e.message }

    try {
      await c.env.DB.prepare(
        `INSERT INTO sesiones (usuario_id, token, expires_at) VALUES (2, 'test_debug_token_delete_me', datetime('now', '+1 hour'))`
      ).run()
      await c.env.DB.prepare(`DELETE FROM sesiones WHERE token='test_debug_token_delete_me'`).run()
      loginSteps.step3_insert_sesion = 'OK'
    } catch (e: any) { loginSteps.step3_insert_sesion = 'ERROR: ' + e.message }

    try {
      await c.env.DB.prepare(
        `UPDATE usuarios SET ultimo_login = datetime('now') WHERE id = 2`
      ).run()
      loginSteps.step4_update_ultimo_login = 'OK'
    } catch (e: any) { loginSteps.step4_update_ultimo_login = 'ERROR: ' + e.message }

    return c.json({
      schema_objects: (schema.results || []).map((r: any) => ({ name: r.name, type: r.type })),
      referencias_usuarios_old: refs,
      usuarios: usuarios.results,
      login_steps: loginSteps
    })
  } catch (err: any) {
    return c.json({ error: err.message })
  }
})

// ─── POST /api/auth/cleanup ──────────────────────────────────────────────────
// Reparación completa: recrea tablas con FK rota (REFERENCES usuarios_old → usuarios)
// y resetea el superadmin
authRoutes.post('/cleanup', async (c) => {
  const resultados: string[] = []
  try {
    // ── PRAGMA FK off para poder operar sin restricciones ──────────────────
    await c.env.DB.prepare(`PRAGMA foreign_keys = OFF`).run()

    // ── 1. Recrear tabla sesiones ──────────────────────────────────────────
    try {
      await c.env.DB.prepare(`ALTER TABLE sesiones RENAME TO sesiones_old`).run()
      await c.env.DB.prepare(`CREATE TABLE sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`).run()
      await c.env.DB.prepare(
        `INSERT INTO sesiones SELECT id,usuario_id,token,expires_at,ip_address,user_agent,created_at FROM sesiones_old`
      ).run()
      await c.env.DB.prepare(`DROP TABLE sesiones_old`).run()
      resultados.push('✅ sesiones recreada OK')
    } catch (e: any) { resultados.push('⚠️ sesiones: ' + e.message) }

    // ── 2. Recrear tabla cajas ─────────────────────────────────────────────
    try {
      await c.env.DB.prepare(`ALTER TABLE cajas RENAME TO cajas_old`).run()
      await c.env.DB.prepare(`CREATE TABLE cajas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        fecha DATE NOT NULL,
        saldo_inicial REAL NOT NULL DEFAULT 0,
        saldo_final REAL,
        saldo_fisico_real REAL,
        total_ingresos REAL DEFAULT 0,
        total_egresos REAL DEFAULT 0,
        diferencia REAL,
        estado TEXT NOT NULL DEFAULT 'abierta' CHECK(estado IN ('abierta','cuadrada','aprobada','observada')),
        observaciones TEXT,
        aprobado_por INTEGER,
        aprobado_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        UNIQUE(usuario_id, fecha)
      )`).run()
      await c.env.DB.prepare(
        `INSERT INTO cajas SELECT * FROM cajas_old`
      ).run()
      await c.env.DB.prepare(`DROP TABLE cajas_old`).run()
      resultados.push('✅ cajas recreada OK')
    } catch (e: any) { resultados.push('⚠️ cajas: ' + e.message) }

    // ── 3. Recrear tabla movimientos ───────────────────────────────────────
    try {
      await c.env.DB.prepare(`ALTER TABLE movimientos RENAME TO movimientos_old`).run()
      await c.env.DB.prepare(`CREATE TABLE movimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caja_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
        categoria TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        monto REAL NOT NULL CHECK(monto > 0),
        comprobante_url TEXT,
        referencia TEXT,
        pendiente_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (caja_id) REFERENCES cajas(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`).run()
      await c.env.DB.prepare(
        `INSERT INTO movimientos SELECT * FROM movimientos_old`
      ).run()
      await c.env.DB.prepare(`DROP TABLE movimientos_old`).run()
      resultados.push('✅ movimientos recreada OK')
    } catch (e: any) { resultados.push('⚠️ movimientos: ' + e.message) }

    // ── 4. Recrear tabla pendientes ────────────────────────────────────────
    try {
      await c.env.DB.prepare(`ALTER TABLE pendientes RENAME TO pendientes_old`).run()
      await c.env.DB.prepare(`CREATE TABLE pendientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        cliente_nombre TEXT NOT NULL,
        cliente_cedula TEXT,
        cliente_telefono TEXT,
        descripcion TEXT NOT NULL,
        monto_total REAL NOT NULL CHECK(monto_total > 0),
        monto_pagado REAL NOT NULL DEFAULT 0,
        monto_pendiente REAL NOT NULL,
        fecha_deuda DATE NOT NULL,
        fecha_vencimiento DATE,
        estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','parcial','pagado','vencido','incobrable')),
        prioridad TEXT NOT NULL DEFAULT 'normal' CHECK(prioridad IN ('baja','normal','alta','urgente')),
        notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`).run()
      await c.env.DB.prepare(
        `INSERT INTO pendientes SELECT * FROM pendientes_old`
      ).run()
      await c.env.DB.prepare(`DROP TABLE pendientes_old`).run()
      resultados.push('✅ pendientes recreada OK')
    } catch (e: any) { resultados.push('⚠️ pendientes: ' + e.message) }

    // ── 5. Recrear tabla audit_logs ────────────────────────────────────────
    try {
      await c.env.DB.prepare(`ALTER TABLE audit_logs RENAME TO audit_logs_old`).run()
      await c.env.DB.prepare(`CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        accion TEXT NOT NULL,
        tabla TEXT,
        registro_id INTEGER,
        datos_anteriores TEXT,
        datos_nuevos TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`).run()
      await c.env.DB.prepare(
        `INSERT INTO audit_logs SELECT * FROM audit_logs_old`
      ).run()
      await c.env.DB.prepare(`DROP TABLE audit_logs_old`).run()
      resultados.push('✅ audit_logs recreada OK')
    } catch (e: any) { resultados.push('⚠️ audit_logs: ' + e.message) }

    // ── 6. Recrear índices ─────────────────────────────────────────────────
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cajas_usuario_fecha ON cajas(usuario_id, fecha)`),
        c.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_movimientos_caja ON movimientos(caja_id)`),
        c.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pendientes_usuario ON pendientes(usuario_id)`),
        c.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pendientes_estado ON pendientes(estado)`),
        c.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token)`),
      ])
      resultados.push('✅ índices recreados OK')
    } catch (e: any) { resultados.push('⚠️ índices: ' + e.message) }

    // ── 7. Resetear superadmin ─────────────────────────────────────────────
    const encoder = new TextEncoder()
    const data = encoder.encode('Theking&' + 'pagosrapidos_salt_2024')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b: number) => b.toString(16).padStart(2, '0')).join('')

    try {
      const r = await c.env.DB.prepare(
        `UPDATE usuarios SET rol='superadmin', password_hash=?, activo=1 WHERE cedula='1314221597'`
      ).bind(hash).run()
      if (r.meta.changes === 0) {
        await c.env.DB.prepare(
          `INSERT INTO usuarios (cedula,nombre,apellido,email,password_hash,rol,activo)
           VALUES ('1314221597','Administrador','Sistema','admin@pagosrapidos.com',?,'superadmin',1)`
        ).bind(hash).run()
        resultados.push('✅ superadmin INSERTADO')
      } else {
        resultados.push(`✅ superadmin ACTUALIZADO (rows: ${r.meta.changes})`)
      }
    } catch (e: any) { resultados.push('⚠️ superadmin: ' + e.message) }

    // ── 8. Verificar estado final ──────────────────────────────────────────
    const admin = await c.env.DB.prepare(
      `SELECT id, cedula, nombre, rol, activo, substr(password_hash,1,10) as hash_pre FROM usuarios WHERE cedula='1314221597'`
    ).first<any>()

    // Test real de INSERT en sesiones
    let sesionTest = 'PENDING'
    try {
      await c.env.DB.prepare(
        `INSERT INTO sesiones (usuario_id,token,expires_at) VALUES (2,'__test__',datetime('now','+1 hour'))`
      ).run()
      await c.env.DB.prepare(`DELETE FROM sesiones WHERE token='__test__'`).run()
      sesionTest = 'OK'
    } catch (e: any) { sesionTest = 'ERROR: ' + e.message }

    return c.json({ success: true, resultados, superadmin: admin, sesion_test: sesionTest })
  } catch (err: any) {
    return c.json({ error: err.message, resultados })
  }
})

// ─── POST /api/auth/migrate ───────────────────────────────────────────────────
// Endpoint de emergencia: fuerza migración de schema y reset de superadmin
authRoutes.post('/migrate', async (c) => {
  try {
    await migrateDatabase(c.env.DB)
    await initDatabase(c.env.DB)
    await ensureAdminExists(c.env.DB)

    const admin = await c.env.DB.prepare(
      `SELECT id, cedula, nombre, rol, substr(password_hash,1,8) as hash_pre FROM usuarios WHERE cedula = '1314221597' LIMIT 1`
    ).first<any>()

    const totalUsuarios = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM usuarios`
    ).first<any>()

    return c.json({
      success: true,
      message: 'Migración completada',
      superadmin: admin,
      total_usuarios: totalUsuarios?.total
    })
  } catch (err: any) {
    console.error('Migrate error:', err)
    return c.json({ error: 'Error en migración: ' + err.message }, 500)
  }
})

// ─── POST /api/auth/fix-avatar-color ─────────────────────────────────────────
authRoutes.post('/fix-avatar-color', async (c) => {
  const results: string[] = []
  try {
    const cols = await c.env.DB.prepare(`PRAGMA table_info(usuarios)`).all()
    const tiene = (cols.results as any[]).some((col: any) => col.name === 'avatar_color')
    if (!tiene) {
      await c.env.DB.prepare(`ALTER TABLE usuarios ADD COLUMN avatar_color TEXT DEFAULT '#1148AD'`).run()
      results.push('✅ Columna avatar_color AGREGADA')
    } else {
      results.push('ℹ️ Columna ya existía')
    }
    const cols2 = await c.env.DB.prepare(`PRAGMA table_info(usuarios)`).all()
    results.push(`Columnas: ${(cols2.results as any[]).map((c: any) => c.name).join(', ')}`)
    return c.json({ success: true, results })
  } catch (err: any) {
    return c.json({ success: false, error: err.message, results }, 500)
  }
})
