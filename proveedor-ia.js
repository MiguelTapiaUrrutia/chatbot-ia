// Capa de acceso al proveedor de IA (Groq).
// El resto de la app solo conoce consultarIA() y ErrorProveedorIA:
// nunca la URL, el modelo ni la API key. Si mañana cambiamos Groq por
// otro proveedor, este es el único archivo que se toca.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODELO = 'llama-3.3-70b-versatile';

// Códigos propios del dominio, independientes de HTTP. La capa de rutas
// decide qué estado HTTP corresponde a cada uno.
export const CODIGOS_ERROR_IA = {
  KEY_INVALIDA: 'KEY_INVALIDA',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVICIO_CAIDO: 'SERVICIO_CAIDO',
};

export class ErrorProveedorIA extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorProveedorIA';
    this.codigo = codigo;
  }
}

/**
 * Envía el historial de mensajes a Groq y devuelve SOLO el texto de la respuesta.
 * @param {Array<{ role: string, content: string }>} mensajes
 * @returns {Promise<string>}
 * @throws {ErrorProveedorIA}
 */
export async function consultarIA(mensajes) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new ErrorProveedorIA(
      CODIGOS_ERROR_IA.KEY_INVALIDA,
      'API_KEY no está configurada en el entorno (.env)',
    );
  }

  let respuesta;
  try {
    respuesta = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODELO, messages: mensajes }),
    });
  } catch {
    // fetch solo lanza por fallos de red (DNS, conexión rechazada, timeout):
    // si Groq responde, aunque sea con error, se sigue por la vía normal.
    throw new ErrorProveedorIA(
      CODIGOS_ERROR_IA.SERVICIO_CAIDO,
      'No se pudo conectar con el proveedor de IA',
    );
  }

  if (respuesta.status === 401) {
    throw new ErrorProveedorIA(
      CODIGOS_ERROR_IA.KEY_INVALIDA,
      'El proveedor de IA rechazó la API key (401): revisa el valor en .env',
    );
  }
  if (respuesta.status === 429) {
    throw new ErrorProveedorIA(
      CODIGOS_ERROR_IA.RATE_LIMIT,
      'El proveedor de IA aplicó límite de peticiones (429)',
    );
  }
  if (!respuesta.ok) {
    throw new ErrorProveedorIA(
      CODIGOS_ERROR_IA.SERVICIO_CAIDO,
      `El proveedor de IA respondió con estado ${respuesta.status}`,
    );
  }

  const datos = await respuesta.json();
  const texto = datos?.choices?.[0]?.message?.content;
  if (typeof texto !== 'string' || texto === '') {
    throw new ErrorProveedorIA(
      CODIGOS_ERROR_IA.SERVICIO_CAIDO,
      'El proveedor de IA devolvió una respuesta sin texto',
    );
  }

  return texto;
}
