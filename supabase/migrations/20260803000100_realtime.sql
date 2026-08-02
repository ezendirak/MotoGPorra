-- ---------------------------------------------------------------------------
-- Realtime sobre las puntuaciones.
--
-- Solo `race_scores`. Es la única tabla que cambia sin que el usuario haga
-- nada: la escribe `recalculate_race_scores` al final de una sincronización, y
-- es justo el momento en que la clasificación abierta en el móvil de alguien se
-- queda mintiendo.
--
-- No se publican `bets` ni `bet_picks` a propósito. Aunque la RLS impide leer
-- la apuesta ajena antes del cierre, publicar una tabla emite un evento por
-- cada cambio, y el evento en sí ya revela que alguien acaba de apostar.
-- Nadie necesita esa información en tiempo real.
--
-- Tampoco `races`: su estado no se almacena, se deriva de `closes_at` (§4.6),
-- así que un cierre no produce ningún UPDATE que emitir. De eso se encarga la
-- cuenta atrás del cliente, que refresca al llegar a cero.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.race_scores;

-- Sin esto, los eventos de UPDATE y DELETE llegarían solo con la clave
-- primaria. No los usamos hoy —el cliente se limita a refrescar la página—
-- pero `full` es lo que permitirá más adelante que la RLS filtre los eventos
-- por su contenido en vez de emitirlos a todo el mundo.
alter table public.race_scores replica identity full;
