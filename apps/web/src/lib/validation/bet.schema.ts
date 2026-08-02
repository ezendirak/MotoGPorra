import { z } from 'zod'

/**
 * Validación de una apuesta en el cliente.
 *
 * Es un espejo de lo que valida `place_bet` en la base de datos, no un
 * sustituto: la función SQL vuelve a comprobarlo todo, incluida la ventana
 * temporal con el reloj del servidor. Esto solo sirve para dar un mensaje
 * inmediato sin ir al servidor.
 */
export const betSchema = z
  .object({
    raceId: z.uuid('Carrera no válida'),
    riderIds: z
      .array(z.uuid('Piloto no válido'))
      .length(3, 'Tienes que elegir tres pilotos'),
  })
  .refine((data) => new Set(data.riderIds).size === 3, {
    message: 'No puedes repetir piloto',
    path: ['riderIds'],
  })
