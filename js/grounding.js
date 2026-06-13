// Capa de detección de grounding.
// Decide, a partir del texto del último mensaje del usuario, si la pregunta
// trata sobre el campeonato F1 EN CURSO y por tanto conviene inyectar datos
// reales de Jolpica antes de llamar a la IA.
//
// Es una heurística por palabras clave: barata, sin coste de API y sin latencia.
// Sus límites (ver al final del archivo) son la razón por la que el siguiente
// paso natural es function calling.

// Términos que indican que se pregunta por la clasificación / estado actual.
const TERMINOS_CAMPEONATO = [
  'campeonato',
  'lider',      // sin tilde: comparamos sobre texto normalizado
  'lidera',
  'liderando',
  'standings',
  'clasificacion',
  'puntos',
  'primero',
  'posiciones',
  'posicion',
  'va ganando',
  'quien gana',
];

// Términos que anclan la pregunta al dominio F1. Exigir uno de estos junto a un
// término de campeonato reduce falsos positivos (p. ej. "el líder del proyecto").
const TERMINOS_F1 = [
  'f1',
  'formula 1',
  'formula1',
  'formula uno',
  'piloto',
  'pilotos',
  'escuderia',
  'escuderias',
  'constructor',
  'constructores',
];

/**
 * Normaliza para comparar: minúsculas y sin tildes/diacríticos.
 * NFD descompone "á" en "a" + U+0301; el rango U+0300-U+036F borra esas marcas.
 * Así "Clasificación" y "clasificacion" coinciden.
 * @param {string} texto
 * @returns {string}
 */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * ¿La pregunta es sobre el campeonato F1 actual?
 * Requiere AL MENOS un término de campeonato Y al menos un ancla de dominio F1.
 * @param {string} mensaje  Texto del último mensaje del usuario.
 * @returns {boolean}
 */
export function necesitaGroundingF1(mensaje) {
  if (typeof mensaje !== 'string' || mensaje.trim() === '') {
    return false;
  }

  const texto = normalizar(mensaje);
  const mencionaCampeonato = TERMINOS_CAMPEONATO.some((termino) => texto.includes(termino));
  const mencionaF1 = TERMINOS_F1.some((termino) => texto.includes(termino));

  return mencionaCampeonato && mencionaF1;
}
