# 🧪 Setup y Testing - Mensajería Manual

## Verificación Pre-Inicio

Antes de ejecutar el servidor, verifica:

### 1. Dependencias Python
```bash
# Verifica que tengas todas las librerías
pip list | grep -E "fastapi|sqlalchemy|python-telegram-bot|pydantic"
```

Expected:
- `fastapi` >= 0.95.0
- `sqlalchemy` >= 2.0.0
- `python-telegram-bot` >= 20.0
- `pydantic` >= 2.0.0

### 2. Variables de Entorno (.env)
```bash
# Verifica que existan:
cat .env | grep -E "TELEGRAM_BOT_TOKEN|DATABASE_URL|ADMIN_TOKEN"
```

Required:
```
TELEGRAM_BOT_TOKEN=xxxxxxxxxxxxxxxxxxxx
DATABASE_URL=sqlite:///./bot.db
ADMIN_TOKEN=tu_token_secreto_aqui
```

## 🚀 Iniciar el Servidor

```bash
# Opción 1: Directamente
cd src/backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Opción 2: Con Docker
docker-compose up --build

# Opción 3: Con script
./start.sh
```

El servidor debe mostrar:
```
✅ Bot polling ACTIVE - listening for /start and messages...
Application started successfully
```

## 🧪 Test Suite Manual

### Test 1: Health Check
```bash
curl http://localhost:8000/health
```

Expected:
```json
{"status": "ok", "app": "BotTelegramRosa", "version": "1.0.0", "timestamp": "..."}
```

### Test 2: Get Users (Admin API)
```bash
curl -H "X-API-Token: tu_admin_token" \
  http://localhost:8000/api/admin/users
```

Expected:
```json
{
  "success": true,
  "total": 5,
  "users": [
    {
      "id": 1,
      "telegram_id": 123456789,
      "first_name": "Rosa",
      "username": "rosa_user",
      "is_vip": false,
      "last_message_at": "2026-06-25T10:30:00"
    },
    ...
  ]
}
```

### Test 3: Get Chat History
```bash
curl -H "X-API-Token: tu_admin_token" \
  http://localhost:8000/api/admin/users/1/chat/history
```

Expected:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "telegram_id": 123456789,
    "first_name": "Rosa",
    "is_vip": false
  },
  "messages": [
    {
      "id": 1,
      "content": "Hola, ¿cómo estás?",
      "type": "text",
      "sent_by": "user",
      "status": "delivered",
      "created_at": "2026-06-25T10:25:00"
    },
    ...
  ]
}
```

### Test 4: Send Manual Message
```bash
curl -X POST \
  -H "X-API-Token: tu_admin_token" \
  -F "content=Hola desde el admin" \
  -F "message_type=text" \
  http://localhost:8000/api/admin/users/1/chat/message
```

Expected:
```json
{
  "success": true,
  "message_id": 42,
  "status": "sent"
}
```

### Test 5: Create Predefined Asset
```bash
curl -X POST \
  -H "X-API-Token: tu_admin_token" \
  -F "name=Welcome_Audio" \
  -F "asset_type=audio" \
  -F "category=greetings" \
  -F "description=Audio de bienvenida" \
  -F "file=@/path/to/audio.mp3" \
  http://localhost:8000/api/admin/predefined-assets
```

Expected:
```json
{
  "success": true,
  "asset_id": 10,
  "name": "Welcome_Audio"
}
```

### Test 6: Get Predefined Assets
```bash
curl -H "X-API-Token: tu_admin_token" \
  "http://localhost:8000/api/admin/predefined-assets?asset_type=audio"
```

Expected:
```json
{
  "success": true,
  "assets": [
    {
      "id": 10,
      "name": "Welcome_Audio",
      "asset_type": "audio",
      "file_url": "/uploads/1234567890_audio.mp3",
      "category": "greetings",
      "description": "Audio de bienvenida"
    },
    ...
  ]
}
```

## 🖥️ Frontend UI Tests

### Test 1: Abrir Panel Admin
1. Abre http://localhost:8000
2. Te pedirá un token
3. Ingresa el token de .env (ADMIN_TOKEN)
4. Haz clic en "Acceder"

### Test 2: Navegar a Mensajes Manuales
1. En el navbar, haz clic en "Mensajes Manuales"
2. Debería cargar la lista de usuarios en 2-3 segundos
3. El panel debe verse así:
   ```
   [Panel izquierdo]        [Panel derecho]
   - Rosa                   Selecciona un usuario
   - Juan                   para ver el historial
   - María
   ```

### Test 3: Seleccionar Usuario
1. Haz clic en "Rosa" en la lista
2. Se debe cargar el historial de chat
3. Se deben habilitar los botones de envío
4. Se vea: nombre, telegram_id, mensajes previos

### Test 4: Enviar Mensaje de Texto
1. Selecciona un usuario
2. Escribe: "Hola, ¿cómo estás?"
3. Haz clic en "Enviar"
4. El mensaje debe aparecer en el chat con ✓
5. Rosa recibe en Telegram

### Test 5: Enviar Archivo Predefinido
1. Crea un asset predefinido (TEST: ver abajo)
2. Selecciona un usuario
3. Haz clic en [🎵 Audio] / [🖼️ Imagen] / [🎬 Video] / [🔗 Link]
4. Selecciona el asset
5. Se envía automáticamente

### Test 6: Crear Asset Predefinido
1. En el tab "Mensajes Manuales", con usuario seleccionado
2. Haz clic en [🎵 Audio]
3. En el modal, haz clic en "+ Nuevo"
4. Llena:
   - Nombre: "Test_Audio"
   - Categoría: "test"
   - Descripción: "Asset para testing"
   - Archivo: Selecciona un MP3 local
5. Haz clic en "Crear"
6. Debe aparecer en la lista

### Test 7: Recibir Mensajes de Usuario
1. Desde Telegram, envía un mensaje a tu bot
2. Abre el panel admin
3. Selecciona el usuario
4. El nuevo mensaje debe aparecer con etiqueta "user" ✓
5. Puedes responder directamente

## 🐛 Debugging

### Logs del Servidor
```bash
# Tail de logs en tiempo real
tail -f logs/app.log

# Buscar errores
grep "ERROR" logs/app.log

# Ver todo relacionado a mensajes manuales
grep -i "manual\|UserMessage" logs/app.log
```

### Verificar Base de Datos
```bash
# Ver tablas creadas
sqlite3 bot.db ".tables"

# Ver estructura de user_messages
sqlite3 bot.db ".schema user_messages"

# Contar mensajes
sqlite3 bot.db "SELECT COUNT(*) FROM user_messages;"

# Ver mensajes recientes
sqlite3 bot.db "SELECT id, user_id, content, sent_by, status, created_at FROM user_messages ORDER BY created_at DESC LIMIT 5;"
```

### Errores Comunes

**Error: "Bot not initialized"**
- Verifica que el token de Telegram sea válido
- Verifica que el bot esté en línea
- Revisa los logs

**Error: "User not found"**
- Asegúrate de que el user_id sea correcto
- Los usuarios deben tener al menos un mensaje registrado
- Verifica en la BD: `SELECT * FROM users;`

**Error: "Asset not found"**
- Verifica que el asset_id sea correcto
- Verifica que el asset existe: `SELECT * FROM predefined_assets;`

**Archivos no aparecen en el front**
- Revisa la consola del navegador (F12)
- Verifica en Network si la API responde
- Comprueba que el token sea correcto

## 📊 Verificación Completa

Ejecuta este script para una verificación completa:

```bash
#!/bin/bash

echo "🧪 Verificación Completa - Mensajería Manual"
echo "=============================================="

echo -e "\n1️⃣  Verificando Python..."
python3 --version

echo -e "\n2️⃣  Verificando dependencias..."
python3 -c "import fastapi, sqlalchemy, telegram, pydantic; print('✅ Todas importadas')"

echo -e "\n3️⃣  Compilando archivos Python..."
python3 -m py_compile src/backend/database.py src/backend/app.py src/backend/bot.py
echo "✅ Compilación exitosa"

echo -e "\n4️⃣  Verificando archivos necesarios..."
test -f src/backend/database.py && echo "✅ database.py"
test -f src/backend/app.py && echo "✅ app.py"
test -f src/backend/bot.py && echo "✅ bot.py"
test -f src/frontend/index.html && echo "✅ index.html"
test -f src/frontend/static/js/app.js && echo "✅ app.js"
test -f src/frontend/static/css/style.css && echo "✅ style.css"

echo -e "\n5️⃣  Verificando .env..."
test -f .env && echo "✅ .env existe" || echo "❌ .env NO encontrado"
grep TELEGRAM_BOT_TOKEN .env > /dev/null && echo "✅ TELEGRAM_BOT_TOKEN configurado"
grep ADMIN_TOKEN .env > /dev/null && echo "✅ ADMIN_TOKEN configurado"

echo -e "\n✅ Verificación completa!"
echo "Ejecuta: python3 -m uvicorn src.backend.app:app --reload"
```

## 🎯 Checklist Pre-Producción

- [ ] Base de datos inicializada con nuevas tablas
- [ ] Telegram bot token válido y bot online
- [ ] Admin token configurado
- [ ] Carpeta /uploads existe con permisos de escritura
- [ ] CORS configurado correctamente
- [ ] API endpoints respondiendo correctamente
- [ ] Frontend carga la nueva pestaña
- [ ] Chat UI se renderiza sin errores
- [ ] Mensajes se envían y reciben correctamente
- [ ] Estado de entrega se actualiza
- [ ] Assets predefinidos funcionan
- [ ] Búsqueda de usuarios funciona
- [ ] Historial se carga correctamente

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs: `tail -f logs/app.log`
2. Verifica la BD: `sqlite3 bot.db "SELECT * FROM user_messages LIMIT 1;"`
3. Comprueba la API: `curl http://localhost:8000/health`
4. Reinicia el servidor: `CTRL+C` y vuelve a ejecutar
5. Limpia caché del navegador: `CTRL+SHIFT+DEL`
