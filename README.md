# MotoGPorra

Porra anual de MotoGP: cada participante predice el podio (🥇🥈🥉) de cada sprint y cada carrera antes de que empiecen los entrenamientos oficiales. Al terminar la sesión, el resultado oficial se importa solo y las puntuaciones se recalculan sin intervención manual.

**1 punto por cada posición acertada.** Sprint y carrera puntúan igual, así que un Gran Premio reparte de 0 a 6 puntos.

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
| `apps/sync` | Servicio de sincronización en Python *(fase 7)* |
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
| `npm run check` | Formato + lint + tipos |
| `npm run format` | Aplica Prettier |

## Documentación

| Fichero | Qué contiene |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Reglas estables: stack, convenciones, comandos, seguridad y trampas conocidas de Next.js 16 y de la API de MotoGP |
| [docs/DESIGN.md](docs/DESIGN.md) | Diseño completo y diario del proyecto: estado por fases, decisiones y por qué, esquema de base de datos y flujos |

Conviene leer el diseño antes de tocar el esquema.

## Estado

Funciona de extremo a extremo en local: registro, apuestas, sincronización desde MotoGP y cálculo automático de puntuaciones. La temporada 2026 está importada (22 GP, 44 carreras apostables, 22 resultados oficiales).

Pendiente: PWA, despliegue en Vercel y panel de administración. Ver [estado detallado](docs/DESIGN.md#15-estado-actual-y-cómo-continuar).
