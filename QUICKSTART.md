# Quick Start - BotTelegramRosa

## ⚡ 5 Minutos para empezar

### 1. Obtén tus credenciales (3 min)

#### Token de Telegram
1. Abre Telegram → Busca **@BotFather**
2. Envía `/newbot`
3. Sigue las instrucciones
4. **Copia el token** que se genera

#### Claves de Stripe
1. Ve a https://dashboard.stripe.com/apikeys
2. **Copia la Secret Key** (comienza con `sk_`)
3. Ve a Webhooks → Add endpoint
4. **Copia el Signing Secret**

#### Link de Canal VIP
1. Crea un canal privado en Telegram
2. Haz click en el nombre → Editar
3. **Copia el link de invitación**

### 2. Configuración (1 min)

```bash
# Crear archivo de configuración
cp .env.example .env

# Editar con tus credenciales
# Reemplaza:
# - TELEGRAM_BOT_TOKEN = token que copiaste
# - STRIPE_API_KEY = secret key de Stripe
# - STRIPE_WEBHOOK_SECRET = signing secret
# - VIP_CHANNEL_INVITE_LINK = link del canal
# - ADMIN_TOKEN = clave que quieras (ej: admin123)

nano .env
```

### 3. Instalar (1 min)

```bash
# Entorno virtual
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Dependencias
pip install -r requirements.txt
```

### 4. Ejecutar (1 min)

```bash
cd src/backend
python app.py
```

✅ **Listo!** El servidor está en http://localhost:8000

### 5. Panel web (acceso instantáneo)

1. Abre http://localhost:8000 en navegador
2. Ve a "Configuración" (Settings)
3. Pega tu ADMIN_TOKEN
4. Click en "Guardar"

**¡Listo!** Ahora crea tu primer mensaje.

---

## 📝 Crear tu Primer Mensaje

1. **Panel Web** → Tab "Mensajes"
2. Click en **"Nuevo Mensaje"**
3. Rellena:
   - **Título:** "Oferta Especial"
   - **Texto:** "¡50% descuento hoy!"
   - **Imagen:** Sube una foto (opcional)
   - **Links de Pago:** Pega link de Stripe
   - **Intervalo:** 2 horas
   - **Activo:** Sí

4. Click **"Guardar Mensaje"**

✅ **Hecho!** El bot enviará este mensaje cada 2 horas a todos los usuarios que escriban `/start`

---

## 🔗 Obtener Link de Pago de Stripe

1. Ve a Stripe Dashboard
2. Products → New Product
3. Rellena detalles
4. Pricing → New Price
5. Payment Links → New Link
6. **Copia la URL**
7. Usa en el panel del bot

---

## 🧪 Pruebas

```bash
# Verificar que todo funciona
curl http://localhost:8000/health

# En Telegram:
# 1. Busca tu bot
# 2. Envía /start
# 3. Deberías recibir mensaje bienvenida

# Panel web:
# http://localhost:8000
```

---

## 📱 Flujo Completo

```
Usuario envía /start al bot
    ↓
Bot detecta idioma automáticamente
    ↓
Usuario recibe bienvenida en su idioma
    ↓
Cada 2 horas: Usuario recibe imagen + texto + botón de pago
    ↓
Usuario hace click en pago
    ↓
Completa pago en Stripe
    ↓
Bot envía automáticamente link del canal VIP
    ↓
Usuario entra al canal VIP
```

---

## 🛠️ Comandos Útiles

```bash
# Ver logs en tiempo real
tail -f src/backend/app.log

# Detener servidor
Ctrl + C

# Reiniciar servidor
Ctrl + C
python src/backend/app.py

# Activar entorno virtual (si se desactiva)
source venv/bin/activate

# Ver usuarios en BD
sqlite3 bot.db "SELECT * FROM users;"
```

---

## ⚠️ Problemas Comunes

### "Token inválido"
- Copia exactamente tu ADMIN_TOKEN del archivo `.env`
- Pégalo en Panel → Configuración

### "El bot no responde"
- Verifica que TELEGRAM_BOT_TOKEN es correcto
- Verifica que el servidor está ejecutándose
- Reinicia: Ctrl+C y python app.py

### "No envía mensajes"
- Verifica que el usuario ha enviado `/start`
- Verifica en Panel que el mensaje está "Activo"
- Revisa logs: `tail -f server.log`

### "Error en webhook de Stripe"
- Para dev: usa ngrok (`ngrok http 8000`)
- Copia URL de ngrok en Stripe webhooks
- Verifica STRIPE_WEBHOOK_SECRET

---

## 📚 Documentación Completa

- [Instalación Detallada](docs/SETUP.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [API REST](docs/API.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

---

## 🚀 Próximos Pasos

1. **Personaliza mensajes**
   - Añade emoji
   - Cambia horarios
   - Sube imágenes atractivas

2. **Configura Stripe**
   - Productos reales
   - Precios correctos
   - Webhook configurado

3. **Monitorea**
   - Panel web → Usuarios
   - Panel web → Scheduling
   - Revisa pagos completados

4. **Despliega**
   - Heroku (gratuito)
   - Docker
   - VPS

---

## 💬 ¿Necesitas ayuda?

- Revisa [Troubleshooting](docs/TROUBLESHOOTING.md)
- Lee los logs: `tail -f server.log`
- Abre un Issue en GitHub

---

**¡Felicidades! Ya tienes BotTelegramRosa listo. 🎉**

Próximo: Crea tu primer mensaje y prueba todo funcionando.
