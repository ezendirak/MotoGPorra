-- ---------------------------------------------------------------------------
-- Imágenes de piloto: columnas y almacén.
--
-- La migración original de `riders` decía que «la API de /riders NO devuelve
-- foto». Es falso, y se ha comprobado contra la API real: cada piloto tiene un
-- recorte de estudio de cuerpo entero, y 19 de los 22 titulares tienen además
-- su dorsal dibujado con tipografía y colores propios — lo más parecido a un
-- logotipo personal que publica MotoGP.
--
-- Lo que sí es cierto es que esas imágenes NO se pueden enlazar directamente:
--
--   1. El recorte de estudio es un PNG de 1920x2883 y ~3,8 MB, y
--      photos.motogp.com ignora cualquier parámetro de redimensionado
--      (?width=, ?w=, ?tr=w-... devuelven siempre el original). Servir eso en
--      una lista de 22 pilotos en el móvil son 80 MB.
--   2. Enlazarlas rompería la regla que gobierna el proyecto: la aplicación
--      web nunca habla con MotoGP.
--
-- Por eso el sincronizador descarga, recorta, reescala a WebP y sube el
-- resultado a Storage; estas columnas guardan la URL del bucket, nunca la de
-- MotoGP. Ver `apps/sync/src/motogporra_sync/images.py`.
-- ---------------------------------------------------------------------------

-- El job que las trae es nuevo, y `sync_runs.job` es un enum cerrado: sin esto
-- la primera ejecución fallaría al registrarse a sí misma.
alter type public.sync_job add value if not exists 'images';

alter table public.riders
  add column if not exists headshot_url     text,
  add column if not exists number_image_url text;

comment on column public.riders.photo_url is
  'Recorte de estudio de cuerpo entero, WebP de 480px de ancho, servido desde el bucket `rider-images`. NULL mientras el job `images` no lo haya subido.';

comment on column public.riders.headshot_url is
  'Recorte cuadrado de cabeza y hombros, WebP de 256px, para avatares. Se calcula a partir de la foto de cuerpo entero.';

comment on column public.riders.number_image_url is
  'Dorsal del piloto con su tipografía y colores. NULL si MotoGP no lo publica para el número que lleva ESTA temporada.';

-- ---------------------------------------------------------------------------
-- Bucket público.
--
-- Público a propósito: son fotos promocionales que MotoGP sirve abiertas, y un
-- bucket privado obligaría a firmar cada URL, lo que rompería el cacheado del
-- navegador y del CDN sin proteger nada. La lectura anónima de un bucket
-- público va por /object/public/ y no necesita política sobre storage.objects;
-- la escritura la hace el sincronizador con `service_role`, que bypasa RLS.
--
-- El límite de tamaño y la lista de tipos son la red de seguridad: aunque el
-- job solo sube WebP ya reescalados (~35 KB el cuerpo entero, ~7 KB el
-- avatar), nada debería poder colar un original de 4 MB aquí.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rider-images', 'rider-images', true, 1048576, array['image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
