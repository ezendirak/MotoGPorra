# Despliegue

> Fase 10. El código ya está listo; lo que queda aquí son los pasos que hay que
> dar a mano en Vercel y en Supabase, y en qué orden. El diario del proyecto
> está en [DESIGN.md](DESIGN.md).

---

## Por qué este orden

Los tres pasos se muerden la cola: Vercel no puede construir sin las variables,
`NEXT_PUBLIC_SITE_URL` no se conoce hasta que Vercel asigna dominio, y Supabase
no puede autorizar la redirección hasta que existe ese dominio. La forma de
romperlo es desplegar una vez con la URL provisional de Vercel, y corregirla al
final si se pone dominio propio.

---

## 1. Proyecto en Vercel

| Ajuste | Valor |
|---|---|
| Repositorio | `ezendirak/MotoGPorra` |
| **Root Directory** | **`apps/web`** |
| Framework | Next.js (se detecta solo) |
| Node.js Version | 24.x |

`apps/web` no es un proyecto independiente: es un *workspace* de npm y sus
dependencias están izadas en la raíz del repositorio. Al fijar *Root Directory*,
Vercel detecta el `workspaces` del `package.json` de la raíz e instala desde
ahí. Si el build fallara con módulos no encontrados, es que no lo ha detectado:
la opción a revisar es *Include files outside of the Root Directory*.

## 2. Variables de entorno

En *Settings → Environment Variables*. Los valores están en tu `.env` y
`apps/web/.env.local`; la referencia de qué es cada una está en
`apps/web/.env.example`.

| Variable | Entornos | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Pública por diseño: protege la RLS |
| `NEXT_PUBLIC_SITE_URL` | Production | La URL definitiva, **sin barra final** |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Aún no la usa nadie; hace falta en la fase 8 |

> ⚠️ **`NEXT_PUBLIC_SITE_URL` es la que se cuela.** Alimenta los
> `emailRedirectTo` del registro y del reseteo de contraseña
> (`lib/auth/actions.ts:106` y `:129`). Si queda apuntando a `localhost`, los
> correos de confirmación llegarán con un enlace que solo funciona en tu
> ordenador — y el registro parecerá roto sin dar ningún error.
>
> En *Preview* la URL cambia con cada rama, así que no hay valor correcto que
> fijar. Si algún día hace falta que el alta funcione en previews, se lee de
> `VERCEL_URL` en lugar de esta variable.

## 3. Supabase — autorizar la redirección

En *Authentication → URL Configuration*:

- **Site URL**: la misma que `NEXT_PUBLIC_SITE_URL`.
- **Redirect URLs**: añadir `https://<dominio>/auth/callback`.

Sin esto, Supabase rechaza la redirección y el usuario acaba en una página de
error tras pinchar el enlace del correo, aunque la cuenta se haya creado bien.

## 4. SMTP — bloqueante antes de invitar a nadie

El SMTP integrado de Supabase manda **2-3 correos por hora** y está pensado solo
para desarrollo. Con más de dos personas dándose de alta el mismo día, los
registros empiezan a fallar **en silencio**: la cuenta se crea, el correo no
sale, y el participante se queda esperando una confirmación que no llega.

Hay que configurar un SMTP propio en *Authentication → Emails → SMTP Settings*
antes de repartir el enlace. Resend tiene plan gratuito suficiente para esto.

---

## Comprobación después del primer despliegue

```bash
DOM=https://tu-dominio

# La PWA se sirve entera y sin sesión
curl -s -o /dev/null -w "manifest %{http_code}\n" $DOM/manifest.webmanifest
curl -s -o /dev/null -w "sw       %{http_code}\n" $DOM/sw.js
curl -s -o /dev/null -w "offline  %{http_code}\n" $DOM/offline
curl -s -o /dev/null -w "robots   %{http_code}\n" $DOM/robots.txt

# Las rutas privadas siguen protegidas
curl -s -o /dev/null -w "home %{http_code} -> %{redirect_url}\n" $DOM/

# El worker no se cachea y lleva sus cabeceras
curl -s -D - -o /dev/null $DOM/sw.js | grep -i "cache-control\|content-security"
```

Y a mano, que es lo que no se puede automatizar:

- [ ] Registrarse con un correo real y confirmar que el enlace lleva al dominio.
- [ ] Instalar la app en Android (aparece la invitación) y en iPhone
      (Compartir → Añadir a pantalla de inicio).
- [ ] Abrirla desde la pantalla de inicio: debe salir a pantalla completa, sin
      barra de direcciones, y **sin volver a pedir la invitación de instalar**.
- [ ] Comprobar el icono en la pantalla de inicio de Android, que aplica su
      máscara sobre la variante `maskable`.
- [ ] Poner el móvil en modo avión y navegar: debe salir «Bandera roja», no el
      error del navegador.
- [ ] Apostar en una carrera abierta y verificar que se guarda.

---

## Lo que queda fuera de esta fase

- **Backups.** Supabase hace copia diaria en el plan gratuito, con 7 días de
  retención. Para una porra anual conviene revisar si eso basta antes de que
  empiece la temporada.
- **Monitorización y Sentry.** Hoy el único rastro de un fallo en producción es
  el `digest` que muestra `error.tsx` y los logs de Vercel. Basta para depurar a
  petición, no para enterarse de que algo se ha roto.
- **Tests E2E del flujo crítico** (alta → apuesta → resultado → clasificación).
