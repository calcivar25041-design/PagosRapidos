-- ============================================================
-- SEED DATA - Pagos Rapidos Sistema de Gestión
-- ============================================================

-- Admin por defecto: cedula=admin, password=Admin2024!
-- Hash bcrypt de 'Admin2024!' (simulado con SHA256 base64 para CF Workers)
INSERT OR IGNORE INTO usuarios (cedula, nombre, apellido, email, password_hash, rol) VALUES 
  ('admin', 'Administrador', 'Sistema', 'admin@pagosrapidos.com', '$2admin$hash$Admin2024!$placeholder', 'admin'),
  ('1001234567', 'Carlos', 'Alban', 'carlos@pagosrapidos.com', '$2worker$hash$Worker2024!$placeholder', 'trabajador'),
  ('1002345678', 'María', 'Borja', 'maria@pagosrapidos.com', '$2worker$hash$Worker2024!$placeholder', 'trabajador'),
  ('1003456789', 'Juan', 'Pérez', 'juan@pagosrapidos.com', '$2worker$hash$Worker2024!$placeholder', 'trabajador');

-- Categorías predeterminadas de ingresos
INSERT OR IGNORE INTO categorias (nombre, tipo, color, icono) VALUES
  ('Cobro de Servicio', 'ingreso', '#10B981', 'credit-card'),
  ('Pago de Deuda', 'ingreso', '#3B82F6', 'check-circle'),
  ('Transferencia Recibida', 'ingreso', '#8B5CF6', 'arrow-down'),
  ('Depósito en Efectivo', 'ingreso', '#F59E0B', 'dollar-sign'),
  ('Abono de Cliente', 'ingreso', '#06B6D4', 'users'),
  ('Otros Ingresos', 'ingreso', '#6B7280', 'plus-circle');

-- Categorías predeterminadas de egresos
INSERT OR IGNORE INTO categorias (nombre, tipo, color, icono) VALUES
  ('Gasto Operativo', 'egreso', '#EF4444', 'minus-circle'),
  ('Pago a Proveedor', 'egreso', '#F97316', 'shopping-cart'),
  ('Transferencia Enviada', 'egreso', '#EC4899', 'arrow-up'),
  ('Comisiones', 'egreso', '#6366F1', 'percent'),
  ('Servicios Básicos', 'egreso', '#14B8A6', 'zap'),
  ('Otros Egresos', 'egreso', '#6B7280', 'minus');

-- Configuración inicial del sistema
INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) VALUES
  ('nombre_empresa', 'Pagos Rapidos', 'Nombre de la empresa'),
  ('agencia', 'Agencia Alban Borja', 'Nombre de la agencia'),
  ('moneda', 'USD', 'Moneda del sistema'),
  ('simbolo_moneda', '$', 'Símbolo de la moneda'),
  ('dias_alerta_vencimiento', '3', 'Días de anticipación para alertar vencimiento'),
  ('max_diferencia_permitida', '5.00', 'Diferencia máxima permitida en cuadre de caja ($)'),
  ('version', '1.0.0', 'Versión del sistema');
