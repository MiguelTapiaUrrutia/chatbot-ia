import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { consultarIA, CODIGOS_ERROR_IA, ErrorProveedorIA } from './proveedor-ia.js';

// En ES Modules no existe __dirname; se reconstruye a partir de import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_PORT = 3000;
const PORT = process.env.PORT ?? DEFAULT_PORT;

// Límites de la API de chat: el backend valida SIEMPRE, aunque el frontend
// también lo haga, porque cualquiera puede llamar al endpoint sin pasar por él.
const MAX_MENSAJES = 20;
const MAX_CARACTERES_POR_MENSAJE = 2000;
const ROLES_VALIDOS = ['user', 'assistant'];

const MENSAJE_SYSTEM = {
  role: 'system',
  content:
    'Eres el chatbot del portafolio de Migue, un desarrollador web. ' +
    'Hablas en español chileno, con un tono amable y cercano. ' +
    'Respondes de forma concisa: pocas frases, sin enrollarte. ' +
    'Si te preguntan quién eres, te presentas como el asistente del portafolio de Migue. ' +
    'Conoces sus 8 proyectos, todos en JavaScript y construidos con Claude Code: ' +
    '1) un generador de utilidades CSS de estilo neo-brutalista, ' +
    '2) una landing de Fórmula 1 que consume la API histórica de Jolpica, ' +
    '3) una hamburguesería con carta dinámica, ' +
    '4) una app de seguimiento de hábitos, ' +
    '5) un buscador de Fórmula 1, ' +
    '6) un sistema de reservas con tests automatizados, ' +
    '7) un gestor de tareas con drag & drop, ' +
    'y 8) este mismo chatbot: full stack con Node y Express, desplegado en un VPS propio. ' +
    'Puedes describir cualquiera de ellos brevemente si te preguntan. ' +
    'Si te preguntan algo fuera del portafolio y la programación, respondes breve ' +
    'y rediriges la conversación con simpatía hacia los proyectos de Migue.',
};

// Traducción de códigos de dominio del proveedor a estados HTTP.
// 502 (Bad Gateway): nuestro servidor está bien, el de más arriba falló.
const HTTP_POR_CODIGO_IA = {
  [CODIGOS_ERROR_IA.RATE_LIMIT]: 429,
  [CODIGOS_ERROR_IA.KEY_INVALIDA]: 502,
  [CODIGOS_ERROR_IA.SERVICIO_CAIDO]: 502,
};

const MENSAJE_CLIENTE_POR_CODIGO_IA = {
  [CODIGOS_ERROR_IA.RATE_LIMIT]:
    'Demasiadas peticiones al servicio de IA, intenta de nuevo en unos segundos',
  [CODIGOS_ERROR_IA.KEY_INVALIDA]: 'El servicio de IA no está disponible en este momento',
  [CODIGOS_ERROR_IA.SERVICIO_CAIDO]: 'El servicio de IA no está disponible en este momento',
};

/**
 * Valida el historial recibido del cliente.
 * Devuelve un string describiendo el problema, o null si todo está bien.
 */
function validarMensajes(mensajes) {
  if (!Array.isArray(mensajes) || mensajes.length === 0) {
    return 'El campo "mensajes" debe ser un array con al menos un mensaje';
  }
  if (mensajes.length > MAX_MENSAJES) {
    return `Se permiten como máximo ${MAX_MENSAJES} mensajes por petición`;
  }
  for (const [indice, mensaje] of mensajes.entries()) {
    if (!ROLES_VALIDOS.includes(mensaje?.role)) {
      return `Mensaje ${indice}: "role" debe ser "user" o "assistant"`;
    }
    if (typeof mensaje.content !== 'string' || mensaje.content.trim() === '') {
      return `Mensaje ${indice}: "content" debe ser un string no vacío`;
    }
    if (mensaje.content.length > MAX_CARACTERES_POR_MENSAJE) {
      return `Mensaje ${indice}: "content" supera los ${MAX_CARACTERES_POR_MENSAJE} caracteres`;
    }
  }
  return null;
}

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Logging mínimo de /api/chat: fecha-hora, status y duración.
// Nunca se loguea el contenido de los mensajes ni la API key.
app.use('/api/chat', (req, res, next) => {
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const duracionMs = Number(process.hrtime.bigint() - inicio) / 1_000_000;
    console.log(
      `[${new Date().toISOString()}] POST /api/chat ${res.statusCode} ${duracionMs.toFixed(1)}ms`
    );
  });
  next();
});

app.post('/api/chat', async (req, res) => {
  const errorValidacion = validarMensajes(req.body?.mensajes);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  try {
    // El system va siempre primero y lo pone el servidor, nunca el cliente:
    // así nadie puede redefinir la personalidad del bot desde fuera.
    const texto = await consultarIA([MENSAJE_SYSTEM, ...req.body.mensajes]);
    return res.json({ respuesta: texto });
  } catch (error) {
    if (error instanceof ErrorProveedorIA) {
      // El detalle (sin la key, que nunca sale del proveedor) queda en el log
      // del servidor; al cliente solo le llega un mensaje genérico.
      console.error(`[/api/chat] ${error.codigo}: ${error.message}`);
      return res
        .status(HTTP_POR_CODIGO_IA[error.codigo])
        .json({ error: MENSAJE_CLIENTE_POR_CODIGO_IA[error.codigo] });
    }
    console.error('[/api/chat] Error inesperado:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/salud', (req, res) => {
  res.json({
    ok: true,
    mensaje: 'Servidor vivo',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
