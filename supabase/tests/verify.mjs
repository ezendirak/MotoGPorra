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
    rules?.length === 1 && rules[0].points_by_pattern?.['111'] === 15,
    `acertar el podio entero vale 15 (vale ${rules?.[0]?.points_by_pattern?.['111']})`,
  )

  const motogp = cats.find((c) => c.code === 'MOTOGP')
  const catId = (await rest('categories?select=id&code=eq.MOTOGP')).json[0].id

  // Las imágenes de piloto viven en Storage, no en la base. El bucket TIENE
  // que ser público: si dejara de serlo, la app seguiría guardando URLs que
  // devuelven 400 y los avatares desaparecerían sin un solo error en el log.
  const bucket = await fetch(`${URL}/storage/v1/bucket/rider-images`, { headers: svc })
  const bucketJson = bucket.ok ? await bucket.json() : null
  check(bucketJson?.public === true, 'el bucket rider-images existe y es público')

  // Una imagen cualquiera tiene que servirse sin credenciales: es como la pide
  // el navegador de un participante.
  const conFoto = (await rest('riders?select=headshot_url&headshot_url=not.is.null&limit=1'))
    .json
  if (conFoto?.length) {
    const foto = await fetch(conFoto[0].headshot_url)
    check(
      foto.ok && foto.headers.get('content-type')?.includes('image/webp'),
      `un avatar se descarga anónimo y es WebP (${foto.status})`,
    )
  } else {
    check(true, 'sin avatares subidos todavía: nada que comprobar')
  }

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

  // Acotado a las apuestas de ESTA carrera: la base tiene apuestas reales de
  // carreras ya cerradas que A puede ver legítimamente, y contarlas todas
  // haría que la prueba dependiera de cuánta gente esté jugando.
  const betsDeLaCarrera = (await rest(`bets?select=id&race_id=eq.${race.id}`)).json
  const idsBets = betsDeLaCarrera.map((b) => b.id).join(',')
  let picksVistos = (await rest(`bet_picks?select=bet_id&bet_id=in.(${idsBets})`, { headers: asUser(tokA) })).json
  check(picksVistos?.length === 3, `abierta: A solo ve sus 3 picks de esta carrera (ve ${picksVistos?.length})`)

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
  check(sA?.points === 15, `A acertó el podio entero: 15 puntos (tiene ${sA?.points})`)
  check(sB?.points === 2, `B solo acertó el 2º: patrón 010 = 2 puntos (tiene ${sB?.points})`)

  const stand = (await rest(`season_standings?select=*&season_id=eq.${season.id}&order=position`, { headers: asUser(tokA) })).json
  check(stand?.[0]?.total_points === 15, `clasificación: líder con 15 puntos (${stand?.[0]?.total_points})`)
  check(stand?.[0]?.position === 1 && stand?.[1]?.position === 2, 'posiciones 1 y 2 correctas')

  const stFin = (await rest(`races_view?select=status&id=eq.${race.id}`)).json
  check(stFin?.[0]?.status === 'finished', `races_view dice 'finished' (dice '${stFin?.[0]?.status}')`)

  // Idempotencia: recalcular otra vez no debe cambiar nada.
  await rpc('recalculate_race_scores', { p_race_id: race.id })
  const scores2 = (await rest(`race_scores?select=user_id,points&race_id=eq.${race.id}`)).json
  check(
    scores2?.length === 2 && scores2.find((s) => s.user_id === userA.id).points === 15,
    'recalcular es idempotente',
  )

  // ---------------------------------------------------------------------
  // Hasta aquí, una sola carrera. Lo que de verdad usa la porra es la
  // ACUMULACIÓN a lo largo de la temporada, y una clasificación mal sumada no
  // da ningún error: simplemente miente hasta que alguien discute su puesto.
  console.log('\n[7] Progresión de la clasificación')

  const emailC = `fase1-c-${stamp}@motogporra-test.com`
  const userC = await createUser(emailC)
  const tokC = await signIn(emailC)

  /** Crea un GP entero ya disputado, con apuestas y podio, y lo puntúa. */
  async function disputar({ sufijo, ronda, podio, apuestas }) {
    const evento = await insert('events', {
      season_id: season.id,
      circuit_id: circuit.id,
      motogp_event_id: `test-event-${sufijo}-${stamp}`,
      name: `GP de Prueba ${sufijo}`,
      round: ronda,
      country_code: 'ES',
    })
    created.events.push(evento.id)

    const pasado = new Date(Date.now() - 864e5).toISOString()
    const carrera = await insert('races', {
      season_id: season.id,
      event_id: evento.id,
      category_id: catId,
      kind: 'race',
      scheduled_at: pasado,
      // Las apuestas se escriben con service_role, que bypasa la RLS: la
      // ventana temporal ya se comprueba en [4] y [5] y aquí solo estorbaría.
      betting_closes_at: pasado,
    })

    for (const [userId, picks] of Object.entries(apuestas)) {
      const bet = await insert('bets', { race_id: carrera.id, user_id: userId })
      await rest('bet_picks', {
        method: 'POST',
        body: picks.map((riderId, i) => ({
          bet_id: bet.id,
          position: i + 1,
          rider_id: riderId,
        })),
        prefer: 'return=minimal',
      })
    }

    const res = await insert('race_results', { race_id: carrera.id, status: 'official' })
    for (let i = 0; i < podio.length; i++) {
      await insert('race_result_entries', {
        race_result_id: res.id,
        rider_id: podio[i],
        position: i + 1,
        is_classified: true,
        status_raw: 'INSTND',
      })
    }

    await rpc('recalculate_race_scores', { p_race_id: carrera.id })
    return carrera
  }

  const puntosDe = async (userId) => {
    const filas = (await rest(`season_standings?select=total_points,position,races_played&season_id=eq.${season.id}&user_id=eq.${userId}`, { headers: asUser(tokC) })).json
    return filas?.[0] ?? { total_points: 0, position: null, races_played: 0 }
  }

  // Tras [6]: A acertó el podio entero (15) y B solo el 2º (2).
  //
  // GP2 — A acierta 1º y 2º pero falla el 3º. Es la comprobación que de verdad
  // importa de la tabla nueva: el patrón 110 vale 10, y NO los 7 que saldrían
  // de sumar los valores sueltos de cada posición (5 + 2). Si alguien
  // reimplementara la puntuación como una suma, esto es lo que lo delataría.
  const gp2 = await disputar({
    sufijo: '2',
    ronda: 98,
    podio: [r1, r2, r3],
    apuestas: {
      [userA.id]: [r1, r2, r4],   // 110 -> 10
      [userC.id]: [r3, r2, r1],   // 010 -> 2
    },
  })

  const scoresGp2 = (await rest(`race_scores?select=user_id,points,exact_hits&race_id=eq.${gp2.id}`)).json
  const aGp2 = scoresGp2?.find((s) => s.user_id === userA.id)
  check(aGp2?.points === 10, `patrón 110 vale 10 y no 7: la tabla no es aditiva (da ${aGp2?.points})`)
  check(aGp2?.exact_hits === 2, `exact_hits sigue contando aciertos, no puntos (${aGp2?.exact_hits})`)

  const cGp2 = scoresGp2?.find((s) => s.user_id === userC.id)
  check(cGp2?.points === 2, `patrón 010 vale 2 (da ${cGp2?.points})`)

  const trasGp2A = await puntosDe(userA.id)
  check(trasGp2A.total_points === 25, `A acumula entre GP: 15 + 10 = 25 (tiene ${trasGp2A.total_points})`)
  check(trasGp2A.races_played === 2, `A ha puntuado en 2 carreras (${trasGp2A.races_played})`)

  // B y C empatan a 2: deben COMPARTIR el 2º puesto y el siguiente saltar
  // al 4º (decisión 4). Es `rank()`, no `dense_rank()`.
  const conEmpate = (await rest(`season_standings?select=user_id,total_points,position&season_id=eq.${season.id}&order=position`, { headers: asUser(tokC) })).json
  const posB = conEmpate?.find((f) => f.user_id === userB.id)
  const posC = conEmpate?.find((f) => f.user_id === userC.id)
  check(
    posB?.total_points === 2 && posC?.total_points === 2,
    `B y C empatan a 2 puntos (B ${posB?.total_points}, C ${posC?.total_points})`,
  )
  check(
    posB?.position != null && posB.position === posC?.position,
    `los empatados COMPARTEN puesto (B: ${posB?.position}, C: ${posC?.position})`,
  )
  // El salto es lo que distingue `rank()` de `dense_rank()`: tras dos
  // empatados, el siguiente puesto ocupado no puede ser el inmediato.
  const siguiente = conEmpate?.find((f) => (f.position ?? 0) > (posB?.position ?? 0))
  check(
    !siguiente || siguiente.position >= (posB?.position ?? 0) + 2,
    `tras el empate el puesto salta (empate en ${posB?.position}, siguiente ${siguiente?.position ?? 'ninguno'})`,
  )

  // GP3 — C acierta el podio entero, deshace el empate y adelanta a B.
  await disputar({
    sufijo: '3',
    ronda: 97,
    podio: [r1, r2, r3],
    apuestas: { [userC.id]: [r1, r2, r3] },   // 111 -> 15
  })

  const finalA = await puntosDe(userA.id)
  const finalB = await puntosDe(userB.id)
  const finalC = await puntosDe(userC.id)

  check(finalC.total_points === 17, `C suma 2 + 15 = 17 (tiene ${finalC.total_points})`)
  check(
    finalA.position < finalC.position && finalC.position < finalB.position,
    `deshecho el empate, A por delante de C y C de B (A ${finalA.position}º, C ${finalC.position}º, B ${finalB.position}º)`,
  )

  // Sin sprint, un Gran Premio reparte como máximo 15 puntos (decisión 2,
  // revisada): una sola carrera apostable por GP.
  const maxPorGp = (await rest(`race_scores?select=points&order=points.desc&limit=1`)).json
  check((maxPorGp?.[0]?.points ?? 0) <= 15, `ninguna carrera da más de 15 puntos (máx ${maxPorGp?.[0]?.points})`)


} catch (err) {
  fail++
  console.log(`\n  EXCEPCIÓN: ${err.message}`)
} finally {
  // -----------------------------------------------------------------------
  console.log('\n[8] Limpieza')
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
