# Chatbot IA

> 🚧 **Estado: en desarrollo** — por ahora solo existe el esqueleto del backend, sin integración de IA.

Chatbot con IA compuesto por un backend en Node.js + Express que actúa como intermediario seguro hacia una API de IA (la clave nunca llega al navegador), y un frontend de chat estático servido desde `public/`.

## Requisitos

- Node.js 18 o superior
- npm

## Cómo levantar el proyecto

```bash
# 1. Instalar dependencias
npm install

# 2. Crear tu configuración local a partir de la plantilla
#    (en Windows: copy .env.example .env)
cp .env.example .env

# 3. Arrancar en modo desarrollo (reinicio automático con nodemon)
npm run dev
```

El servidor queda escuchando en `http://localhost:3000` (o en el puerto que definas en `.env`).

- Frontend estático: <http://localhost:3000>
- Endpoint de salud: <http://localhost:3000/api/salud>

Para ejecutar sin recarga automática (como en producción): `npm start`.

## Estructura

```
chatbot-ia/
├── public/          # Frontend estático (aquí vivirá el chat)
│   └── index.html
├── server.js        # Servidor Express
├── .env.example     # Plantilla de variables de entorno (sí se versiona)
└── .env             # Tu configuración real con secretos (NO se versiona)
```
