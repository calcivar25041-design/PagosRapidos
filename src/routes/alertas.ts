import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type Variables = { usuario: { id: number; cedula: string; nombre: string; apellido: string; rol: string } }

export const alertasRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /api/alertas - Todas las alertas del usuario
alertasRoutes.get('/', async (c) => {
  const usuario = c.get('usuario')
  const whereUsuario = !['superadmin','supervisor'].includes(usuario.rol) ? `AND p.usuario_id = ${usuario.id}` : ''

  // Auto-actualizar vencidos
  await c.env.DB.prepare(
    `UPDATE pendientes SET estado = 'vencido', updated_at = datetime('now')
     WHERE estado IN ('pendiente','parcial') AND fecha_vencimiento < date('now')`
  ).run()

  // Pendientes próximos a vencer (7 días)
  const { results: proximosVencer } = await c.env.DB.prepare(`
    SELECT p.id, p.cliente_nombre, p.descripcion, p.monto_pendiente, p.fecha_vencimiento, p.prioridad, p.estado,
      u.nombre as usuario_nombre, u.apellido as usuario_apellido,
      CAST((julianday(p.fecha_vencimiento) - julianday('now')) AS INTEGER) as dias_restantes
    FROM pendientes p JOIN usuarios u ON u.id = p.usuario_id
    WHERE p.estado IN ('pendiente','parcial')
      AND p.fecha_vencimiento IS NOT NULL
      AND p.fecha_vencimiento BETWEEN date('now') AND date('now', '+7 days')
      ${whereUsuario}
    ORDER BY p.fecha_vencimiento ASC
  `).all<any>()

  // Pendientes vencidos
  const { results: vencidos } = await c.env.DB.prepare(`
    SELECT p.id, p.cliente_nombre, p.descripcion, p.monto_pendiente, p.fecha_vencimiento, p.prioridad,
      u.nombre as usuario_nombre, u.apellido as usuario_apellido,
      CAST((julianday('now') - julianday(p.fecha_vencimiento)) AS INTEGER) as dias_vencido
    FROM pendientes p JOIN usuarios u ON u.id = p.usuario_id
    WHERE p.estado = 'vencido' ${whereUsuario}
    ORDER BY p.fecha_vencimiento ASC LIMIT 20
  `).all<any>()

  // Cajas sin cuadrar (de días anteriores)
  const { results: cajasSinCuadrar } = await c.env.DB.prepare(`
    SELECT c.id, c.fecha, c.estado, u.nombre, u.apellido
    FROM cajas c JOIN usuarios u ON u.id = c.usuario_id
    WHERE c.estado = 'abierta' AND c.fecha < date('now')
    ${!['superadmin','supervisor'].includes(usuario.rol) ? `AND c.usuario_id = ${usuario.id}` : ''}
    ORDER BY c.fecha ASC LIMIT 10
  `).all<any>()

  // Pendientes de alta prioridad sin vencimiento
  const { results: altaPrioridad } = await c.env.DB.prepare(`
    SELECT p.id, p.cliente_nombre, p.descripcion, p.monto_pendiente, p.prioridad,
      u.nombre as usuario_nombre, u.apellido as usuario_apellido
    FROM pendientes p JOIN usuarios u ON u.id = p.usuario_id
    WHERE p.estado IN ('pendiente','parcial') 
      AND p.prioridad IN ('alta','urgente')
      AND (p.fecha_vencimiento IS NULL OR p.fecha_vencimiento > date('now', '+7 days'))
      ${whereUsuario}
    ORDER BY CASE p.prioridad WHEN 'urgente' THEN 1 ELSE 2 END, p.created_at DESC
    LIMIT 10
  `).all<any>()

  const totalAlertas = proximosVencer.length + vencidos.length + cajasSinCuadrar.length

  return c.json({
    total: totalAlertas,
    proximos_vencer: proximosVencer,
    vencidos,
    cajas_sin_cuadrar: cajasSinCuadrar,
    alta_prioridad: altaPrioridad,
  })
})
