-- ============================================================
-- SISTEMA DE GESTIÓN DE CAJA Y PENDIENTES
-- Pagos Rapidos - Agencia Alban Borja
-- Migración inicial v1.0
-- ============================================================

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cedula TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'trabajador' CHECK(rol IN ('admin', 'trabajador')),
  activo INTEGER NOT NULL DEFAULT 1,
  ultimo_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de cajas (una por trabajador por día)
CREATE TABLE IF NOT EXISTS cajas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  fecha DATE NOT NULL,
  saldo_inicial REAL NOT NULL DEFAULT 0,
  saldo_final REAL,
  saldo_fisico_real REAL,
  total_ingresos REAL DEFAULT 0,
  total_egresos REAL DEFAULT 0,
  diferencia REAL,
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK(estado IN ('abierta', 'cuadrada', 'aprobada', 'observada')),
  observaciones TEXT,
  aprobado_por INTEGER,
  aprobado_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (aprobado_por) REFERENCES usuarios(id),
  UNIQUE(usuario_id, fecha)
);

-- Tabla de movimientos (ingresos/egresos)
CREATE TABLE IF NOT EXISTS movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caja_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('ingreso', 'egreso')),
  categoria TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  monto REAL NOT NULL CHECK(monto > 0),
  comprobante_url TEXT,
  referencia TEXT,
  pendiente_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caja_id) REFERENCES cajas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (pendiente_id) REFERENCES pendientes(id)
);

-- Tabla de pendientes (cuentas por cobrar)
CREATE TABLE IF NOT EXISTS pendientes (
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
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'parcial', 'pagado', 'vencido', 'incobrable')),
  prioridad TEXT NOT NULL DEFAULT 'normal' CHECK(prioridad IN ('baja', 'normal', 'alta', 'urgente')),
  notas TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Tabla de abonos a pendientes
CREATE TABLE IF NOT EXISTS abonos_pendientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pendiente_id INTEGER NOT NULL,
  caja_id INTEGER NOT NULL,
  monto REAL NOT NULL CHECK(monto > 0),
  notas TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pendiente_id) REFERENCES pendientes(id),
  FOREIGN KEY (caja_id) REFERENCES cajas(id)
);

-- Tabla de categorías configurables
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('ingreso', 'egreso')),
  color TEXT DEFAULT '#6B7280',
  icono TEXT DEFAULT 'circle',
  activo INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Tabla de logs de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
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
);

-- Tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS configuracion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clave TEXT UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  descripcion TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cajas_usuario_fecha ON cajas(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_cajas_fecha ON cajas(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja ON movimientos(caja_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(created_at);
CREATE INDEX IF NOT EXISTS idx_pendientes_usuario ON pendientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pendientes_estado ON pendientes(estado);
CREATE INDEX IF NOT EXISTS idx_pendientes_vencimiento ON pendientes(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON audit_logs(usuario_id);
