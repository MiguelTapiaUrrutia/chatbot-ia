// Capa de datos de Fórmula 1 (API Jolpica, compatible con Ergast).
// Portada del concepto de F1 FanZone a Node con fetch nativo.
//
// El resto de la app solo conoce obtenerStandingsActuales() y
// obtenerStandingsConstructores(). Ambas devuelven datos ya limpios o null:
// nunca lanzan. La filosofía es la degradación elegante (ver más abajo).

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

const TOP_N = 10;

// Tiempo de vida del caché en memoria.
// Los standings solo cambian cuando termina una carrera (cada 1-2 semanas),
// así que reconsultar a cada mensaje sería desperdiciar peticiones a Jolpica.
// 10 minutos es un buen balance AQUÍ porque el dato es "casi estático" pero
// no inmutable: durante un fin de semana de carrera quieres que el resultado
// nuevo aparezca pronto, y 10 min garantiza que como mucho sirves un standing
// 10 min desactualizado. Contrasta con el índice de pilotos (caché de 30 días):
// la lista de pilotos de una temporada NO cambia una vez arrancada, es un dato
// de referencia estable, así que cachear un mes es seguro. Regla general:
// el TTL debe acercarse a la frecuencia real con la que el dato cambia.
const TTL_MS = 10 * 60 * 1000;

// Caché en memoria: clave -> { datos, expiraEn (timestamp ms) }.
// Vive en el proceso; al reiniciar el servidor se vacía, lo cual es aceptable
// porque la primera petición simplemente repuebla el caché.
const cache = new Map();

/**
 * Lee del caché si la entrada existe y no ha vencido.
 * @param {string} clave
 * @returns {unknown | null}
 */
function leerCache(clave) {
  const entrada = cache.get(clave);
  if (!entrada) {
    return null;
  }
  if (Date.now() > entrada.expiraEn) {
    cache.delete(clave);
    return null;
  }
  return entrada.datos;
}

/**
 * Guarda en el caché con vencimiento a TTL_MS desde ahora.
 * @param {string} clave
 * @param {unknown} datos
 */
function escribirCache(clave, datos) {
  cache.set(clave, { datos, expiraEn: Date.now() + TTL_MS });
}

/**
 * Pide un JSON a Jolpica. Devuelve el objeto parseado o null ante cualquier
 * fallo (red, status no-OK, JSON inválido). Nunca lanza: la capa de datos F1
 * es "best effort" y el chat debe seguir vivo aunque Jolpica esté caída.
 * @param {string} ruta  Ruta relativa, p. ej. '/current/driverStandings.json'
 * @returns {Promise<any | null>}
 */
async function pedirJolpica(ruta) {
  try {
    const respuesta = await fetch(`${JOLPICA_BASE}${ruta}`, {
      headers: { Accept: 'application/json' },
    });
    if (!respuesta.ok) {
      console.error(`[f1-datos] Jolpica respondió ${respuesta.status} en ${ruta}`);
      return null;
    }
    return await respuesta.json();
  } catch (error) {
    // Fallo de red o JSON inválido. Logueamos el motivo (sin datos sensibles)
    // y devolvemos null para que el llamador degrade con elegancia.
    console.error(`[f1-datos] Error consultando Jolpica (${ruta}):`, error.message);
    return null;
  }
}

/**
 * Standings de pilotos de la temporada actual: top 10 ya limpio.
 * @returns {Promise<Array<{ posicion: number, nombre: string, equipo: string, puntos: number }> | null>}
 */
export async function obtenerStandingsActuales() {
  const CLAVE = 'driverStandings';
  const cacheado = leerCache(CLAVE);
  if (cacheado) {
    return cacheado;
  }

  const json = await pedirJolpica('/current/driverStandings.json');
  if (!json) {
    return null;
  }

  // La estructura Ergast anida los standings en MRData.StandingsTable.
  const lista = json?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings;
  if (!Array.isArray(lista) || lista.length === 0) {
    console.error('[f1-datos] Respuesta de pilotos sin standings utilizables');
    return null;
  }

  const limpios = lista.slice(0, TOP_N).map((fila) => ({
    posicion: Number(fila.position),
    nombre: `${fila.Driver?.givenName ?? ''} ${fila.Driver?.familyName ?? ''}`.trim(),
    equipo: fila.Constructors?.[0]?.name ?? 'Sin equipo',
    puntos: Number(fila.points),
  }));

  escribirCache(CLAVE, limpios);
  return limpios;
}

/**
 * Standings de constructores de la temporada actual: top 10 ya limpio.
 * @returns {Promise<Array<{ posicion: number, equipo: string, puntos: number }> | null>}
 */
export async function obtenerStandingsConstructores() {
  const CLAVE = 'constructorStandings';
  const cacheado = leerCache(CLAVE);
  if (cacheado) {
    return cacheado;
  }

  const json = await pedirJolpica('/current/constructorStandings.json');
  if (!json) {
    return null;
  }

  const lista = json?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings;
  if (!Array.isArray(lista) || lista.length === 0) {
    console.error('[f1-datos] Respuesta de constructores sin standings utilizables');
    return null;
  }

  const limpios = lista.slice(0, TOP_N).map((fila) => ({
    posicion: Number(fila.position),
    equipo: fila.Constructor?.name ?? 'Sin equipo',
    puntos: Number(fila.points),
  }));

  escribirCache(CLAVE, limpios);
  return limpios;
}
