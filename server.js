import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

// En ES Modules no existe __dirname; se reconstruye a partir de import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_PORT = 3000;
const PORT = process.env.PORT ?? DEFAULT_PORT;

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

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
