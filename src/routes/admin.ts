import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type Variables = { usuario: { id: number; cedula: string; nombre: string; apellido: string; rol: string } }

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── SHA-256 idéntico al de auth.ts y startup.ts ───────────────────────────────
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'pagosrapidos_salt_2024')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Middleware: solo superadmin o supervisor (según ruta) ─────────────────────
adminRoutes.use('/*', async (c, next) => {
  const usuario = c.get('usuario')
  if (!['superadmin', 'supervisor'].includes(usuario.rol)) {
    return c.json({ error: 'Acceso denegado. Se requiere rol de administrador.' }, 403)
  }
  await next()
})

// Rutas de escritura: solo superadmin
const soloSuperadmin = async (c: any, next: any) => {
  const usuario = c.get('usuario')
  if (usuario.rol !== 'superadmin') {
    return c.json({ error: 'Solo el superadministrador puede realizar esta acción.' }, 403)
  }
  await next()
}

// ─── DASHBOARD CONSOLIDADO ────────────────────────────────────────────────────
adminRoutes.get('/dashboard', async (c) => {
  const hoy = new Date().toISOString().split('T')[0]
  const mesInicio = hoy.substring(0, 7) + '-01'

  const resumenHoy = await c.env.DB.prepare(`
    SELECT
      COUNT(DISTINCT c.id) as cajas_abiertas,
      COUNT(DISTINCT CASE WHEN c.estado='cuadrada' THEN c.id END) as cajas_cuadradas,
      COUNT(DISTINCT CASE WHEN c.estado='aprobada' THEN c.id END) as cajas_aprobadas,
      COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as total_ingresos_hoy,
      COALESCE(SUM(CASE WHEN m.tipo='egreso' THEN m.monto ELSE 0 END),0) as total_egresos_hoy,
      COUNT(DISTINCT m.id) as total_movimientos_hoy
    FROM cajas c LEFT JOIN movimientos m ON m.caja_id=c.id WHERE c.fecha=?
  `).bind(hoy).first<any>()

  const resumenMes = await c.env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as total_ingresos_mes,
      COALESCE(SUM(CASE WHEN m.tipo='egreso' THEN m.monto ELSE 0 END),0) as total_egresos_mes,
      COUNT(DISTINCT c.id) as cajas_mes
    FROM cajas c LEFT JOIN movimientos m ON m.caja_id=c.id WHERE c.fecha>=?
  `).bind(mesInicio).first<any>()

  const { results: cajasHoy } = await c.env.DB.prepare(`
    SELECT c.id, c.fecha, c.estado, c.saldo_inicial, c.saldo_final, c.diferencia,
      u.nombre, u.apellido, u.cedula,
      COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as ingresos,
      COALESCE(SUM(CASE WHEN m.tipo='egreso' THEN m.monto ELSE 0 END),0) as egresos,
      COUNT(m.id) as movimientos
    FROM usuarios u
    LEFT JOIN cajas c ON c.usuario_id=u.id AND c.fecha=?
    LEFT JOIN movimientos m ON m.caja_id=c.id
    WHERE u.activo=1 AND u.rol='trabajador'
    GROUP BY u.id ORDER BY u.nombre
  `).bind(hoy).all<any>()

  const pendientesCriticos = await c.env.DB.prepare(`
    SELECT COUNT(*) as total, COALESCE(SUM(monto_pendiente),0) as monto_total
    FROM pendientes WHERE estado IN ('vencido','pendiente') AND prioridad IN ('alta','urgente')
  `).first<any>()

  const { results: topTrabajadores } = await c.env.DB.prepare(`
    SELECT u.nombre, u.apellido,
      COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as total_ingresos,
      COUNT(DISTINCT c.id) as dias_trabajados
    FROM usuarios u
    LEFT JOIN cajas c ON c.usuario_id=u.id AND c.fecha>=?
    LEFT JOIN movimientos m ON m.caja_id=c.id
    WHERE u.rol='trabajador' AND u.activo=1
    GROUP BY u.id ORDER BY total_ingresos DESC LIMIT 5
  `).bind(mesInicio).all<any>()

  const { results: flujo7dias } = await c.env.DB.prepare(`
    SELECT c.fecha,
      COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as ingresos,
      COALESCE(SUM(CASE WHEN m.tipo='egreso' THEN m.monto ELSE 0 END),0) as egresos
    FROM cajas c LEFT JOIN movimientos m ON m.caja_id=c.id
    WHERE c.fecha>=date('now','-6 days')
    GROUP BY c.fecha ORDER BY c.fecha ASC
  `).all<any>()

  const totalPendiente = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(monto_pendiente),0) as total,
           COUNT(*) as cantidad
    FROM pendientes WHERE estado NOT IN ('pagado','incobrable')
  `).first<any>()

  return c.json({
    hoy: resumenHoy,
    mes: resumenMes,
    cajas_hoy: cajasHoy,
    pendientes_criticos: pendientesCriticos,
    top_trabajadores: topTrabajadores,
    flujo_7dias: flujo7dias,
    total_pendiente: totalPendiente,
  })
})

// ─── GESTIÓN DE USUARIOS ──────────────────────────────────────────────────────
adminRoutes.get('/usuarios', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT u.id, u.cedula, u.nombre, u.apellido, u.email, u.rol, u.activo,
      u.ultimo_login, u.created_at,
      COUNT(DISTINCT c.id) as total_cajas,
      COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as total_ingresos_historico
    FROM usuarios u
    LEFT JOIN cajas c ON c.usuario_id=u.id
    LEFT JOIN movimientos m ON m.caja_id=c.id
    GROUP BY u.id ORDER BY u.rol, u.nombre
  `).all<any>()
  return c.json({ usuarios: results })
})

adminRoutes.post('/usuarios', soloSuperadmin, async (c) => {
  try {
    const { cedula, nombre, apellido, email, password, rol } = await c.req.json()
    if (!cedula || !nombre || !apellido || !password) {
      return c.json({ error: 'Faltan campos requeridos: cédula, nombre, apellido, contraseña' }, 400)
    }
    if (password.length < 6) return c.json({ error: 'La contraseña debe tener mínimo 6 caracteres' }, 400)

    // No permitir crear otro superadmin
    const rolFinal = rol === 'superadmin' ? 'trabajador' : (rol ?? 'trabajador')

    const existe = await c.env.DB.prepare(`SELECT id FROM usuarios WHERE cedula=?`).bind(cedula.trim()).first()
    if (existe) return c.json({ error: 'Ya existe un usuario con esa cédula' }, 409)

    const hash = await hashPassword(password)
    const result = await c.env.DB.prepare(
      `INSERT INTO usuarios (cedula,nombre,apellido,email,password_hash,rol) VALUES (?,?,?,?,?,?)`
    ).bind(cedula.trim(), nombre.trim(), apellido.trim(), email?.trim() ?? null, hash, rolFinal).run()

    const usuario = c.get('usuario')
    await c.env.DB.prepare(
      `INSERT INTO audit_logs (usuario_id,accion,tabla,registro_id,datos_nuevos) VALUES (?,?,?,?,?)`
    ).bind(usuario.id, 'CREAR_USUARIO', 'usuarios', result.meta.last_row_id,
      JSON.stringify({ cedula, nombre, apellido, rol: rolFinal })).run()

    return c.json({ ok: true, id: result.meta.last_row_id, mensaje: `Usuario ${nombre} ${apellido} creado exitosamente` }, 201)
  } catch (err: any) {
    return c.json({ error: 'Error al crear usuario: ' + err.message }, 500)
  }
})

adminRoutes.put('/usuarios/:id', soloSuperadmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const { nombre, apellido, email, activo, password, rol } = await c.req.json()

    // Proteger al superadmin propietario
    const target = await c.env.DB.prepare(`SELECT cedula, rol FROM usuarios WHERE id=?`).bind(id).first<any>()
    if (!target) return c.json({ error: 'Usuario no encontrado' }, 404)
    if (target.cedula === '1314221597' && rol && rol !== 'superadmin') {
      return c.json({ error: 'No puedes cambiar el rol del superadministrador principal' }, 403)
    }

    // No permitir asignar rol superadmin
    const rolFinal = rol === 'superadmin' ? target.rol : (rol ?? null)

    let hashUpdate = ''
    let params: any[] = []
    if (password) {
      if (password.length < 6) return c.json({ error: 'Mínimo 6 caracteres' }, 400)
      hashUpdate = ', password_hash = ?'
      params.push(await hashPassword(password))
    }

    await c.env.DB.prepare(
      `UPDATE usuarios SET
        nombre = COALESCE(?,nombre),
        apellido = COALESCE(?,apellido),
        email = COALESCE(?,email),
        activo = COALESCE(?,activo),
        rol = COALESCE(?,rol)
        ${hashUpdate},
        updated_at = datetime('now')
      WHERE id = ?`
    ).bind(nombre ?? null, apellido ?? null, email ?? null, activo ?? null, rolFinal, ...params, id).run()

    const usuario = c.get('usuario')
    await c.env.DB.prepare(
      `INSERT INTO audit_logs (usuario_id,accion,tabla,registro_id) VALUES (?,?,?,?)`
    ).bind(usuario.id, 'EDITAR_USUARIO', 'usuarios', id).run()

    return c.json({ ok: true, mensaje: 'Usuario actualizado correctamente' })
  } catch (err: any) {
    return c.json({ error: 'Error al actualizar usuario: ' + err.message }, 500)
  }
})

adminRoutes.delete('/usuarios/:id', soloSuperadmin, async (c) => {
  const id = parseInt(c.req.param('id'))
  const target = await c.env.DB.prepare(`SELECT cedula FROM usuarios WHERE id=?`).bind(id).first<any>()
  if (!target) return c.json({ error: 'Usuario no encontrado' }, 404)
  if (target.cedula === '1314221597') return c.json({ error: 'No se puede eliminar al superadmin principal' }, 403)
  // Desactivar en vez de borrar (preservar historial)
  await c.env.DB.prepare(`UPDATE usuarios SET activo=0, updated_at=datetime('now') WHERE id=?`).bind(id).run()
  return c.json({ ok: true, mensaje: 'Usuario desactivado correctamente' })
})

// ─── CAJAS: ver todas (admin) + aprobar ──────────────────────────────────────
adminRoutes.get('/cajas', async (c) => {
  const fecha = c.req.query('fecha')
  const usuario_id = c.req.query('usuario_id')
  let query = `
    SELECT c.*, u.nombre, u.apellido, u.cedula,
      COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as total_ingresos_calc,
      COALESCE(SUM(CASE WHEN m.tipo='egreso' THEN m.monto ELSE 0 END),0) as total_egresos_calc,
      COUNT(m.id) as total_movimientos
    FROM cajas c
    JOIN usuarios u ON u.id=c.usuario_id
    LEFT JOIN movimientos m ON m.caja_id=c.id
    WHERE 1=1
  `
  const params: any[] = []
  if (fecha) { query += ` AND c.fecha=?`; params.push(fecha) }
  if (usuario_id) { query += ` AND c.usuario_id=?`; params.push(usuario_id) }
  query += ` GROUP BY c.id ORDER BY c.fecha DESC, u.nombre LIMIT 100`

  const { results } = await c.env.DB.prepare(query).bind(...params).all<any>()
  return c.json({ cajas: results })
})

adminRoutes.post('/cajas/:id/aprobar', soloSuperadmin, async (c) => {
  const id = parseInt(c.req.param('id'))
  const { observaciones } = await c.req.json().catch(() => ({ observaciones: '' }))
  const usuario = c.get('usuario')

  const caja = await c.env.DB.prepare(`SELECT * FROM cajas WHERE id=?`).bind(id).first<any>()
  if (!caja) return c.json({ error: 'Caja no encontrada' }, 404)
  if (caja.estado !== 'cuadrada') return c.json({ error: 'Solo se pueden aprobar cajas cuadradas' }, 400)

  await c.env.DB.prepare(
    `UPDATE cajas SET estado='aprobada', aprobado_por=?, aprobado_at=datetime('now'), observaciones=COALESCE(?,observaciones), updated_at=datetime('now') WHERE id=?`
  ).bind(usuario.id, observaciones || null, id).run()

  return c.json({ ok: true, mensaje: 'Caja aprobada correctamente' })
})

adminRoutes.post('/cajas/:id/observar', soloSuperadmin, async (c) => {
  const id = parseInt(c.req.param('id'))
  const { observaciones } = await c.req.json()
  if (!observaciones) return c.json({ error: 'Las observaciones son requeridas' }, 400)

  await c.env.DB.prepare(
    `UPDATE cajas SET estado='observada', observaciones=?, updated_at=datetime('now') WHERE id=?`
  ).bind(observaciones, id).run()

  return c.json({ ok: true, mensaje: 'Caja marcada con observaciones' })
})

// ─── REPORTES ────────────────────────────────────────────────────────────────
adminRoutes.get('/reportes/cajas', async (c) => {
  const desde = c.req.query('desde') ?? new Date(Date.now() - 30*86400000).toISOString().split('T')[0]
  const hasta = c.req.query('hasta') ?? new Date().toISOString().split('T')[0]

  const { results } = await c.env.DB.prepare(`
    SELECT c.id, c.fecha, c.estado, c.saldo_inicial, c.saldo_final, c.saldo_fisico_real, c.diferencia, c.observaciones,
      u.nombre, u.apellido, u.cedula,
      COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as total_ingresos,
      COALESCE(SUM(CASE WHEN m.tipo='egreso' THEN m.monto ELSE 0 END),0) as total_egresos,
      COUNT(m.id) as total_movimientos
    FROM cajas c
    JOIN usuarios u ON u.id=c.usuario_id
    LEFT JOIN movimientos m ON m.caja_id=c.id
    WHERE c.fecha BETWEEN ? AND ?
    GROUP BY c.id ORDER BY c.fecha DESC, u.nombre
  `).bind(desde, hasta).all<any>()

  const resumen = await c.env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as total_ingresos,
      COALESCE(SUM(CASE WHEN m.tipo='egreso' THEN m.monto ELSE 0 END),0) as total_egresos,
      COUNT(DISTINCT c.id) as total_cajas,
      COUNT(DISTINCT c.usuario_id) as total_trabajadores,
      AVG(CASE WHEN c.diferencia IS NOT NULL THEN c.diferencia END) as diferencia_promedio
    FROM cajas c LEFT JOIN movimientos m ON m.caja_id=c.id
    WHERE c.fecha BETWEEN ? AND ?
  `).bind(desde, hasta).first<any>()

  return c.json({ cajas: results, resumen, periodo: { desde, hasta } })
})

adminRoutes.get('/reportes/pendientes', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT p.*, u.nombre as usuario_nombre, u.apellido as usuario_apellido,
      COUNT(a.id) as total_abonos,
      COALESCE(SUM(a.monto),0) as total_abonado_calc
    FROM pendientes p
    JOIN usuarios u ON u.id=p.usuario_id
    LEFT JOIN abonos_pendientes a ON a.pendiente_id=p.id
    GROUP BY p.id ORDER BY p.created_at DESC
  `).all<any>()

  const resumen = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(monto_total),0) as monto_total_bruto,
      COALESCE(SUM(monto_pendiente),0) as monto_por_cobrar,
      COALESCE(SUM(monto_pagado),0) as monto_recuperado,
      SUM(CASE WHEN estado='pagado' THEN 1 ELSE 0 END) as total_pagados,
      SUM(CASE WHEN estado='vencido' THEN 1 ELSE 0 END) as total_vencidos,
      SUM(CASE WHEN estado='incobrable' THEN 1 ELSE 0 END) as total_incobrables,
      SUM(CASE WHEN estado='parcial' THEN 1 ELSE 0 END) as total_parciales
    FROM pendientes
  `).first<any>()

  return c.json({ pendientes: results, resumen })
})

// ─── AUDITORÍA ────────────────────────────────────────────────────────────────
adminRoutes.get('/auditoria', async (c) => {
  const limit = parseInt(c.req.query('limit') ?? '100')
  const { results } = await c.env.DB.prepare(`
    SELECT a.*, u.nombre, u.apellido, u.cedula FROM audit_logs a
    LEFT JOIN usuarios u ON u.id=a.usuario_id
    ORDER BY a.created_at DESC LIMIT ?
  `).bind(limit).all<any>()
  return c.json({ logs: results })
})

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
adminRoutes.get('/config', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM configuracion ORDER BY clave`).all<any>()
  const config: Record<string, string> = {}
  results.forEach((r: any) => { config[r.clave] = r.valor })
  return c.json({ config })
})

adminRoutes.put('/config', soloSuperadmin, async (c) => {
  const updates = await c.req.json()
  const stmts = Object.entries(updates).map(([clave, valor]) =>
    c.env.DB.prepare(
      `INSERT INTO configuracion (clave,valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=?,updated_at=datetime('now')`
    ).bind(clave, valor, valor)
  )
  await c.env.DB.batch(stmts)
  return c.json({ ok: true, mensaje: 'Configuración guardada' })
})

// ─── ESTADÍSTICAS RÁPIDAS ─────────────────────────────────────────────────────
adminRoutes.get('/stats', async (c) => {
  const hoy = new Date().toISOString().split('T')[0]
  const [usuarios, cajas_hoy, pendientes_activos, movimientos_hoy] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN activo=1 THEN 1 ELSE 0 END) as activos FROM usuarios`).first<any>(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM cajas WHERE fecha=?`).bind(hoy).first<any>(),
    c.env.DB.prepare(`SELECT COUNT(*) as total, COALESCE(SUM(monto_pendiente),0) as monto FROM pendientes WHERE estado NOT IN ('pagado','incobrable')`).first<any>(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM movimientos m JOIN cajas c ON m.caja_id=c.id WHERE c.fecha=?`).bind(hoy).first<any>(),
  ])
  return c.json({ usuarios, cajas_hoy, pendientes_activos, movimientos_hoy })
})
