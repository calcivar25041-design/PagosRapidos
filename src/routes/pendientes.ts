import { Hono } from 'hono'
type Bindings = { DB: D1Database }
type Variables = { usuario: any }
export const pendientesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Esquema real pendientes: id, usuario_id, cliente_nombre, cliente_cedula, cliente_telefono,
// descripcion, monto_total, monto_pagado, monto_pendiente, fecha_deuda, fecha_vencimiento,
// estado, prioridad, notas, created_at, updated_at

pendientesRoutes.get('/', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const { estado, limit = '100' } = c.req.query()
  let query = `SELECT p.*,
    COALESCE(u.nombre || ' ' || u.apellido, 'Usuario eliminado') as trabajador_nombre,
    COALESCE(u.avatar_color, '#1148AD') as avatar_color,
    CASE WHEN p.fecha_vencimiento IS NOT NULL AND p.fecha_vencimiento < date('now') AND p.estado NOT IN ('pagado','anulado') THEN 1 ELSE 0 END as esta_vencido,
    CASE WHEN p.fecha_vencimiento IS NOT NULL THEN julianday(p.fecha_vencimiento) - julianday('now') ELSE NULL END as dias_para_vencer
    FROM pendientes p LEFT JOIN usuarios u ON p.usuario_id = u.id WHERE p.estado != 'anulado'`
  const params: any[] = []
  if (!['superadmin','supervisor'].includes(usuario.rol)) { query += ` AND p.usuario_id = ?`; params.push(usuario.id) }
  if (estado && estado !== 'anulado') { query += ` AND p.estado = ?`; params.push(estado) }
  query += ` ORDER BY CASE WHEN p.fecha_vencimiento IS NULL THEN 1 ELSE 0 END ASC, p.fecha_vencimiento ASC, p.id DESC LIMIT ?`
  params.push(parseInt(limit))
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ pendientes: results, _debug: { rol: usuario.rol, id: usuario.id, total: results.length } })
})

pendientesRoutes.get('/resumen', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const whereUser = !['superadmin','supervisor'].includes(usuario.rol) ? `AND p.usuario_id = ${usuario.id}` : ''
  const resumen = await c.env.DB.prepare(`
    SELECT COUNT(*) as total,
      COALESCE(SUM(monto_total),0) as monto_total,
      COALESCE(SUM(monto_pagado),0) as monto_cobrado,
      COALESCE(SUM(monto_pendiente),0) as monto_por_cobrar,
      SUM(CASE WHEN estado='pendiente' THEN 1 ELSE 0 END) as cant_pendientes,
      SUM(CASE WHEN estado='parcial' THEN 1 ELSE 0 END) as cant_parciales,
      SUM(CASE WHEN estado='pagado' THEN 1 ELSE 0 END) as cant_pagados,
      SUM(CASE WHEN fecha_vencimiento < date('now') AND estado NOT IN ('pagado','anulado') THEN 1 ELSE 0 END) as cant_vencidos
    FROM pendientes p WHERE 1=1 ${whereUser}
  `).first()
  return c.json({ resumen })
})

pendientesRoutes.get('/:id', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const id = c.req.param('id')
  const pendiente = await c.env.DB.prepare(
    `SELECT p.*, u.nombre || ' ' || u.apellido as trabajador_nombre FROM pendientes p JOIN usuarios u ON p.usuario_id = u.id WHERE p.id = ?`
  ).bind(id).first() as any
  if (!pendiente) return c.json({ error: 'No encontrado' }, 404)
  if (!['superadmin','supervisor'].includes(usuario.rol) && pendiente.usuario_id !== usuario.id) return c.json({ error: 'Sin acceso' }, 403)
  const { results: pagos } = await c.env.DB.prepare(
    `SELECT ap.* FROM abonos_pendientes ap WHERE ap.pendiente_id = ? ORDER BY ap.created_at DESC`
  ).bind(id).all()
  return c.json({ pendiente, pagos })
})

pendientesRoutes.post('/', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const body = await c.req.json()
  const { cliente_nombre, cliente_cedula, cliente_telefono, descripcion, monto_total, fecha_emision, fecha_vencimiento, prioridad, notas } = body
  if (!cliente_nombre || !descripcion || !monto_total) return c.json({ error: 'Campos requeridos: cliente_nombre, descripcion, monto_total' }, 400)
  if (Number(monto_total) <= 0) return c.json({ error: 'Monto debe ser mayor a 0' }, 400)

  // fecha_deuda puede venir como fecha_deuda o fecha_emision desde el frontend
  const fechaDeuda = (body as any).fecha_deuda || fecha_emision || new Date().toISOString().split('T')[0]
  // fecha_vencimiento es opcional
  const fechaVenc = fecha_vencimiento || null

  const result = await c.env.DB.prepare(
    `INSERT INTO pendientes (usuario_id, cliente_nombre, cliente_cedula, cliente_telefono, descripcion, monto_total, monto_pagado, monto_pendiente, fecha_deuda, fecha_vencimiento, estado, prioridad, notas) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'pendiente', ?, ?)`
  ).bind(usuario.id, cliente_nombre, cliente_cedula || null, cliente_telefono || null, descripcion, Number(monto_total), Number(monto_total), fechaDeuda, fechaVenc, prioridad || 'normal', notas || null).run()

  if (fechaVenc) {
    const diasParaVencer = Math.ceil((new Date(fechaVenc).getTime() - Date.now()) / 86400000)
    if (diasParaVencer <= 3) {
      await c.env.DB.prepare(`INSERT INTO alertas (usuario_id, tipo, titulo, mensaje, referencia_id, referencia_tipo) VALUES (?, 'vencimiento', 'Pendiente próximo a vencer', ?, ?, 'pendiente')`).bind(usuario.id, `${cliente_nombre} - $${monto_total} vence en ${diasParaVencer}d`, result.meta.last_row_id).run()
    }
  }
  await c.env.DB.prepare(`INSERT INTO audit_logs (usuario_id, accion, tabla, registro_id) VALUES (?, 'CREAR_PENDIENTE', 'pendientes', ?)`).bind(usuario.id, result.meta.last_row_id).run()
  const pendiente = await c.env.DB.prepare(`SELECT * FROM pendientes WHERE id = ?`).bind(result.meta.last_row_id).first()
  return c.json({ success: true, pendiente }, 201)
})

pendientesRoutes.put('/:id', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const id = c.req.param('id')
  const pendiente = await c.env.DB.prepare(`SELECT * FROM pendientes WHERE id = ?`).bind(id).first() as any
  if (!pendiente) return c.json({ error: 'No encontrado' }, 404)
  if (!['superadmin','supervisor'].includes(usuario.rol) && pendiente.usuario_id !== usuario.id) return c.json({ error: 'Sin permisos' }, 403)
  const body = await c.req.json()
  const { cliente_nombre, cliente_cedula, cliente_telefono, descripcion, monto_total, fecha_vencimiento, prioridad, notas, estado } = body
  await c.env.DB.prepare(
    `UPDATE pendientes SET cliente_nombre=COALESCE(?,cliente_nombre), cliente_cedula=COALESCE(?,cliente_cedula), cliente_telefono=COALESCE(?,cliente_telefono), descripcion=COALESCE(?,descripcion), monto_total=COALESCE(?,monto_total), fecha_vencimiento=COALESCE(?,fecha_vencimiento), prioridad=COALESCE(?,prioridad), notas=COALESCE(?,notas), estado=COALESCE(?,estado), updated_at=datetime('now') WHERE id=?`
  ).bind(cliente_nombre||null, cliente_cedula||null, cliente_telefono||null, descripcion||null, monto_total?Number(monto_total):null, fecha_vencimiento||null, prioridad||null, notas||null, estado||null, id).run()
  const actualizado = await c.env.DB.prepare(`SELECT * FROM pendientes WHERE id = ?`).bind(id).first()
  return c.json({ success: true, pendiente: actualizado })
})

pendientesRoutes.post('/:id/pagar', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const id = c.req.param('id')
  const { monto, metodo_pago, referencia, observaciones, caja_id } = await c.req.json()
  if (!monto || Number(monto) <= 0) return c.json({ error: 'Monto inválido' }, 400)
  const pendiente = await c.env.DB.prepare(`SELECT * FROM pendientes WHERE id = ?`).bind(id).first() as any
  if (!pendiente) return c.json({ error: 'No encontrado' }, 404)
  if (pendiente.estado === 'pagado') return c.json({ error: 'Ya está pagado' }, 400)
  if (!['superadmin','supervisor'].includes(usuario.rol) && pendiente.usuario_id !== usuario.id) return c.json({ error: 'Sin permisos' }, 403)
  const montoPago = Number(monto)
  if (montoPago > Number(pendiente.monto_pendiente)) return c.json({ error: `Pago ($${montoPago}) excede saldo pendiente ($${pendiente.monto_pendiente})` }, 400)

  // Registrar abono (tabla real: abonos_pendientes: id, pendiente_id, caja_id, monto, notas, created_at)
  const notasAbono = [metodo_pago, referencia, observaciones].filter(Boolean).join(' | ')
  await c.env.DB.prepare(`INSERT INTO abonos_pendientes (pendiente_id, caja_id, monto, notas) VALUES (?, ?, ?, ?)`).bind(id, caja_id || null, montoPago, notasAbono || null).run()

  const nuevoMontoPagado = Number(pendiente.monto_pagado) + montoPago
  const nuevoMontoPendiente = Number(pendiente.monto_total) - nuevoMontoPagado
  // Si queda saldo 0 o menos → pagado y se elimina (anulado no, eliminado físico)
  const nuevoEstado = nuevoMontoPendiente <= 0 ? 'pagado' : 'parcial'

  await c.env.DB.prepare(`UPDATE pendientes SET monto_pagado=?, monto_pendiente=?, estado=?, updated_at=datetime('now') WHERE id=?`).bind(nuevoMontoPagado, Math.max(0, nuevoMontoPendiente), nuevoEstado, id).run()

  // Si ya está pagado totalmente → eliminar el registro (queda en movimientos como historial)
  if (nuevoEstado === 'pagado') {
    await c.env.DB.prepare(`DELETE FROM pendientes WHERE id = ?`).bind(id).run()
    // Registrar movimiento de EGRESO (devolución/pago) en la caja si hay caja_id
    if (caja_id) {
      const cajaOk = await c.env.DB.prepare(`SELECT id FROM cajas WHERE id = ? AND estado = 'abierta'`).bind(caja_id).first()
      if (cajaOk) {
        await c.env.DB.prepare(`INSERT INTO movimientos (caja_id, usuario_id, tipo, categoria, descripcion, monto, referencia) VALUES (?, ?, 'egreso', 'Pago de deuda', ?, ?, ?)`).bind(caja_id, usuario.id, `Devolución/Pago total: ${pendiente.descripcion} - ${pendiente.cliente_nombre}`, montoPago, referencia || null).run()
        await c.env.DB.prepare(`UPDATE cajas SET total_egresos=(SELECT COALESCE(SUM(monto),0) FROM movimientos WHERE caja_id=? AND tipo='egreso'), updated_at=datetime('now') WHERE id=?`).bind(caja_id, caja_id).run()
      }
    }
    await c.env.DB.prepare(`INSERT INTO audit_logs (usuario_id, accion, tabla, registro_id) VALUES (?, 'PAGAR_ELIMINAR_PENDIENTE', 'pendientes', ?)`).bind(usuario.id, id).run()
    return c.json({ success: true, pago_registrado: montoPago, nuevo_estado: 'pagado', eliminado: true })
  }

  if (caja_id) {
    const cajaOk = await c.env.DB.prepare(`SELECT id FROM cajas WHERE id = ? AND estado = 'abierta'`).bind(caja_id).first()
    if (cajaOk) {
      // Abono parcial → egreso (estás devolviendo/pagando parte de lo pendiente)
      await c.env.DB.prepare(`INSERT INTO movimientos (caja_id, usuario_id, tipo, categoria, descripcion, monto, referencia) VALUES (?, ?, 'egreso', 'Pago de deuda', ?, ?, ?)`).bind(caja_id, usuario.id, `Abono: ${pendiente.descripcion} - ${pendiente.cliente_nombre} ($${montoPago} de $${pendiente.monto_total})`, montoPago, referencia || null).run()
      await c.env.DB.prepare(`UPDATE cajas SET total_egresos=(SELECT COALESCE(SUM(monto),0) FROM movimientos WHERE caja_id=? AND tipo='egreso'), updated_at=datetime('now') WHERE id=?`).bind(caja_id, caja_id).run()
    }
  }
  await c.env.DB.prepare(`INSERT INTO audit_logs (usuario_id, accion, tabla, registro_id) VALUES (?, 'PAGAR_PENDIENTE', 'pendientes', ?)`).bind(usuario.id, id).run()
  const actualizado = await c.env.DB.prepare(`SELECT * FROM pendientes WHERE id = ?`).bind(id).first()
  return c.json({ success: true, pendiente: actualizado, pago_registrado: montoPago, nuevo_estado: nuevoEstado })
})

pendientesRoutes.delete('/:id', async (c) => {
  const usuario = c.get('usuario' as any) as any
  const id = c.req.param('id')
  const { motivo } = await c.req.json().catch(() => ({ motivo: '' }))
  const pendiente = await c.env.DB.prepare(`SELECT * FROM pendientes WHERE id = ?`).bind(id).first() as any
  if (!pendiente) return c.json({ error: 'No encontrado' }, 404)
  if (!['superadmin','supervisor'].includes(usuario.rol) && pendiente.usuario_id !== usuario.id) return c.json({ error: 'Sin permisos' }, 403)
  await c.env.DB.prepare(`UPDATE pendientes SET estado='anulado', notas=COALESCE(notas||' | Anulado: '||?, 'Anulado: '||?), updated_at=datetime('now') WHERE id=?`).bind(motivo||'Sin motivo', motivo||'Sin motivo', id).run()
  return c.json({ success: true })
})
