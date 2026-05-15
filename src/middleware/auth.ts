import { createMiddleware } from 'hono/factory'

type Bindings = { DB: D1Database }
type Variables = {
  usuario: { id: number; cedula: string; nombre: string; apellido: string; rol: string }
}

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization')
    const cookieHeader = c.req.header('Cookie')
    let token: string | undefined

    if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7)
    else if (cookieHeader) {
      const match = cookieHeader.match(/session=([^;]+)/)
      if (match) token = match[1]
    }

    if (!token) return c.json({ error: 'No autenticado', code: 'UNAUTHORIZED' }, 401)

    try {
      const sesion = await c.env.DB.prepare(
        `SELECT s.token, s.expires_at,
                u.id as uid, u.cedula, u.nombre, u.apellido, u.rol, u.activo
         FROM sesiones s
         JOIN usuarios u ON u.id = s.usuario_id
         WHERE s.token = ? AND s.expires_at > datetime('now')
         LIMIT 1`
      ).bind(token).first<any>()

      if (!sesion) return c.json({ error: 'Sesión expirada o inválida', code: 'SESSION_EXPIRED' }, 401)
      if (!sesion.activo) return c.json({ error: 'Usuario inactivo', code: 'USER_INACTIVE' }, 403)

      c.set('usuario', {
        id: sesion.uid,
        cedula: sesion.cedula,
        nombre: sesion.nombre,
        apellido: sesion.apellido,
        rol: sesion.rol,
      })
      await next()
    } catch (err) {
      console.error('Auth middleware error:', err)
      return c.json({ error: 'Error de autenticación' }, 500)
    }
  }
)
