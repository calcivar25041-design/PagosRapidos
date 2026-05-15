import { Hono } from 'hono'
type Bindings = { DB: D1Database }
type Variables = { usuario: any }
export const cajasRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Esquema real cajas: id, usuario_id, fecha, saldo_inicial, saldo_final, saldo_fisico_real,
// total_ingresos, total_egresos, diferencia, estado, observaciones, aprobado_por, aprobado_at, created_at, updated_at

const isAdmin = (rol: string) => ['superadmin', 'supervisor'].includes(rol)

cajasRoutes.get('/', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const { fecha, estado, usuario_id } = c.req.query()
  let query = `SELECT c.*, u.nombre || ' ' || u.apellido as trabajador_nombre, u.cedula as trabajador_cedula, COALESCE(u.avatar_color, '#1148AD') as avatar_color FROM cajas c JOIN usuarios u ON c.usuario_id = u.id WHERE 1=1`
  const params: any[] = []
  if (!isAdmin(usuario.rol)) { query += ` AND c.usuario_id = ?`; params.push(usuario.id) }
  else if (usuario_id) { query += ` AND c.usuario_id = ?`; params.push(usuario_id) }
  if (fecha) { query += ` AND c.fecha = ?`; params.push(fecha) }
  if (estado) { query += ` AND c.estado = ?`; params.push(estado) }
  query += ` ORDER BY c.fecha DESC, c.created_at DESC LIMIT 100`
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ cajas: results })
})

cajasRoutes.get('/hoy', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const hoy = new Date().toISOString().split('T')[0]
  let caja = await c.env.DB.prepare(
    `SELECT c.*, u.nombre || ' ' || u.apellido as trabajador_nombre FROM cajas c JOIN usuarios u ON c.usuario_id = u.id WHERE c.usuario_id = ? AND c.fecha = ? LIMIT 1`
  ).bind(usuario.id, hoy).first() as any

  if (!caja) {
    const ultima = await c.env.DB.prepare(
      `SELECT saldo_fisico_real FROM cajas WHERE usuario_id = ? AND estado IN ('cuadrada','aprobada') ORDER BY fecha DESC LIMIT 1`
    ).bind(usuario.id).first() as any
    const saldo_inicial = ultima?.saldo_fisico_real ?? 0
    const result = await c.env.DB.prepare(
      `INSERT INTO cajas (usuario_id, fecha, saldo_inicial, total_ingresos, total_egresos, estado) VALUES (?, ?, ?, 0, 0, 'abierta')`
    ).bind(usuario.id, hoy, saldo_inicial).run()
    caja = await c.env.DB.prepare(
      `SELECT c.*, u.nombre || ' ' || u.apellido as trabajador_nombre FROM cajas c JOIN usuarios u ON c.usuario_id = u.id WHERE c.id = ? LIMIT 1`
    ).bind(result.meta.last_row_id).first()
  }

  // Calcular totales dinámicos
  const totales = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END),0) as ing, COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END),0) as eg, COUNT(*) as num FROM movimientos WHERE caja_id = ?`
  ).bind((caja as any).id).first() as any

  return c.json({ caja: { ...caja, total_ingresos: totales?.ing || 0, total_egresos: totales?.eg || 0, num_movimientos: totales?.num || 0 } })
})

cajasRoutes.get('/resumen/semana', async (c) => {
  const usuario = c.get('usuario' as any) as any
  let query = `SELECT c.fecha, c.estado, c.saldo_inicial, c.saldo_fisico_real, c.diferencia, u.nombre || ' ' || u.apellido as trabajador, COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as ingresos, COALESCE(SUM(CASE WHEN m.tipo='egreso' THEN m.monto ELSE 0 END),0) as egresos FROM cajas c JOIN usuarios u ON c.usuario_id = u.id LEFT JOIN movimientos m ON m.caja_id = c.id WHERE c.fecha >= date('now','-7 days')`
  const params: any[] = []
  if (!isAdmin(usuario.rol)) { query += ` AND c.usuario_id = ?`; params.push(usuario.id) }
  query += ` GROUP BY c.id ORDER BY c.fecha DESC`
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ semana: results })
})

cajasRoutes.get('/:id', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const id = c.req.param('id')
  const caja = await c.env.DB.prepare(
    `SELECT c.*, u.nombre || ' ' || u.apellido as trabajador_nombre, u.cedula as trabajador_cedula, COALESCE(u.avatar_color, '#1148AD') as avatar_color FROM cajas c JOIN usuarios u ON c.usuario_id = u.id WHERE c.id = ?`
  ).bind(id).first() as any
  if (!caja) return c.json({ error: 'Caja no encontrada' }, 404)
  if (!isAdmin(usuario.rol) && caja.usuario_id !== usuario.id) return c.json({ error: 'Sin acceso' }, 403)
  const { results: movimientos } = await c.env.DB.prepare(
    `SELECT m.*, u.nombre || ' ' || u.apellido as trabajador_nombre FROM movimientos m LEFT JOIN usuarios u ON m.usuario_id = u.id WHERE m.caja_id = ? ORDER BY m.created_at DESC`
  ).bind(id).all()
  return c.json({ caja, movimientos })
})

cajasRoutes.post('/cuadre', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const body = await c.req.json()
  // Aceptar saldo_fisico o saldo_fisico_real (el frontend envía saldo_fisico_real desde el modal)
  const caja_id = body.caja_id
  const saldo_fisico = body.saldo_fisico ?? body.saldo_fisico_real
  const observaciones = body.observaciones
  if (!caja_id || saldo_fisico === undefined) return c.json({ error: 'caja_id y saldo_fisico requeridos' }, 400)

  const caja = await c.env.DB.prepare(`SELECT * FROM cajas WHERE id = ?`).bind(caja_id).first() as any
  if (!caja) return c.json({ error: 'Caja no encontrada' }, 404)
  if (caja.usuario_id !== usuario.id && !isAdmin(usuario.rol)) return c.json({ error: 'Sin permisos' }, 403)
  if (caja.estado !== 'abierta') return c.json({ error: 'Esta caja ya fue procesada' }, 400)

  const totales = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END),0) as ing, COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END),0) as eg FROM movimientos WHERE caja_id = ?`
  ).bind(caja_id).first() as any

  const saldo_esperado = Number(caja.saldo_inicial) + Number(totales.ing) - Number(totales.eg)
  const diferencia = Number(saldo_fisico) - saldo_esperado

  await c.env.DB.prepare(
    `UPDATE cajas SET saldo_final = ?, saldo_fisico_real = ?, total_ingresos = ?, total_egresos = ?, diferencia = ?, estado = 'cuadrada', observaciones = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(saldo_esperado, saldo_fisico, totales.ing, totales.eg, diferencia, observaciones || null, caja_id).run()

  if (Math.abs(diferencia) > 5) {
    await c.env.DB.prepare(
      `INSERT INTO alertas (usuario_id, tipo, titulo, mensaje, referencia_id, referencia_tipo) VALUES (?, 'diferencia', 'Diferencia en cuadre', 'Diferencia de $' || ? || ' en caja del ' || ?, ?, 'caja')`
    ).bind(usuario.id, diferencia.toFixed(2), caja.fecha, caja_id).run()
  }
  await c.env.DB.prepare(`INSERT INTO audit_logs (usuario_id, accion, tabla, registro_id) VALUES (?, 'CUADRE_CAJA', 'cajas', ?)`).bind(usuario.id, caja_id).run()

  return c.json({ success: true, cuadre: { saldo_inicial: caja.saldo_inicial, total_ingresos: totales.ing, total_egresos: totales.eg, saldo_esperado, saldo_fisico: Number(saldo_fisico), diferencia } })
})

cajasRoutes.post('/:id/aprobar', async (c) => {
  const usuario = c.get('usuario' as any) as any
  if (!isAdmin(usuario.rol)) return c.json({ error: 'Solo admin puede aprobar' }, 403)
  const id = c.req.param('id')
  const { observaciones } = await c.req.json().catch(() => ({ observaciones: '' }))
  const caja = await c.env.DB.prepare(`SELECT * FROM cajas WHERE id = ?`).bind(id).first() as any
  if (!caja) return c.json({ error: 'Caja no encontrada' }, 404)
  if (caja.estado !== 'cuadrada') return c.json({ error: 'La caja debe estar cuadrada' }, 400)
  await c.env.DB.prepare(`UPDATE cajas SET estado = 'aprobada', aprobado_por = ?, aprobado_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).bind(usuario.id, id).run()
  await c.env.DB.prepare(`INSERT INTO alertas (usuario_id, tipo, titulo, mensaje, referencia_id, referencia_tipo) VALUES (?, 'info', 'Caja aprobada', 'Tu cuadre del ' || ? || ' fue aprobado', ?, 'caja')`).bind(caja.usuario_id, caja.fecha, id).run()
  return c.json({ success: true })
})

cajasRoutes.post('/:id/rechazar', async (c) => {
  const usuario = c.get('usuario' as any) as any
  if (!isAdmin(usuario.rol)) return c.json({ error: 'Solo admin puede rechazar' }, 403)
  const id = c.req.param('id')
  const { motivo } = await c.req.json()
  if (!motivo) return c.json({ error: 'Motivo requerido' }, 400)
  const caja = await c.env.DB.prepare(`SELECT * FROM cajas WHERE id = ?`).bind(id).first() as any
  if (!caja) return c.json({ error: 'No encontrada' }, 404)
  await c.env.DB.prepare(`UPDATE cajas SET estado = 'rechazada', observaciones = ?, aprobado_por = ?, updated_at = datetime('now') WHERE id = ?`).bind(motivo, usuario.id, id).run()
  await c.env.DB.prepare(`INSERT INTO alertas (usuario_id, tipo, titulo, mensaje, referencia_id, referencia_tipo) VALUES (?, 'diferencia', 'Caja rechazada', ?, ?, 'caja')`).bind(caja.usuario_id, `Tu caja del ${caja.fecha} fue rechazada: ${motivo}`, id).run()
  return c.json({ success: true })
})
