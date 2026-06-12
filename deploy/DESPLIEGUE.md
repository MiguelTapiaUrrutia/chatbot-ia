# Runbook de despliegue — chat.notbot.pro

Guía paso a paso para desplegar el chatbot en un VPS desde cero, tal como se hizo en producción. Al final hay una batería de verificación y el procedimiento de actualización.

## 1. Requisitos del VPS

- **Ubuntu** (LTS) con acceso root o usuario con `sudo`.
- **Acceso por llave SSH** (no contraseña): la llave pública en `~/.ssh/authorized_keys`.
- **Firewall** con solo estos puertos abiertos:

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Caddy lo usa para el reto ACME y la redirección)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

El puerto 3000 (Node) **no** se abre al exterior: solo Caddy le habla por localhost.

- **DNS**: un registro A de `chat.notbot.pro` apuntando a la IP del VPS.

## 2. Instalar Node.js (vía NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # comprobar
```

## 3. Clonar el proyecto en /opt

```bash
cd /opt
sudo git clone https://github.com/<tu-usuario>/chatbot-ia.git
cd /opt/chatbot-ia
npm install
```

## 4. Configurar variables de entorno

```bash
cp .env.example .env
nano .env        # poner la API key real de Groq en API_KEY
```

El `.env` nunca se versiona; la clave solo existe en el servidor.

## 5. PM2 (mantener el proceso vivo y arrancar con el sistema)

```bash
sudo npm install -g pm2
cd /opt/chatbot-ia
pm2 start server.js --name chatbot
pm2 startup      # ejecutar el comando que imprime (registra el servicio systemd)
pm2 save         # guarda la lista de procesos para el arranque
```

## 6. Caddy (reverse proxy + HTTPS automático)

Instalar desde el repositorio oficial:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Editar `/etc/caddy/Caddyfile` y dejar solo las 3 líneas (ver [Caddyfile.example](Caddyfile.example)):

```
chat.notbot.pro {
	reverse_proxy localhost:3000
}
```

Recargar:

```bash
sudo systemctl reload caddy
```

Caddy obtiene y renueva el certificado de Let's Encrypt automáticamente.

## 7. Batería de verificación

| # | Comprobación | Comando / acción | Resultado esperado |
|---|--------------|------------------|--------------------|
| 1 | Proceso vivo | `pm2 status` | `chatbot` en estado `online` |
| 2 | Salud interna | `curl http://localhost:3000/api/salud` | Respuesta JSON de salud |
| 3 | HTTPS | Abrir `https://chat.notbot.pro` en el navegador | Carga el chat con el candado 🔒 |
| 4 | Redirección | `curl -I http://chat.notbot.pro` | `308` con `Location: https://...` |
| 5 | Puertos | `Test-NetConnection chat.notbot.pro -Port 443` y `-Port 3000` (desde tu PC) | 443 → `TcpTestSucceeded: True`, 3000 → `False` |

La prueba 5 confirma que Node no está expuesto a internet: solo se llega a él a través de Caddy.

## 8. Actualizar la app en producción

```bash
cd /opt/chatbot-ia
git pull
npm install          # solo necesario si cambió package.json
pm2 restart chatbot
```

Verificar después con `pm2 status` y `curl http://localhost:3000/api/salud`.
