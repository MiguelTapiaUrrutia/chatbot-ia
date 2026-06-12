// Estado único de la aplicación: el hilo completo se deriva de aquí en cada
// render. Nada se pinta "a mano" fuera de render().
const historial = [];

// Coherente con MAX_CARACTERES_POR_MENSAJE del backend.
const MAX_CARACTERES = 2000;
// El backend rechaza más de 20 mensajes: se envía solo la cola reciente
// para que conversaciones largas no empiecen a devolver 400.
const MAX_MENSAJES_ENVIO = 20;

const ESTADOS = Object.freeze({
  INACTIVO: 'inactivo',
  CARGANDO: 'cargando',
  ERROR: 'error',
});

// Estado de UI del envío en curso. Es deliberadamente independiente del
// historial: un error es un estado transitorio de la interfaz, no un mensaje
// de la conversación.
let estadoEnvio = ESTADOS.INACTIVO;
let mensajeError = '';

const hilo = document.querySelector('#hilo');
const formulario = document.querySelector('#formulario');
const entrada = document.querySelector('#entrada');
const botonEnviar = document.querySelector('#boton-enviar');

function crearBurbuja(mensaje) {
  const item = document.createElement('li');
  item.classList.add('burbuja', `burbuja--${mensaje.role}`);

  const autor = document.createElement('span');
  autor.classList.add('burbuja__autor');
  autor.textContent = mensaje.role === 'user' ? 'Tú' : 'Asistente';

  const texto = document.createElement('p');
  texto.classList.add('burbuja__texto');
  // textContent SIEMPRE: la respuesta del modelo es contenido externo no
  // confiable y con innerHTML cualquier etiqueta que devuelva se ejecutaría.
  texto.textContent = mensaje.content;

  item.append(autor, texto);
  return item;
}

function crearIndicadorEscribiendo() {
  const item = document.createElement('li');
  item.classList.add('burbuja', 'burbuja--assistant', 'burbuja--escribiendo');

  const texto = document.createElement('p');
  texto.classList.add('burbuja__texto');
  texto.textContent = 'escribiendo';

  const puntos = document.createElement('span');
  puntos.classList.add('puntos');
  puntos.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i += 1) {
    const punto = document.createElement('span');
    punto.textContent = '.';
    puntos.append(punto);
  }

  texto.append(puntos);
  item.append(texto);
  return item;
}

function crearBurbujaError() {
  const item = document.createElement('li');
  item.classList.add('burbuja', 'burbuja--error');

  const icono = document.createElement('span');
  icono.classList.add('burbuja__icono');
  icono.setAttribute('aria-hidden', 'true');
  icono.textContent = '⚠';

  const texto = document.createElement('p');
  texto.classList.add('burbuja__texto');
  texto.textContent = mensajeError;

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.classList.add('burbuja__reintentar');
  boton.textContent = 'Reintentar';
  // Reintentar NO toca el historial: el mensaje del usuario ya quedó dentro
  // cuando se envió por primera vez, así que basta con repetir la petición.
  boton.addEventListener('click', enviarHistorial);

  item.append(icono, texto, boton);
  return item;
}

function render() {
  const elementos = historial.map(crearBurbuja);
  if (estadoEnvio === ESTADOS.CARGANDO) {
    elementos.push(crearIndicadorEscribiendo());
  }
  if (estadoEnvio === ESTADOS.ERROR) {
    elementos.push(crearBurbujaError());
  }
  hilo.replaceChildren(...elementos);

  botonEnviar.disabled = estadoEnvio === ESTADOS.CARGANDO;
  hilo.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function describirError(status, cuerpo) {
  if (status === 429) {
    return 'Demasiadas consultas, espera un momento.';
  }
  if (status === 502) {
    return 'El servicio de IA no responde.';
  }
  if (status === 400 && typeof cuerpo?.error === 'string') {
    return cuerpo.error;
  }
  return 'Algo salió mal. Intenta de nuevo.';
}

async function enviarHistorial() {
  estadoEnvio = ESTADOS.CARGANDO;
  mensajeError = '';
  render();

  try {
    const respuesta = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensajes: historial.slice(-MAX_MENSAJES_ENVIO) }),
    });
    const cuerpo = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      estadoEnvio = ESTADOS.ERROR;
      mensajeError = describirError(respuesta.status, cuerpo);
      render();
      return;
    }

    historial.push({ role: 'assistant', content: cuerpo.respuesta });
    estadoEnvio = ESTADOS.INACTIVO;
    render();
  } catch {
    estadoEnvio = ESTADOS.ERROR;
    mensajeError = 'No se pudo conectar con el servidor. Revisa tu conexión.';
    render();
  }
}

formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  if (estadoEnvio === ESTADOS.CARGANDO) {
    return;
  }

  const texto = entrada.value.trim();
  if (texto === '' || texto.length > MAX_CARACTERES) {
    return;
  }

  historial.push({ role: 'user', content: texto });
  entrada.value = '';
  entrada.focus();
  enviarHistorial();
});

// Enter envía; Shift+Enter conserva el salto de línea del textarea.
entrada.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter' && !evento.shiftKey) {
    evento.preventDefault();
    formulario.requestSubmit();
  }
});

entrada.focus();
