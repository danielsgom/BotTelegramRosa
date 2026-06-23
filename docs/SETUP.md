# Guía de Instalación - BotTelegramRosa

## Requisitos Previos

- **Python 3.9+**
- **pip** (gestor de paquetes Python)
- **Git** (para clonar el repositorio)
- **Acceso a Telegram Bot API** (token de @BotFather)
- **Cuenta Stripe** (para procesar pagos)

## Instalación Paso a Paso

### 1. Clonar o Descargar el Proyecto

```bash
# Usando Git
git clone <url-del-repositorio> BotTelegramRosa
cd BotTelegramRosa

# O descargar como ZIP y extraer
unzip BotTelegramRosa.zip
cd BotTelegramRosa
```

### 2. Crear Entorno Virtual

```bash
# En macOS/Linux
python3 -m venv venv
source venv/bin/activate

# En Windows
python -m venv venv
venv\Scripts\activate
```

### 3. Instalar Dependencias

```bash
pip install -r requirements.txt
```

### 4. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar con tus valores
nano .env  # En Windows: notepad .env
```

### 5. Obtener Credenciales Necesarias

#### Token de Telegram Bot

1. Abre Telegram y busca **@BotFather**
2. Envía `/newbot`
3. Sigue las instrucciones
4. Copia el token generado
5. Pega en `.env` → `TELEGRAM_BOT_TOKEN`

#### Claves de Stripe

1. Ve a https://dashboard.stripe.com/apikeys
2. Copia la **Secret Key** (comienza con `sk_`)
3. Pega en `.env` → `STRIPE_API_KEY`
4. Ve a Webhooks y crea un nuevo webhook
5. Configura la URL: `https://tudominio.com/webhook/stripe`
6. Copia el **Signing Secret**
7. Pega en `.env` → `STRIPE_WEBHOOK_SECRET`

#### Link del Canal VIP

1. Crea un canal privado en Telegram
2. Haz click en el nombre del canal → Editar
3. Copia el link de invitación
4. Pega en `.env` → `VIP_CHANNEL_INVITE_LINK`

### 6. Inicializar Base de Datos

La base de datos se crea automáticamente al iniciar la aplicación.

### 7. Ejecutar la Aplicación

```bash
# Asegúrate que el entorno virtual esté activado
cd src/backend

# Ejecutar el servidor
python app.py
```

El servidor estará disponible en: **http://localhost:8000**

### 8. Acceder al Panel de Control

1. Abre tu navegador
2. Ve a: http://localhost:8000
3. En la sección "Configuración" (Settings)
4. Ingresa tu **Token API** (del archivo `.env` → `ADMIN_TOKEN`)
5. ¡Listo! Ya puedes empezar a crear mensajes

## Configuración Inicial

### 1. Crear tu Primer Mensaje

1. Ve a la pestaña **"Mensajes"**
2. Click en **"Nuevo Mensaje"**
3. Completa:
   - **Título**: Nombre del mensaje
   - **Texto**: Contenido (puedes usar emojis)
   - **Imagen**: Sube una imagen (opcional)
   - **Links de Pago**: Añade links de Stripe
   - **Intervalo**: Cada cuántas horas enviar
   - Click en **"Guardar Mensaje"**

### 2. Agregar Link de Pago Stripe

En Stripe:
1. Ve a **Products** (Productos)
2. Crea un producto nuevo
3. Ve a **Pricing** (Precios)
4. Crea un precio
5. Ve a **Payment Links**
6. Crea un nuevo payment link
7. Copia la URL del link
8. Úsalo en el panel

### 3. Verificar Usuarios Conectados

En la pestaña **"Usuarios"**:
- Verás todos los usuarios que se han iniciado con el bot
- Puedes ver su idioma detectado
- Ver si es VIP
- Desactivar usuarios si es necesario

### 4. Monitorear Scheduling

En la pestaña **"Scheduling"**:
- Verás todos los mensajes programados
- La próxima fecha/hora de envío
- Puedes pausar o reanudar mensajes

## Despliegue en Producción

### Usando Heroku (Gratuito)

```bash
# 1. Instalar Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# 2. Login
heroku login

# 3. Crear aplicación
heroku create tu-app-name

# 4. Agregar variables de entorno
heroku config:set TELEGRAM_BOT_TOKEN=tu_token
heroku config:set STRIPE_API_KEY=tu_clave
# ... agregar todas las variables

# 5. Hacer deploy
git push heroku main
```

### Usando Docker

```bash
# Construir imagen
docker build -t bot-telegram-rosa .

# Ejecutar contenedor
docker run -p 8000:8000 --env-file .env bot-telegram-rosa

# O con Docker Compose
docker-compose up
```

### Usando VPS (DigitalOcean, AWS, etc.)

```bash
# 1. SSH a tu servidor
ssh root@tu_servidor

# 2. Instalar dependencias del sistema
apt-get update
apt-get install python3 python3-pip python3-venv git

# 3. Clonar repositorio
git clone <url> /opt/bot-telegram-rosa
cd /opt/bot-telegram-rosa

# 4. Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# 5. Instalar dependencias
pip install -r requirements.txt

# 6. Configurar variables de entorno
nano .env

# 7. Ejecutar con Systemd (para que se inicie automáticamente)
sudo nano /etc/systemd/system/bot-telegram.service
```

Contenido de `bot-telegram.service`:
```ini
[Unit]
Description=BotTelegramRosa
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/bot-telegram-rosa
ExecStart=/opt/bot-telegram-rosa/venv/bin/python src/backend/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Habilitar servicio
sudo systemctl enable bot-telegram
sudo systemctl start bot-telegram
```

## Solución de Problemas

### El bot no responde

- Verifica que `TELEGRAM_BOT_TOKEN` esté correctamente configurado
- Verifica que el servidor esté ejecutándose: `python app.py`
- Revisa los logs para errores

### No se envían mensajes

- Verifica que al menos un usuario haya iniciado con `/start`
- Revisa la pestaña "Scheduling" para confirmar que está programado
- Verifica los logs del servidor

### Error de API Token inválido

- Copia exactamente el valor de `ADMIN_TOKEN` del archivo `.env`
- Pégalo en la sección "Configuración" del panel web

### Base de datos bloqueada (SQLite)

```bash
# Eliminar archivo de base de datos y recrear
rm bot.db
python app.py  # Se recreará automáticamente
```

### Error con webhooks de Stripe

- Verifica que tu servidor sea accesible desde internet (usa HTTPS)
- Configura correctamente la URL del webhook en Stripe
- Verifica el `STRIPE_WEBHOOK_SECRET`

## Comandos Útiles

```bash
# Ver logs en tiempo real
tail -f bot.log

# Detener el servidor
Ctrl + C

# Activar entorno virtual (si está desactivado)
source venv/bin/activate

# Ver versión de Python
python --version

# Ver paquetes instalados
pip list
```

## Documentación Adicional

- [Arquitectura Técnica](ARCHITECTURE.md)
- [Endpoints de API](API.md)
- [FAQ y Troubleshooting](TROUBLESHOOTING.md)

## Soporte

Si encuentras problemas:

1. Revisa los logs
2. Consulta la documentación
3. Abre un Issue en GitHub
4. Contacta al equipo de soporte

---

**¡Felicidades! Ahora tienes BotTelegramRosa listo para usar. 🚀**
