# MotoGPorra

Porra anual de MotoGP: cada participante predice el podio (🥇🥈🥉) de cada Gran Premio antes de que empiecen los entrenamientos oficiales. Al terminar la carrera, el resultado oficial se importa solo y las puntuaciones se recalculan sin intervención manual.

**Puntúa la combinación, no cada acierto por separado:**

| | | |
|---|---|---|
| 🥇🥈🥉 **15** | 🥇🥈· **10** | 🥇·🥉 **7** |
| 🥇·· **5** | ·🥈🥉 **3** | ·🥈· **2** |
| ··🥉 **1** | ··· **0** | |

La tabla **no es aditiva**: acertar 1º y 2º vale 10, no los 7 que saldrían de sumar sus valores sueltos. Un Gran Premio reparte de 0 a 15 puntos.

## Arquitectura

Cuatro piezas con una regla que las gobierna: **la aplicación web nunca habla con MotoGP**. Todo dato deportivo entra por el sincronizador y sale de Supabase.

```
Navegador (PWA) → Next.js en Vercel → Supabase (Auth · PostgreSQL · RLS)
                                            ↑
                                    Servicio de sincronización (Python)
                                            ↓
                                      motogp-client → API de MotoGP
```

| Carpeta | Contenido |
|---|---|
| `apps/web` | Aplicación Next.js (App Router) + PWA |
| `apps/sync` | Servicio de sincronización en Python |
| `packages/motogp_client` | Librería que encapsula la API de MotoGP |
| `supabase` | Migraciones, RLS y seed |
| `docs` | [Diseño completo del sistema](docs/DESIGN.md) |

## Stack

Next.js 16 · React 19 · TypeScript estricto · Tailwind CSS 4 · Supabase (Auth, PostgreSQL, RLS) · Vercel · PWA · Python 3.12+

## Puesta en marcha

Requisitos: Node 20.19+ (recomendado 24 LTS) y Python 3.12+.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # y rellenar los valores
npm run dev
```

| Comando | Efecto |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run check` | Formato + lint + tipos + tests |
| `npm test` | Lógica pura, con el runner de Node |
| `npm run db:verify` | 36 pruebas de esquema y RLS contra la base real |
| `npm run format` | Aplica Prettier |

## Documentación

| Fichero | Qué contiene |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Reglas estables: stack, convenciones, comandos, seguridad y trampas conocidas de Next.js 16 y de la API de MotoGP |
| [docs/DESIGN.md](docs/DESIGN.md) | Diseño completo y diario del proyecto: estado por fases, decisiones y por qué, esquema de base de datos y flujos |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Pasos manuales de Vercel y Supabase, con las trampas que ya nos costaron un rato |

Conviene leer el diseño antes de tocar el esquema.

## Estado

**En producción y en uso**: [motogporra.vercel.app](https://motogporra.vercel.app), instalable como app desde el móvil.

Funciona el ciclo completo — registro con correo propio, apuestas con cierre automático, importación de resultados desde MotoGP, puntuación y clasificación con refresco en vivo— más un panel de administración para roles, apertura excepcional de carreras y disparo manual del sincronizador. La temporada 2026 está importada: 22 GP, 177 sesiones, 30 pilotos y los resultados disputados hasta la fecha.

Pendiente: monitorización y tests de navegador. Ver el [estado por fases](docs/DESIGN.md#estado-actual).

Cómo desplegarlo desde cero: [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).
