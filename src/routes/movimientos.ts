import { Hono } from 'hono'
type Bindings = { DB: D1Database }
type Variables = { usuario: any }
export const movimientosRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Esquema real movimientos: id, caja_id, usuario_id, tipo, categoria, descripcion, monto,
// comprobante_url, referencia, pendiente_id, created_at

movimientosRoutes.get('/', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const { caja_id, tipo, fecha_inicio, fecha_fin, limit = '100' } = c.req.query()
  let query = `SELECT m.*, u.nombre || ' ' || u.apellido as usuario_nombre, c.fecha as caja_fecha FROM movimientos m JOIN usuarios u ON m.usuario_id = u.id JOIN cajas c ON m.caja_id = c.id WHERE 1=1`
  const params: any[] = []
  if (!['superadmin','supervisor'].includes(usuario.rol)) { query += ` AND m.usuario_id = ?`; params.push(usuario.id) }
  if (caja_id) { query += ` AND m.caja_id = ?`; params.push(caja_id) }
  if (tipo) { query += ` AND m.tipo = ?`; params.push(tipo) }
  if (fecha_inicio) { query += ` AND DATE(m.created_at) >= ?`; params.push(fecha_inicio) }
  if (fecha_fin) { query += ` AND DATE(m.created_at) <= ?`; params.push(fecha_fin) }
  query += ` ORDER BY m.created_at DESC LIMIT ?`
  params.push(parseInt(limit))
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ movimientos: results })
})

movimientosRoutes.post('/', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const body = await c.req.json()
  const { caja_id, tipo, categoria, descripcion, monto, referencia, cliente_nombre } = body
  if (!caja_id || !tipo || !categoria || !descripcion || !monto) return c.json({ error: 'Campos requeridos: caja_id, tipo, categoria, descripcion, monto' }, 400)
  if (!['ingreso','egreso'].includes(tipo)) return c.json({ error: 'Tipo debe ser ingreso o egreso' }, 400)
  if (Number(monto) <= 0) return c.json({ error: 'Monto debe ser mayor a 0' }, 400)

  const caja = await c.env.DB.prepare(`SELECT * FROM cajas WHERE id = ? LIMIT 1`).bind(caja_id).first() as any
  if (!caja) return c.json({ error: 'Caja no encontrada' }, 404)
  if (caja.estado !== 'abierta') return c.json({ error: 'La caja está cerrada' }, 400)
  if (caja.usuario_id !== usuario.id && !['superadmin','supervisor'].includes(usuario.rol)) return c.json({ error: 'Sin permisos' }, 403)

  // La descripción incluye el nombre del cliente si se provee
  const descFinal = cliente_nombre ? `${descripcion} - ${cliente_nombre}` : descripcion

  const result = await c.env.DB.prepare(
    `INSERT INTO movimientos (caja_id, usuario_id, tipo, categoria, descripcion, monto, referencia) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(caja_id, usuario.id, tipo, categoria, descFinal, Number(monto), referencia || null).run()

  // Actualizar totales en caja
  await c.env.DB.prepare(
    `UPDATE cajas SET total_ingresos = (SELECT COALESCE(SUM(monto),0) FROM movimientos WHERE caja_id=? AND tipo='ingreso'), total_egresos = (SELECT COALESCE(SUM(monto),0) FROM movimientos WHERE caja_id=? AND tipo='egreso'), updated_at = datetime('now') WHERE id = ?`
  ).bind(caja_id, caja_id, caja_id).run()

  await c.env.DB.prepare(`INSERT INTO audit_logs (usuario_id, accion, tabla, registro_id) VALUES (?, 'CREAR_MOVIMIENTO', 'movimientos', ?)`).bind(usuario.id, result.meta.last_row_id).run()

  const movimiento = await c.env.DB.prepare(`SELECT * FROM movimientos WHERE id = ?`).bind(result.meta.last_row_id).first()
  return c.json({ success: true, movimiento }, 201)
})

movimientosRoutes.delete('/:id', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const id = c.req.param('id')
  const mov = await c.env.DB.prepare(`SELECT m.*, c.estado as caja_estado, c.usuario_id as caja_usuario FROM movimientos m JOIN cajas c ON m.caja_id = c.id WHERE m.id = ?`).bind(id).first() as any
  if (!mov) return c.json({ error: 'Movimiento no encontrado' }, 404)
  if (mov.caja_estado !== 'abierta') return c.json({ error: 'No se puede eliminar en caja cerrada' }, 400)
  if (mov.usuario_id !== usuario.id && !['superadmin','supervisor'].includes(usuario.rol)) return c.json({ error: 'Sin permisos' }, 403)

  await c.env.DB.prepare(`DELETE FROM movimientos WHERE id = ?`).bind(id).run()
  // Actualizar totales
  await c.env.DB.prepare(
    `UPDATE cajas SET total_ingresos=(SELECT COALESCE(SUM(monto),0) FROM movimientos WHERE caja_id=? AND tipo='ingreso'), total_egresos=(SELECT COALESCE(SUM(monto),0) FROM movimientos WHERE caja_id=? AND tipo='egreso'), updated_at=datetime('now') WHERE id=?`
  ).bind(mov.caja_id, mov.caja_id, mov.caja_id).run()

  return c.json({ success: true, message: 'Movimiento eliminado' })
})

movimientosRoutes.get('/categorias', async (c) => {
  const { tipo } = c.req.query()
  let query = `SELECT * FROM categorias WHERE activo = 1`
  const params: any[] = []
  if (tipo) { query += ` AND (tipo = ? OR tipo = 'ambos')`; params.push(tipo) }
  query += ` ORDER BY nombre ASC`
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ categorias: results })
})

movimientosRoutes.get('/stats', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const { periodo = '30' } = c.req.query()
  const whereUser = !['superadmin','supervisor'].includes(usuario.rol) ? `AND m.usuario_id = ${usuario.id}` : ''
  const { results: stats } = await c.env.DB.prepare(
    `SELECT tipo, categoria, COUNT(*) as cantidad, SUM(monto) as total FROM movimientos m WHERE DATE(created_at) >= date('now','-${periodo} days') ${whereUser} GROUP BY tipo, categoria ORDER BY total DESC`
  ).all()
  const resumen = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END),0) as total_ingresos, COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END),0) as total_egresos, COUNT(*) as total_movimientos FROM movimientos m WHERE DATE(created_at) >= date('now','-${periodo} days') ${whereUser}`
  ).first()
  return c.json({ stats, resumen })
})
