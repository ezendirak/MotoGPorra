/**
 * Verificación de extremo a extremo del esquema y las políticas RLS.
 *
 *   npm run db:verify        (desde la raíz del monorepo)
 *
 * Requiere `.env` con SUPABASE_SERVICE_ROLE_KEY y `apps/web/.env.local` con
 * la URL y la anon key. Crea datos de prueba en la base APUNTADA por esas
 * variables, los ejercita y los borra al terminar — incluidos los usuarios.
 *
 * No sustituye a los tests de la aplicación: comprueba que la base de datos
 * cumple sus invariantes por sí sola, sin que ningún frontend colabore.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

function parseEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '')
  }
  return out
}

const root = parseEnv(`${ROOT}/.env`)
const web = parseEnv(`${ROOT}/apps/web/.env.local`)
const URL = web.NEXT_PUBLIC_SUPABASE_URL
const ANON = web.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = root.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Faltan variables de entorno')

const svc = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}
const asUser = (t) => ({
  apikey: ANON,
  Authorization: `Bearer ${t}`,
  'Content-Type': 'application/json',
})

let pass = 0
let fail = 0
const check = (ok, label, extra = '') => {
  if (ok) {
    pass++
    console.log(`  OK   ${label}`)
  } else {
    fail++
    console.log(`  FALLO ${label}${extra ? ' :: ' + extra : ''}`)
  }
}

async function rest(path, { headers = svc, method = 'GET', body, prefer } = {}) {
  const h = { ...headers }
  if (prefer) h.Prefer = prefer
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* respuesta no JSON */
  }
  return { status: res.status, json, text }
}

async function insert(table, row) {
  const r = await rest(table, {
    method: 'POST',
    body: row,
    prefer: 'return=representation',
  })
  if (r.status >= 300) throw new Error(`insert ${table}: ${r.status} ${r.text}`)
  return r.json[0]
}

async function rpc(fn, args, headers) {
  return rest(`rpc/${fn}`, { method: 'POST', body: args, headers })
}

const created = { users: [], events: [], circuits: [], riders: [] }

async function createUser(email) {
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({
      email,
      password: 'Prueba-Fase1-2026',
      email_confirm: true,
      user_metadata: { display_name: email.split('@')[0] },
    }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(`crear usuario: ${res.status} ${JSON.stringify(j)}`)
  created.users.push(j.id)
  return j
}

async function signIn(email) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Prueba-Fase1-2026' }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(`login: ${res.status} ${JSON.stringify(j)}`)
  return j.access_token
}

try {
  // ---------------------------------------------------------------------
  console.log('\n[1] Datos de referencia')
  const cats = (await rest('categories?select=code,name&order=sort_order')).json
  check(cats?.length === 4, `4 categorías (hay ${cats?.length})`)
  check(
    cats?.[0]?.code === 'MOTOGP',
    `la primera es MotoGP (es ${cats?.[0]?.code})`,
  )

  const seasons = (await rest('seasons?select=id,year,is_active')).json
  const season = seasons?.find((s) => s.is_active)
  check(season?.year === 2026, `temporada 2026 activa (es ${season?.year})`)

  const rules = (await rest('scoring_rules?select=*')).json
  check(
    rules?.length === 1 && rules[0].points_exact_position === 1,
    `1 punto por acierto (es ${rules?.[0]?.points_exact_position})`,
  )

  const motogp = cats.find((c) => c.code === 'MOTOGP')
  const catId = (await rest('categories?select=id&code=eq.MOTOGP')).json[0].id

  // ---------------------------------------------------------------------
  console.log('\n[2] Trigger de alta de usuario')
  const stamp = Date.now()
  const emailA = `fase1-a-${stamp}@motogporra-test.com`
  const emailB = `fase1-b-${stamp}@motogporra-test.com`
  const userA = await createUser(emailA)
  const userB = await createUser(emailB)

  const profA = (await rest(`profiles?select=*&id=eq.${userA.id}`)).json
  check(profA?.length === 1, 'el trigger creó el perfil')
  const roleA = (await rest(`user_roles?select=*&user_id=eq.${userA.id}`)).json
  check(roleA?.[0]?.role === 'player', `rol player (es ${roleA?.[0]?.role})`)
  const partA = (await rest(`season_participants?select=*&user_id=eq.${userA.id}`)).json
  check(partA?.length === 1, 'inscrito en la temporada activa')

  // ---------------------------------------------------------------------
  console.log('\n[3] Datos deportivos de prueba')
  const circuit = await insert('circuits', {
    motogp_circuit_id: `test-circuit-${stamp}`,
    name: 'Circuito de Prueba',
    country_code: 'ES',
  })
  created.circuits.push(circuit.id)

  const event = await insert('events', {
    season_id: season.id,
    circuit_id: circuit.id,
    motogp_event_id: `test-event-${stamp}`,
    name: 'GP de Prueba',
    round: 99,
    country_code: 'ES',
  })
  created.events.push(event.id)

  const future = new Date(Date.now() + 7 * 864e5).toISOString()
  const race = await insert('races', {
    season_id: season.id,
    event_id: event.id,
    category_id: catId,
    kind: 'race',
    scheduled_at: future,
    betting_closes_at: future,
  })

  const riders = []
  for (let i = 1; i <= 4; i++) {
    const r = await insert('riders', {
      motogp_rider_id: `test-rider-${stamp}-${i}`,
      full_name: `Piloto Prueba ${i}`,
      last_name: `Prueba${i}`,
    })
    riders.push(r)
    created.riders.push(r.id)
  }
  // Solo los 3 primeros se inscriben: el cuarto sirve para probar el rechazo.
  for (const r of riders.slice(0, 3)) {
    await insert('rider_season_entries', {
      season_id: season.id,
      category_id: catId,
      rider_id: r.id,
      is_active: true,
    })
  }

  const st = (await rest(`races_view?select=status&id=eq.${race.id}`)).json
  check(st?.[0]?.status === 'open', `races_view dice 'open' (dice '${st?.[0]?.status}')`)

  // ---------------------------------------------------------------------
  console.log('\n[4] place_bet: validaciones')
  const tokA = await signIn(emailA)
  const tokB = await signIn(emailB)
  const [r1, r2, r3, r4] = riders.map((r) => r.id)

  let res = await rpc('place_bet', { p_race_id: race.id, p_rider_ids: [r1, r2, r3] }, asUser(tokA))
  check(res.status === 200, `apuesta válida aceptada (HTTP ${res.status})`, res.text)

  res = await rpc('place_bet', { p_race_id: race.id, p_rider_ids: [r1, r1, r2] }, asUser(tokA))
  check(res.text.includes('DUPLICATE_RIDER'), 'rechaza pilotos repetidos', res.text)

  res = await rpc('place_bet', { p_race_id: race.id, p_rider_ids: [r1, r2] }, asUser(tokA))
  check(res.text.includes('INVALID_PICK_COUNT'), 'rechaza menos de 3 pilotos', res.text)

  res = await rpc('place_bet', { p_race_id: race.id, p_rider_ids: [r1, r2, r4] }, asUser(tokA))
  check(res.text.includes('RIDER_NOT_IN_SEASON'), 'rechaza piloto no inscrito', res.text)

  const betsA = (await rest(`bets?select=id&race_id=eq.${race.id}`, { headers: asUser(tokA) })).json
  check(betsA?.length === 1, `una sola apuesta por carrera (hay ${betsA?.length})`)

  // ---------------------------------------------------------------------
  console.log('\n[5] Visibilidad de apuestas ajenas (el corazón de la porra)')
  await rpc('place_bet', { p_race_id: race.id, p_rider_ids: [r3, r2, r1] }, asUser(tokB))

  let visto = (await rest(`bets?select=id,user_id&race_id=eq.${race.id}`, { headers: asUser(tokA) })).json
  check(
    visto?.length === 1 && visto[0].user_id === userA.id,
    `abierta: A solo ve la suya (ve ${visto?.length})`,
  )

  let picksVistos = (await rest('bet_picks?select=bet_id', { headers: asUser(tokA) })).json
  check(picksVistos?.length === 3, `abierta: A solo ve sus 3 picks (ve ${picksVistos?.length})`)

  // Cerramos la carrera moviendo el cierre al pasado.
  await rest(`races?id=eq.${race.id}`, {
    method: 'PATCH',
    body: { betting_closes_at: new Date(Date.now() - 3600e3).toISOString() },
  })

  visto = (await rest(`bets?select=id,user_id&race_id=eq.${race.id}`, { headers: asUser(tokA) })).json
  check(visto?.length === 2, `cerrada: A ve las 2 apuestas (ve ${visto?.length})`)

  res = await rpc('place_bet', { p_race_id: race.id, p_rider_ids: [r1, r2, r3] }, asUser(tokA))
  check(res.text.includes('BETTING_CLOSED'), 'cerrada: rechaza nuevas apuestas', res.text)

  const del = await rest(`bet_picks?bet_id=eq.${betsA[0].id}`, {
    method: 'DELETE',
    headers: asUser(tokA),
  })
  const quedan = (await rest(`bet_picks?select=bet_id&bet_id=eq.${betsA[0].id}`)).json
  check(quedan?.length === 3, `cerrada: no se pueden borrar los picks (quedan ${quedan?.length})`)

  // ---------------------------------------------------------------------
  console.log('\n[6] Resultado oficial y recálculo de puntos')
  const result = await insert('race_results', { race_id: race.id, status: 'official' })
  // Podio real: r1, r2, r3.  A acertó los 3; B acertó solo el 2º.
  for (let i = 0; i < 3; i++) {
    await insert('race_result_entries', {
      race_result_id: result.id,
      rider_id: riders[i].id,
      position: i + 1,
      is_classified: true,
      status_raw: 'INSTND',
    })
  }

  const rec = await rpc('recalculate_race_scores', { p_race_id: race.id })
  check(rec.status === 200, `recalculate ejecutado (HTTP ${rec.status})`, rec.text)

  const scores = (await rest(`race_scores?select=user_id,points,exact_hits&race_id=eq.${race.id}`)).json
  const sA = scores?.find((s) => s.user_id === userA.id)
  const sB = scores?.find((s) => s.user_id === userB.id)
  check(sA?.points === 3, `A acertó el podio entero: 3 puntos (tiene ${sA?.points})`)
  check(sB?.points === 1, `B solo acertó el 2º: 1 punto (tiene ${sB?.points})`)

  const stand = (await rest(`season_standings?select=*&season_id=eq.${season.id}&order=position`, { headers: asUser(tokA) })).json
  check(stand?.[0]?.total_points === 3, `clasificación: líder con 3 puntos (${stand?.[0]?.total_points})`)
  check(stand?.[0]?.position === 1 && stand?.[1]?.position === 2, 'posiciones 1 y 2 correctas')

  const stFin = (await rest(`races_view?select=status&id=eq.${race.id}`)).json
  check(stFin?.[0]?.status === 'finished', `races_view dice 'finished' (dice '${stFin?.[0]?.status}')`)

  // Idempotencia: recalcular otra vez no debe cambiar nada.
  await rpc('recalculate_race_scores', { p_race_id: race.id })
  const scores2 = (await rest(`race_scores?select=user_id,points&race_id=eq.${race.id}`)).json
  check(
    scores2?.length === 2 && scores2.find((s) => s.user_id === userA.id).points === 3,
    'recalcular es idempotente',
  )
} catch (err) {
  fail++
  console.log(`\n  EXCEPCIÓN: ${err.message}`)
} finally {
  // -----------------------------------------------------------------------
  console.log('\n[7] Limpieza')
  for (const id of created.events) await rest(`events?id=eq.${id}`, { method: 'DELETE' })
  for (const id of created.circuits) await rest(`circuits?id=eq.${id}`, { method: 'DELETE' })
  for (const id of created.riders) await rest(`riders?id=eq.${id}`, { method: 'DELETE' })
  for (const id of created.users) {
    await fetch(`${URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: svc })
  }
  const restos = (await rest('races?select=id')).json
  const usuarios = (await rest('profiles?select=id')).json
  console.log(`  carreras restantes: ${restos?.length ?? '?'} · perfiles restantes: ${usuarios?.length ?? '?'}`)

  console.log(`\n===== ${pass} correctas, ${fail} fallidas =====`)
  process.exit(fail === 0 ? 0 : 1)
}
