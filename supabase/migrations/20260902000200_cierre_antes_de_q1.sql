-- ---------------------------------------------------------------------------
-- El cierre de apuestas pasa de «FP1 − 15 min» a «Q1 − 5 min».
--
-- La regla anterior obligaba a apostar a ciegas, sin haber visto rodar a nadie.
-- La nueva deja ver los entrenamientos y cierra justo antes de la calificación,
-- que es donde aparece la información que de verdad decide un podio: la
-- parrilla de salida. En la práctica el cierre se mueve del viernes por la
-- mañana al sábado, unos minutos antes de la Q1.
--
-- La base NO calcula este momento: lo escribe el sincronizador en
-- `betting_closes_at` (ver `mappers.betting_close_time`). Esta migración no
-- cambia por tanto ninguna lógica — solo pone al día el comentario del
-- esquema, que seguiría afirmando algo falso. Un comentario mentiroso sobre
-- cuándo se cierran las apuestas es exactamente el tipo de dato que hace
-- perder una tarde dentro de un año.
--
-- Los valores ya escritos los reescribe el propio job `calendar` en su
-- siguiente pasada, incluidos los de las carreras ya disputadas: se comprobó
-- antes de aplicarlo que ninguna cambia de estado, porque tanto el cierre
-- viejo como el nuevo quedan en el pasado.
-- ---------------------------------------------------------------------------

comment on column public.races.betting_closes_at is
  'Cierre calculado por el sincronizador: Q1 menos 5 minutos. Si el fin de semana no tuviera Q1, cae en la primera sesión — cierra antes de lo previsto, nunca después.';

comment on column public.races.closes_at is
  'Momento efectivo de cierre. Es la fuente de verdad usada por RLS y por place_bet: el reloj del cliente nunca decide.';
