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
- **Redirect URLs**: `https://<dominio>/**` — **con el comodín**.

> ⚠️ **El comodín no es opcional.** Cuando el `redirectTo` no casa con la lista,
> Supabase no da error: cae de vuelta al **Site URL**. Si este sigue apuntando a
> `localhost`, el enlace del correo lleva a localhost y parece un fallo de la app.
>
> Añadir solo `/auth/callback` **no basta**: la recuperación de contraseña envía
> `…/auth/callback?next=/reset-password` (`lib/auth/actions.ts:129`), con query
> string, y no casa con la ruta exacta. El resultado es el peor posible: el
> registro funciona y la recuperación va a localhost, así que parece un problema
> del código y no de la configuración. `**` cubre ambos y cualquier redirección
> futura.

## 4. SMTP — bloqueante antes de invitar a nadie

El SMTP integrado de Supabase **no vale**, y no por el volumen: además de
limitar a 2 correos/hora, *se niega a entregar a cualquier dirección que no sea
del equipo del proyecto* y responde `Email address not authorized`. Sin SMTP
propio, el único que puede registrarse eres tú.

Configurado con **Gmail y contraseña de aplicación**, que no exige dominio
propio (Resend y compañía sí lo exigen: no hay remitente compartido para enviar
a terceros).

1. Con verificación en 2 pasos activa, crear una contraseña de aplicación en
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
   Google la muestra en cuatro grupos: **se pega sin los espacios**.
2. *Authentication → Emails → SMTP Settings*:

   | Campo | Valor |
   |---|---|
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username / Sender email | la misma dirección de Gmail — Gmail reescribe el `From` a la cuenta autenticada, así que si no coinciden los envíos salen mal |
   | Password | la contraseña de aplicación |

3. Subir el tope en *Authentication → Rate Limits*: al activar SMTP propio queda
   en 30 correos/hora.

> Los primeros mensajes caen en Spam o Promociones hasta que alguien los marca.
> Conviene avisarlo al repartir el enlace.

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
