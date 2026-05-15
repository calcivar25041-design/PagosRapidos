// ============================================================
// STARTUP - Inicialización automática de la base de datos
// Roles: superadmin (acceso total) | supervisor (solo lectura) | trabajador (su caja)
// ============================================================

// SHA-256 con salt — idéntico al usado en auth.ts
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'pagosrapidos_salt_2024')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Migración del schema viejo → nuevo ──────────────────────────────────────
// SQLite no permite ALTER COLUMN ni DROP CONSTRAINT, así que:
// 1. Renombra la tabla vieja
// 2. Crea la nueva con el schema correcto
// 3. Copia los datos migrando roles (admin→superadmin, trabajador→trabajador)
// 4. Elimina la vieja
export async function migrateDatabase(db: D1Database): Promise<void> {
  try {
    // 1. Si existe tabla _old de una migración anterior incompleta, limpiarla
    const oldTable = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios_old'`
    ).first()
    if (oldTable) {
      await db.prepare(`DROP TABLE IF EXISTS usuarios_old`).run()
      console.log('🧹 Limpiada tabla usuarios_old residual')
    }

    // 2. Detectar si la tabla usuarios tiene el schema viejo (con rol 'admin')
    const tableInfo = await db.prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='usuarios'`
    ).first<{ sql: string }>()

    if (!tableInfo) return // tabla no existe, nada que migrar

    const schemaSQL = tableInfo.sql || ''

    // Si el schema ya menciona 'superadmin', ya fue migrado
    if (schemaSQL.includes('superadmin')) return

    console.log('🔄 Migrando schema de usuarios al nuevo formato de roles...')

    // Paso 1: renombrar tabla vieja
    await db.prepare(`ALTER TABLE usuarios RENAME TO usuarios_old`).run()

    // Paso 2: crear tabla nueva con schema correcto
    await db.prepare(`CREATE TABLE usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cedula TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'trabajador' CHECK(rol IN ('superadmin','supervisor','trabajador')),
      activo INTEGER NOT NULL DEFAULT 1,
      ultimo_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run()

    // Paso 3: copiar datos migrando roles (admin → superadmin)
    await db.prepare(`
      INSERT INTO usuarios (id, cedula, nombre, apellido, email, password_hash, rol, activo, ultimo_login, created_at, updated_at)
      SELECT
        id,
        cedula,
        nombre,
        COALESCE(apellido, ''),
        email,
        password_hash,
        CASE
          WHEN rol = 'admin'       THEN 'superadmin'
          WHEN rol = 'supervisor'  THEN 'supervisor'
          ELSE                          'trabajador'
        END,
        activo,
        ultimo_login,
        created_at,
        COALESCE(updated_at, created_at)
      FROM usuarios_old
    `).run()

    // Paso 4: eliminar tabla vieja
    await db.prepare(`DROP TABLE IF EXISTS usuarios_old`).run()

    console.log('✅ Migración de schema completada')
  } catch (err) {
    // Si falla, intentar limpiar tabla temporal
    try { await db.prepare(`DROP TABLE IF EXISTS usuarios_old`).run() } catch {}
    console.error('Error en migrateDatabase:', err)
    // No lanzar — el sistema intenta continuar
  }

  // ── Migración incremental: avatar_color ──────────────────────────────────
  try {
    const cols = await db.prepare(`PRAGMA table_info(usuarios)`).all()
    const tieneAvatarColor = (cols.results as any[]).some((c: any) => c.name === 'avatar_color')
    if (!tieneAvatarColor) {
      await db.prepare(`ALTER TABLE usuarios ADD COLUMN avatar_color TEXT DEFAULT '#1148AD'`).run()
      console.log('✅ Columna avatar_color agregada')
    }
  } catch (err) { console.error('Error avatar_color migration:', err) }
}

export async function initDatabase(db: D1Database): Promise<void> {
  try {
    await db.batch([
      // ── usuarios (con 3 roles) ──────────────────────────────────────────────
      db.prepare(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cedula TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        apellido TEXT NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'trabajador' CHECK(rol IN ('superadmin','supervisor','trabajador')),
        activo INTEGER NOT NULL DEFAULT 1,
        ultimo_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      // ── cajas ──────────────────────────────────────────────────────────────
      db.prepare(`CREATE TABLE IF NOT EXISTS cajas (
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
      )`),
      // ── movimientos ────────────────────────────────────────────────────────
      db.prepare(`CREATE TABLE IF NOT EXISTS movimientos (
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
      )`),
      // ── pendientes / cuentas por cobrar ────────────────────────────────────
      db.prepare(`CREATE TABLE IF NOT EXISTS pendientes (
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
      )`),
      // ── abonos a pendientes ────────────────────────────────────────────────
      db.prepare(`CREATE TABLE IF NOT EXISTS abonos_pendientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pendiente_id INTEGER NOT NULL,
        caja_id INTEGER NOT NULL,
        monto REAL NOT NULL CHECK(monto > 0),
        notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pendiente_id) REFERENCES pendientes(id),
        FOREIGN KEY (caja_id) REFERENCES cajas(id)
      )`),
      // ── categorías ────────────────────────────────────────────────────────
      db.prepare(`CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
        color TEXT DEFAULT '#6B7280',
        icono TEXT DEFAULT 'circle',
        activo INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      // ── sesiones ──────────────────────────────────────────────────────────
      db.prepare(`CREATE TABLE IF NOT EXISTS sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`),
      // ── audit_logs ────────────────────────────────────────────────────────
      db.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
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
      )`),
      // ── configuracion ─────────────────────────────────────────────────────
      db.prepare(`CREATE TABLE IF NOT EXISTS configuracion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave TEXT UNIQUE NOT NULL,
        valor TEXT NOT NULL,
        descripcion TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
    ])

    // Índices
    await db.batch([
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_cajas_usuario_fecha ON cajas(usuario_id, fecha)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_movimientos_caja ON movimientos(caja_id)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_pendientes_usuario ON pendientes(usuario_id)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_pendientes_estado ON pendientes(estado)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token)`),
    ])

    // Configuración inicial
    const configExiste = await db.prepare(`SELECT id FROM configuracion WHERE clave='version' LIMIT 1`).first()
    if (!configExiste) {
      await db.batch([
        db.prepare(`INSERT OR IGNORE INTO configuracion (clave,valor,descripcion) VALUES ('nombre_empresa','Pagos Rapidos','Nombre de la empresa')`),
        db.prepare(`INSERT OR IGNORE INTO configuracion (clave,valor,descripcion) VALUES ('agencia','Agencia Alban Borja','Nombre agencia')`),
        db.prepare(`INSERT OR IGNORE INTO configuracion (clave,valor,descripcion) VALUES ('moneda','USD','Moneda')`),
        db.prepare(`INSERT OR IGNORE INTO configuracion (clave,valor,descripcion) VALUES ('simbolo_moneda','$','Símbolo')`),
        db.prepare(`INSERT OR IGNORE INTO configuracion (clave,valor,descripcion) VALUES ('dias_alerta_vencimiento','3','Días anticipación alertas')`),
        db.prepare(`INSERT OR IGNORE INTO configuracion (clave,valor,descripcion) VALUES ('max_diferencia_permitida','5.00','Diferencia máx cuadre')`),
        db.prepare(`INSERT OR IGNORE INTO configuracion (clave,valor,descripcion) VALUES ('version','1.0.0','Versión del sistema')`),
      ])
    }

    // Categorías
    const catExiste = await db.prepare(`SELECT id FROM categorias LIMIT 1`).first()
    if (!catExiste) {
      const cats = [
        ['Cobro de Servicio','ingreso','#10B981'],
        ['Pago de Deuda','ingreso','#3B82F6'],
        ['Transferencia Recibida','ingreso','#8B5CF6'],
        ['Deposito en Efectivo','ingreso','#F59E0B'],
        ['Abono de Cliente','ingreso','#06B6D4'],
        ['Otros Ingresos','ingreso','#6B7280'],
        ['Gasto Operativo','egreso','#EF4444'],
        ['Pago a Proveedor','egreso','#F97316'],
        ['Transferencia Enviada','egreso','#EC4899'],
        ['Comisiones','egreso','#6366F1'],
        ['Servicios Basicos','egreso','#14B8A6'],
        ['Otros Egresos','egreso','#6B7280'],
      ]
      await db.batch(cats.map(([nombre,tipo,color]) =>
        db.prepare(`INSERT OR IGNORE INTO categorias (nombre,tipo,color) VALUES (?,?,?)`).bind(nombre,tipo,color)
      ))
    }
  } catch (err) {
    console.error('Error en initDatabase:', err)
    throw err
  }
}

// Crea / actualiza el superadmin propietario
export async function ensureAdminExists(db: D1Database): Promise<void> {
  try {
    const hash = await hashPassword('Theking&')

    // Verificar si ya existe
    const admin = await db.prepare(
      `SELECT id, rol, password_hash FROM usuarios WHERE cedula='1314221597' LIMIT 1`
    ).first<{ id: number; rol: string; password_hash: string }>()

    if (!admin) {
      // No existe → crear
      await db.prepare(
        `INSERT OR IGNORE INTO usuarios (cedula,nombre,apellido,email,password_hash,rol,activo)
         VALUES ('1314221597','Administrador','Sistema','admin@pagosrapidos.com',?,'superadmin',1)`
      ).bind(hash).run()
      console.log('✅ Superadmin creado: cedula=1314221597')
    } else {
      // Existe → asegurar rol superadmin Y actualizar password al correcto
      await db.prepare(
        `UPDATE usuarios SET rol='superadmin', password_hash=?, activo=1, updated_at=CURRENT_TIMESTAMP
         WHERE cedula='1314221597'`
      ).bind(hash).run()
      console.log('✅ Superadmin verificado y actualizado')
    }
  } catch (err) {
    console.error('Error en ensureAdminExists:', err)
  }
}
