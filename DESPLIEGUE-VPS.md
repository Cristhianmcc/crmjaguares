# Llevar Jaguares CRM a tu VPS

Dos caminos. **Dokploy** es el recomendado si ya lo usas para
`api.jaguarescar.com`: te da dominio, HTTPS y base de datos sin pelear por los
puertos 80/443. El segundo es Docker Compose puro, para un VPS sin panel.

---

## Antes de empezar

| Necesitas | Por qué |
|---|---|
| Un subdominio, p. ej. `crm.jaguarescar.com` | `APP_BASE_URL` y el webhook de Zernio salen de ahí |
| Postgres 16 | El CRM guarda todo ahí (conversaciones, contactos, conocimiento) |
| Los secretos de `deploy/vps.env.example` | Sin ellos la app no arranca |
| Llave de DeepSeek y conexión de Zernio | Se configuran después, en la app |

Genera los secretos **en el VPS** (no reutilices los de tu máquina):

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY  (32 bytes en base64, exactos)
openssl rand -hex 32      # META_WEBHOOK_VERIFY_TOKEN
```

> La `ENCRYPTION_KEY` cifra las llaves de WhatsApp y de IA: si la cambias
> después, esas credenciales dejan de descifrarse y hay que volver a pegarlas.

---

## Ruta A — Dokploy (recomendado)

1. **Sube este código a un repositorio** (GitHub/Gitea). Es un fork: si apuntas
   Dokploy a la imagen publicada de Vocero, correrías el CRM sin tus cambios.
2. En Dokploy: **Create Application → Dockerfile**, repositorio y rama. Puerto
   interno **3000** (el Dockerfile ya define `PORT=3000`).
3. **Base de datos**: crea un servicio Postgres 16 en el mismo proyecto y copia
   su URL interna (`postgresql://postgres:CLAVE@<servicio>:5432/jaguares`).
4. **Variables de entorno**: pega las de `deploy/vps.env.example` con tus
   valores. `APP_BASE_URL` = `https://crm.jaguarescar.com`.
5. **Dominio**: agrega `crm.jaguarescar.com` a la aplicación, puerto 3000. El
   HTTPS lo resuelve Dokploy.
6. **Volumen**: monta uno en `/data` (adjuntos y logo). Sin él se pierden al
   recrear el contenedor.
7. **Deploy**. El contenedor aplica las migraciones solo al arrancar
   (`node migrate.mjs && node server.js`). Mira los logs: debe decir
   `migrations applied successfully`.
8. Abre `https://crm.jaguarescar.com` y **registra el primer usuario**: crea la
   organización y siembra el embudo. Después el registro público se cierra.

## Ruta B — Docker Compose

En el VPS, con el repo clonado:

```bash
cp deploy/vps.env.example .env      # completa los valores
docker compose up -d --build        # --build: la imagen es la tuya, no la oficial
docker compose logs -f app          # esperar el healthcheck
```

Ese `docker-compose.yml` levanta app + Postgres + Caddy con HTTPS automático.
Necesita los puertos **80 y 443 libres**: si Dokploy/Traefik ya los usa, ve por
la Ruta A.

---

## Después del despliegue

1. **Ajustes → IA**: DeepSeek, `deepseek-flash`, tu llave, *Probar conexión*.
2. **Ajustes → WhatsApp → por Zernio**: cuenta `6ad7bcd64ba79b10a343767e` y la
   llave de Zernio.
3. **Zernio → Webhooks**: cambia la URL del webhook a

   ```
   https://crm.jaguarescar.com/api/webhooks/wa/<META_WEBHOOK_VERIFY_TOKEN>
   ```

   La tarjeta de Ajustes → WhatsApp muestra la URL exacta del servidor.
4. **Ajustes → WhatsApp → webhook**: confirma que ya no avisa «URL local».
5. Escribe desde un celular al **+51 978 381 535**: debe aparecer en la bandeja
   y contestar el agente.

## ¿Y los datos que ya tienes en local?

Si quieres llevarte conversaciones y conocimiento (no solo el código):

```bash
# en tu máquina
docker exec jaguares-dev-postgres-1 pg_dump -U postgres -d jaguares \
  --no-owner > jaguares.sql

# en el VPS (con el archivo copiado)
docker exec -i <contenedor-postgres> psql -U postgres -d jaguares < jaguares.sql
```

Si prefieres empezar limpio, omite esto: al registrar el primer usuario tendrás
el embudo, y el conocimiento y la conexión se configuran en Ajustes.

## Seguridad mínima antes de abrirlo al público

- [ ] `BETTER_AUTH_SECRET` y `ENCRYPTION_KEY` **nuevos**, no los de desarrollo.
- [ ] Contraseña del primer usuario distinta a `Jaguares2026!`.
- [ ] Rotar la llave de Zernio que quedó en una captura.
- [ ] Postgres **sin** puerto publicado a internet: solo en la red interna.
- [ ] `ESCUELA_API_URL` apuntando a `https://api.jaguarescar.com`.
- [ ] Copia de seguridad del volumen de Postgres (Dokploy o `pg_dump` con cron).
