import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type Variables = { usuario: any }

export const cuadreRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ─────────────────────────────────────────────────────────────────────────────
// ESTRUCTURA REAL DEL EXCEL (verificada contra 3 archivos reales):
//
// El XLSX tiene DOS hojas:
//   HOJA1 (sheet1.xml) = Estado de APERTURA del día (saldo inicial)
//     Fila 1:  ["INICIAL HH:MM:SS", ..., "SISTEMAS/CUENTAS", ..., "SALDOS"]
//     Filas 2-13: [denom, qty, subtotal, null, nombre_sistema, null, saldo]
//     Fila 16: [null, null, total_efectivo_apertura, null, null, null, total_sistemas_apertura]
//
//   HOJA2 (sheet2.xml) = Estado de CIERRE del día + metadatos
//     Fila 2:  ["NOMBRE:", "CARLOS", ...]
//     Fila 3:  ["FECHA: DD-MM-YYYY HH:MM", ..., "SISTEMAS/CUENTAS", ..., "SALDOS"]
//     Filas 4-15: [denom, qty, subtotal, null, nombre_sistema, null, saldo]
//     Fila 16: [null, null, 0(*), null, "total dia", null, total_sistemas_cierre]
//     Fila 17: [null, null, null, null, "GANANCIA CAJA", null, ganancia]
//     Fila 18: [null, null, saldo_efectivo_fisico, ...]   ← efectivo físico real
//     Fila 20: ["OBSERVACIONES", ..., "VALOR", "HORA"]
//     Filas 21,23,25...: [descripcion_obs, ..., valor_obs]  (impares, hasta ~fila 45)
//
// FÓRMULA DE GANANCIA (verificada con los 3 casos):
//   ganancia = total_sistemas_cierre(H2) - total_sistemas_apertura(H1) + suma_observaciones
//   (*) La col C de fila16 en H2 es siempre 0 (no la suma de efectivo del cierre)
//       El efectivo físico real del cierre está en H2-fila18-colC
//
// LÓGICA DE CUADRE:
//   - saldo_apertura_total = efect_apertura + sis_apertura  (desde Hoja1)
//   - saldo_cierre_total   = efect_cierre   + sis_cierre    (desde Hoja2)
//   - ganancia_declarada   = H2-fila17-colG (ya está calculada en el Excel)
//   - ganancia_verificada  = sis_cierre - sis_apertura + obs_netas
//   - diferencia_vs_sistema = saldo_cierre_total - saldo_sistema_D1
// ─────────────────────────────────────────────────────────────────────────────

// ─── POST /api/cuadre/excel ───────────────────────────────────────────────────
cuadreRoutes.post('/excel', async (c) => {
  try {
    const usuario = c.get('usuario' as any) as any
    const { nombre, datos } = await c.req.json()
    if (!datos) return c.json({ error: 'No se recibieron datos del archivo' }, 400)

    // Base64 → ArrayBuffer
    const binaryStr = atob(datos)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

    // Parsear XLSX — el trabajo real
    const resultado = await parsearExcelCuadre(bytes.buffer)

    // Saldo del sistema en D1 para el día del cuadre
    // Intentamos con la fecha del Excel; si no hay, usamos hoy
    let fechaConsulta = resultado.fecha_iso || new Date().toISOString().split('T')[0]
    const cajaDB = await c.env.DB.prepare(`
      SELECT c.id, c.saldo_inicial, c.fecha,
        COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0) as total_ingresos,
        COALESCE(SUM(CASE WHEN m.tipo='egreso'  THEN m.monto ELSE 0 END),0) as total_egresos
      FROM cajas c LEFT JOIN movimientos m ON m.caja_id=c.id
      WHERE c.usuario_id=? AND c.fecha=?
      GROUP BY c.id LIMIT 1
    `).bind(usuario.id, fechaConsulta).first() as any

    const saldo_sistema = cajaDB
      ? Number(cajaDB.saldo_inicial) + Number(cajaDB.total_ingresos) - Number(cajaDB.total_egresos)
      : null  // null = no hay caja ese día en el sistema

    // Diferencia entre efectivo declarado y sistema
    const diferencia_efectivo = saldo_sistema !== null
      ? Math.round((resultado.total_efectivo_cierre - saldo_sistema) * 100) / 100
      : null

    return c.json({
      success: true,
      nombre: nombre || 'cuadre.xlsx',
      ...resultado,
      saldo_sistema,
      diferencia_efectivo,
      caja_db: cajaDB ? {
        id: cajaDB.id,
        fecha: cajaDB.fecha,
        saldo_inicial: cajaDB.saldo_inicial,
        ingresos: cajaDB.total_ingresos,
        egresos: cajaDB.total_egresos,
      } : null,
    })
  } catch (err: any) {
    console.error('Error procesando Excel:', err)
    return c.json({ error: 'Error al procesar el archivo: ' + err.message }, 500)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
interface DetalleEfectivo {
  denominacion: number
  cantidad: number
  subtotal: number
}
interface DetalleSistema {
  nombre: string
  saldo_apertura: number
  saldo_cierre: number
  diferencia: number
}
interface Observacion {
  descripcion: string
  valor: number
}
interface ResultadoCuadre {
  nombre_trabajador: string
  fecha_cuadre: string      // "23-01-2026"
  fecha_iso: string         // "2026-01-23"
  hora_apertura: string     // "09:35:00"
  // Apertura (Hoja1)
  efectivo_apertura: DetalleEfectivo[]
  total_efectivo_apertura: number
  sistemas_apertura: DetalleSistema[]
  total_sistemas_apertura: number
  total_apertura: number
  // Cierre (Hoja2)
  efectivo_cierre: DetalleEfectivo[]
  total_efectivo_cierre: number   // suma de denom×qty en Hoja2
  saldo_efectivo_fisico: number   // H2-F18-C (lo que hay físicamente en caja)
  sistemas_cierre: DetalleSistema[]
  total_sistemas_cierre: number
  total_cierre: number
  // Observaciones
  observaciones: Observacion[]
  total_observaciones: number
  // Ganancia
  ganancia_declarada: number     // H2-F17-G (calculada por el Excel)
  ganancia_verificada: number    // recalculada por nosotros para validar
  ganancia_ok: boolean           // si coinciden (diff < $0.02)
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
async function parsearExcelCuadre(buffer: ArrayBuffer): Promise<ResultadoCuadre> {
  const data = new Uint8Array(buffer)
  const archivos = parsearZIP(data)

  // Extraer sharedStrings y las dos hojas
  let xmlShared = ''
  let xmlSheet1 = ''   // Hoja1 = apertura
  let xmlSheet2 = ''   // Hoja2 = cierre + metadatos

  for (const f of archivos) {
    if (f.name === 'xl/sharedStrings.xml')        xmlShared  = await descomprimirEntrada(data, f)
    else if (f.name === 'xl/worksheets/sheet1.xml') xmlSheet1  = await descomprimirEntrada(data, f)
    else if (f.name === 'xl/worksheets/sheet2.xml') xmlSheet2  = await descomprimirEntrada(data, f)
  }

  if (!xmlSheet1 && !xmlSheet2) throw new Error('El archivo no contiene hojas válidas')

  const ss = extraerSharedStrings(xmlShared)
  // Hoja1 puede ser apertura o cierre según el workbook.xml.
  // En los 3 archivos reales: sheet1 = apertura (INICIAL), sheet2 = cierre (NOMBRE/FECHA)
  const hoja1 = extraerHoja(xmlSheet1, ss)   // apertura
  const hoja2 = extraerHoja(xmlSheet2, ss)   // cierre

  // ── APERTURA: Hoja1 ────────────────────────────────────────────────────────
  // Fila 1 col 0: "INICIAL HH:MM:SS"
  const horaTexto = str(get(hoja1, 1, 0))
  const hora_apertura = horaTexto.replace(/^INICIAL\s*/i, '').trim()

  // Filas 2-13: efectivo y sistemas de apertura
  const efectivo_apertura: DetalleEfectivo[] = []
  const sistemas_apertura_raw: { nombre: string; saldo: number }[] = []

  for (let r = 2; r <= 13; r++) {
    const fila = hoja1[r] || {}
    const denom = num(get(hoja1, r, 0))
    const qty   = num(get(hoja1, r, 1))
    const sub   = num(get(hoja1, r, 2))
    if (denom > 0) {
      efectivo_apertura.push({ denominacion: denom, cantidad: qty, subtotal: Math.round(sub * 100) / 100 })
    }
    const nomSis = str(get(hoja1, r, 4)).trim()
    const salSis = num(get(hoja1, r, 6))
    if (nomSis && salSis !== 0) {
      sistemas_apertura_raw.push({ nombre: normalNombre(nomSis), saldo: salSis })
    }
  }

  const total_efectivo_apertura = round2(efectivo_apertura.reduce((s, e) => s + e.subtotal, 0))
  const total_sistemas_apertura = round2(sistemas_apertura_raw.reduce((s, e) => s + e.saldo, 0))

  // ── CIERRE: Hoja2 ──────────────────────────────────────────────────────────
  // Fila 2 col 1: nombre trabajador
  const nombre_trabajador = str(get(hoja2, 2, 1)).trim()

  // Fila 3 col 0: "FECHA: DD-MM-YYYY HH:MM"
  const fechaTexto = str(get(hoja2, 3, 0))
  const fechaMatch = fechaTexto.match(/(\d{2})-(\d{2})-(\d{4})/)
  const fecha_cuadre = fechaMatch ? `${fechaMatch[1]}-${fechaMatch[2]}-${fechaMatch[3]}` : ''
  const fecha_iso    = fechaMatch ? `${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}` : ''

  // Filas 4-15: efectivo y sistemas de cierre
  const efectivo_cierre: DetalleEfectivo[] = []
  const sistemas_cierre_raw: { nombre: string; saldo: number }[] = []

  for (let r = 4; r <= 15; r++) {
    const denom = num(get(hoja2, r, 0))
    const qty   = num(get(hoja2, r, 1))
    const sub   = num(get(hoja2, r, 2))
    if (denom > 0) {
      efectivo_cierre.push({ denominacion: denom, cantidad: qty, subtotal: Math.round(sub * 100) / 100 })
    }
    const nomSis = str(get(hoja2, r, 4)).trim()
    const salSis = num(get(hoja2, r, 6))
    if (nomSis && salSis !== 0) {
      sistemas_cierre_raw.push({ nombre: normalNombre(nomSis), saldo: salSis })
    }
  }

  // Fila 16 col 6: total_sistemas_cierre (lo llaman "total dia")
  const total_sistemas_cierre_check = num(get(hoja2, 16, 6))
  const total_efectivo_cierre = round2(efectivo_cierre.reduce((s, e) => s + e.subtotal, 0))
  const total_sistemas_cierre = round2(sistemas_cierre_raw.reduce((s, e) => s + e.saldo, 0))

  // Fila 17 col 6: ganancia declarada
  const ganancia_declarada = round2(num(get(hoja2, 17, 6)))

  // Fila 18 col 2: saldo físico en caja (lo que queda en el cajón)
  const saldo_efectivo_fisico = round2(num(get(hoja2, 18, 2)))

  // Observaciones: fila 20 = header, impares desde 21 hasta ~45
  const observaciones: Observacion[] = []
  for (let r = 21; r <= 50; r += 2) {
    const desc = str(get(hoja2, r, 0)).trim()
    const val  = num(get(hoja2, r, 6))
    if (desc.length > 1) {
      observaciones.push({ descripcion: desc, valor: round2(val) })
    }
  }
  const total_observaciones = round2(observaciones.reduce((s, o) => s + o.valor, 0))

  // ── CRUCE apertura ↔ cierre para sistemas ──────────────────────────────────
  const sistemas: DetalleSistema[] = sistemas_cierre_raw.map(sc => {
    const sa = sistemas_apertura_raw.find(x => normalNombre(x.nombre) === normalNombre(sc.nombre))
    return {
      nombre: sc.nombre,
      saldo_apertura: sa?.saldo ?? 0,
      saldo_cierre: sc.saldo,
      diferencia: round2(sc.saldo - (sa?.saldo ?? 0)),
    }
  })
  // Agregar sistemas que estaban en apertura pero no en cierre
  for (const sa of sistemas_apertura_raw) {
    if (!sistemas.find(s => normalNombre(s.nombre) === normalNombre(sa.nombre))) {
      sistemas.push({ nombre: sa.nombre, saldo_apertura: sa.saldo, saldo_cierre: 0, diferencia: round2(-sa.saldo) })
    }
  }

  // ── GANANCIA VERIFICADA ────────────────────────────────────────────────────
  // Fórmula probada contra 3 archivos reales: diff = 0.0000 en los 3 casos
  // ganancia = total_sistemas_cierre - total_sistemas_apertura + obs_netas
  const ganancia_verificada = round2(total_sistemas_cierre - total_sistemas_apertura + total_observaciones)
  const ganancia_ok = Math.abs(ganancia_verificada - ganancia_declarada) < 0.02

  return {
    nombre_trabajador,
    fecha_cuadre,
    fecha_iso,
    hora_apertura,
    // Apertura
    efectivo_apertura,
    total_efectivo_apertura,
    sistemas_apertura: sistemas.map(s => ({ ...s })), // misma lista con apertura+cierre
    total_sistemas_apertura,
    total_apertura: round2(total_efectivo_apertura + total_sistemas_apertura),
    // Cierre
    efectivo_cierre,
    total_efectivo_cierre,
    saldo_efectivo_fisico,
    sistemas_cierre: sistemas,
    total_sistemas_cierre,
    total_cierre: round2(total_efectivo_cierre + total_sistemas_cierre),
    // Observaciones
    observaciones,
    total_observaciones,
    // Ganancia
    ganancia_declarada,
    ganancia_verificada,
    ganancia_ok,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE DATOS
// ─────────────────────────────────────────────────────────────────────────────
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}
function str(v: any): string {
  return v === null || v === undefined ? '' : String(v)
}
function get(hoja: Map<string, any>, fila: number, col: number): any {
  return hoja.get(`${fila}_${col}`) ?? null
}
// Normalizar nombres de sistemas para comparación (gold/GOLD PAGOS/gold pagos → GOLD)
function normalNombre(n: string): string {
  return n.toUpperCase().replace(/\s+/g, ' ').trim()
    .replace('GOLD PAGOS', 'GOLD').replace('WESTER UNION', 'WESTER')
    .replace('WESTERN UNION', 'WESTER').replace('WESTER ', 'WESTER')
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER XML — extrae hoja como Map<"fila_col", valor>
// ─────────────────────────────────────────────────────────────────────────────
function extraerHoja(xml: string, ss: string[]): Map<string, any> {
  const mapa = new Map<string, any>()
  if (!xml) return mapa

  // Extraer cada <row r="N">...</row>
  const rowRe = /<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g
  let rowM: RegExpExecArray | null
  while ((rowM = rowRe.exec(xml)) !== null) {
    const rowIdx = parseInt(rowM[1])
    const rowXml = rowM[2]

    // Extraer cada <c r="XN" ...><v>...</v></c>
    const cellRe = /<c\b[^>]*\br="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g
    let cellM: RegExpExecArray | null
    while ((cellM = cellRe.exec(rowXml)) !== null) {
      const colStr  = cellM[1]
      const attrs   = cellM[3]
      const inner   = cellM[4]
      const colIdx  = colLetterToIndex(colStr)

      let valor: any = null

      // Tipo string compartido (t="s")
      if (/\bt="s"/.test(attrs)) {
        const vm = /<v>([\s\S]*?)<\/v>/.exec(inner)
        if (vm) valor = ss[parseInt(vm[1])] ?? ''
      }
      // Tipo inline string (t="inlineStr")
      else if (/\bt="inlineStr"/.test(attrs)) {
        const tm = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)
        if (tm) valor = decodeXML(tm[1])
      }
      // Tipo fórmula con resultado string (t="str")
      else if (/\bt="str"/.test(attrs)) {
        const vm = /<v>([\s\S]*?)<\/v>/.exec(inner)
        if (vm) valor = decodeXML(vm[1])
      }
      // Número (sin tipo o t="n")
      else {
        const vm = /<v>([\s\S]*?)<\/v>/.exec(inner)
        if (vm && vm[1]) {
          const n = parseFloat(vm[1])
          valor = isNaN(n) ? vm[1] : n
        }
      }

      mapa.set(`${rowIdx}_${colIdx}`, valor)
    }
  }
  return mapa
}

function extraerSharedStrings(xml: string): string[] {
  const strings: string[] = []
  if (!xml) return strings
  const siRe = /<si>([\s\S]*?)<\/si>/g
  let m: RegExpExecArray | null
  while ((m = siRe.exec(xml)) !== null) {
    const partes: string[] = []
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g
    let tm: RegExpExecArray | null
    while ((tm = tRe.exec(m[1])) !== null) partes.push(decodeXML(tm[1]))
    strings.push(partes.join(''))
  }
  return strings
}

function colLetterToIndex(col: string): number {
  let idx = 0
  for (let i = 0; i < col.length; i++) idx = idx * 26 + col.charCodeAt(i) - 64
  return idx - 1
}

function decodeXML(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#xD;/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER ZIP + DEFLATE (Web API nativo — funciona en Cloudflare Workers)
// ─────────────────────────────────────────────────────────────────────────────
interface ZipEntry {
  name: string; compSize: number; uncompSize: number; method: number; localOffset: number
}

function parsearZIP(data: Uint8Array): ZipEntry[] {
  const view = new DataView(data.buffer)
  const entries: ZipEntry[] = []

  // Buscar End of Central Directory (0x06054b50) desde el final
  let eocd = -1
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65580); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('No es un archivo ZIP válido (EOCD no encontrado)')

  const cdOffset = view.getUint32(eocd + 16, true)
  const cdCount  = view.getUint16(eocd + 8,  true)
  let pos = cdOffset

  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break
    const method      = view.getUint16(pos + 10, true)
    const compSize    = view.getUint32(pos + 20, true)
    const uncompSize  = view.getUint32(pos + 24, true)
    const nameLen     = view.getUint16(pos + 28, true)
    const extraLen    = view.getUint16(pos + 30, true)
    const commentLen  = view.getUint16(pos + 32, true)
    const localOffset = view.getUint32(pos + 42, true)
    const name        = new TextDecoder().decode(data.slice(pos + 46, pos + 46 + nameLen))
    entries.push({ name, compSize, uncompSize, method, localOffset })
    pos += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function descomprimirEntrada(data: Uint8Array, entry: ZipEntry): Promise<string> {
  const view = new DataView(data.buffer)
  // Saltar Local File Header (firma 0x04034b50)
  const localNameLen  = view.getUint16(entry.localOffset + 26, true)
  const localExtraLen = view.getUint16(entry.localOffset + 28, true)
  const dataStart     = entry.localOffset + 30 + localNameLen + localExtraLen
  const compData      = data.slice(dataStart, dataStart + entry.compSize)

  if (entry.method === 0) {
    // Stored (sin compresión)
    return new TextDecoder().decode(compData)
  }

  if (entry.method === 8) {
    // DEFLATE — DecompressionStream disponible en Cloudflare Workers
    const ds     = new DecompressionStream('deflate-raw')
    const writer = ds.writable.getWriter()
    const reader = ds.readable.getReader()
    writer.write(compData)
    writer.close()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    let total = 0
    for (const c of chunks) total += c.length
    const out = new Uint8Array(total)
    let off = 0
    for (const c of chunks) { out.set(c, off); off += c.length }
    return new TextDecoder().decode(out)
  }

  throw new Error(`Método de compresión ZIP no soportado: ${entry.method}`)
}
