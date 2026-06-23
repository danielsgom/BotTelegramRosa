# Troubleshooting & FAQ - BotTelegramRosa

## Problemas Comunes

### 🤖 Bot de Telegram

#### El bot no responde a /start

**Síntomas:**
- Envío `/start` pero no recibo respuesta
- El bot aparece inactivo en Telegram

**Soluciones:**

1. **Verifica el token del bot**
   ```bash
   # Debe estar correcto en .env
   echo $TELEGRAM_BOT_TOKEN
   ```

2. **Verifica que el servidor está ejecutándose**
   ```bash
   # Abre otra terminal y verifica:
   curl http://localhost:8000/health
   ```

3. **Revisa los logs**
   ```bash
   # Busca errores de Telegram
   grep "TelegramError\|Bot\|Telegram" server.log
   ```

4. **Reinicia el bot**
   ```bash
   # Ctrl+C para detener
   # Luego ejecuta de nuevo:
   python app.py
   ```

5. **Recrea el bot en BotFather**
   - En Telegram, busca `@BotFather`
   - `/start` → `/newbot`
   - Sigue las instrucciones
   - Obtén nuevo token
   - Actualiza `.env` con el nuevo token
   - Reinicia la app

#### El bot responde pero muy lentamente

**Causas:**
- Servidor saturado
- Conexión de red lenta
- Muchos usuarios simultáneamente

**Soluciones:**
1. Aumenta recursos del servidor
2. Revisa velocidad de red: `ping 8.8.8.8`
3. Reduce cantidad de usuarios en pruebas
4. Usa herramientas de monitoreo

#### El bot no envía mensajes automáticamente

**Síntomas:**
- He creado un mensaje pero no se envía cada X horas
- El scheduler parece inactivo

**Soluciones:**

1. **Verifica que el mensaje está activo**
   ```bash
   # En el panel web, ve a "Mensajes"
   # Comprueba que el estado sea "Activo"
   ```

2. **Verifica que hay usuarios registrados**
   ```bash
   # En el panel: "Usuarios"
   # Debe haber al menos uno
   ```

3. **Revisa los logs del scheduler**
   ```bash
   grep "scheduler\|APScheduler" server.log
   ```

4. **Reinicia la app**
   ```bash
   # Ctrl+C
   # python app.py
   ```

5. **Verifica en BD**
   ```python
   # Abre Python en terminal
   from database import SessionLocal, Message
   db = SessionLocal()
   msg = db.query(Message).filter(Message.id == 1).first()
   print(msg.is_active)  # Debe ser True
   ```

#### Usuarios no reciben mensajes

**Posibles causas:**
- Usuario no ha iniciado con `/start`
- Usuario desactivó notificaciones
- Usuario bloqueó el bot
- Usuario tiene `is_active = False`

**Soluciones:**
1. Verifica en la pestaña "Usuarios" que el usuario existe y es_activo
2. Prueba con `/start` nuevamente
3. Revisa notificaciones de Telegram
4. Verifica en logs si hay errores de envío

---

### 💳 Stripe

#### El webhook de Stripe no se recibe

**Síntomas:**
- Usuario paga en Stripe pero no recibe link VIP
- No aparecen pagos en BD

**Soluciones:**

1. **Verifica que tu servidor es accesible desde internet**
   ```bash
   # Debe usar HTTPS (Stripe lo requiere)
   # En desarrollo, usa ngrok:
   ngrok http 8000
   # Usa la URL ngrok como webhook
   ```

2. **Configura el webhook en Stripe**
   - Dashboard → Settings → Webhooks
   - Add endpoint
   - URL: `https://tudominio.com/webhook/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

3. **Verifica el webhook secret**
   ```bash
   # En Stripe, ve a Webhooks
   # Copia el "Signing secret"
   # Pega en .env → STRIPE_WEBHOOK_SECRET
   ```

4. **Prueba el webhook manualmente**
   ```bash
   curl -X POST http://localhost:8000/webhook/stripe \
     -H "Content-Type: application/json" \
     -H "stripe-signature: t=timestamp,v1=invalid" \
     -d '{"type": "payment_intent.succeeded"}'
   ```

5. **Revisa logs de errores**
   ```bash
   grep "Stripe\|webhook" server.log
   ```

#### El payment intent no se crea

**Síntomas:**
- Error 500 al hacer clic en pagar
- "No payment link" en respuesta

**Soluciones:**
1. Verifica `STRIPE_API_KEY` en `.env`
2. Verifica que la clave comience con `sk_` (es clave secreta, no pública)
3. Revisa que la clave no esté expirada
4. Prueba con API de Stripe directamente:
   ```bash
   curl https://api.stripe.com/v1/payment_intents \
     -u sk_test_YOUR_KEY: \
     -d "amount=1000" \
     -d "currency=usd"
   ```

#### Usuario recibe el link VIP dos veces

**Causa:**
- El webhook se procesa dos veces (Stripe lo intenta si falla)

**Solución:**
- Verificar que la firma del webhook es válida
- Implementar idempotencia (guardar `stripe_payment_id` únicamente)

---

### 📊 Base de Datos

#### "database is locked" (SQLite)

**Síntomas:**
- Error: `database is locked`
- La app no puede guardar datos

**Causa:**
- SQLite no soporta acceso simultáneo bien
- Archivos corrompidos o procesos múltiples

**Soluciones:**

1. **Elimina el archivo de BD y recrea**
   ```bash
   rm bot.db
   python app.py  # Se crea automáticamente
   ```

2. **Cambia a PostgreSQL para producción**
   - Instala PostgreSQL
   - Actualiza `DATABASE_URL` en `.env`
   - Ejecuta migraciones

3. **Mata procesos de Python**
   ```bash
   lsof -ti:8000 | xargs kill -9  # Mata proceso en puerto 8000
   ```

#### "Mensaje no encontrado"

**Causa:**
- El ID no existe en la base de datos

**Solución:**
```bash
# Verifica IDs válidos
curl http://localhost:8000/api/messages \
  -H "X-API-Token: admin-token-123"
# Usa un ID de la lista
```

#### Base de datos muy grande

**Síntomas:**
- Bot va lento
- Consultas tardan mucho
- Disco casi lleno

**Soluciones:**

1. **Limpia datos antiguos**
   ```python
   from datetime import datetime, timedelta
   from database import SessionLocal, MessageSent
   
   db = SessionLocal()
   cutoff = datetime.utcnow() - timedelta(days=90)
   db.query(MessageSent).filter(MessageSent.sent_at < cutoff).delete()
   db.commit()
   ```

2. **Crea índices en tablas grandes**
   ```python
   # Ya están creados en models.py
   # Pero puedes añadir manualmente:
   from database import engine
   engine.execute("CREATE INDEX idx_messages_sent_user_id ON messages_sent(user_id)")
   ```

3. **Migra a PostgreSQL**
   - Mejor manejo de almacenamiento
   - Mejor rendimiento

---

### 🌐 Frontend / Panel Web

#### "Token API inválido"

**Síntomas:**
- Error: "Invalid or missing API token"
- No puedo acceder al panel

**Soluciones:**

1. **Verifica el token en .env**
   ```bash
   grep ADMIN_TOKEN .env
   ```

2. **Ingresa el token en el panel**
   - Abre http://localhost:8000
   - Ve a "Configuración"
   - Pega el token exacto del `.env`
   - Click en "Guardar"

3. **Revisa que no hay espacios extras**
   ```bash
   # Malo:
   ADMIN_TOKEN= admin-token-123  # Espacio antes
   
   # Bien:
   ADMIN_TOKEN=admin-token-123
   ```

#### Panel no carga / Error 404

**Síntomas:**
- Accedo a http://localhost:8000 pero página en blanco
- Error 404

**Soluciones:**

1. **Verifica que el frontend existe**
   ```bash
   ls -la src/frontend/index.html
   ```

2. **Verifica rutas en app.py**
   ```bash
   grep "index.html\|frontend" src/backend/app.py
   ```

3. **Reinicia el servidor**
   ```bash
   Ctrl+C
   python src/backend/app.py
   ```

4. **Verifica puerto**
   ```bash
   # Debe estar en 8000
   lsof -i :8000
   ```

#### No puedo cargar imágenes

**Síntomas:**
- Error al subir imagen
- "File too large"
- Formato no soportado

**Soluciones:**

1. **Verifica tamaño máximo**
   ```bash
   # En .env
   MAX_FILE_SIZE=10485760  # 10MB
   ```

2. **Verifica formato**
   ```bash
   # Soportados: jpg, jpeg, png, gif, webp
   # Convierte a PNG si es necesario:
   convert imagen.bmp imagen.png
   ```

3. **Crea carpeta de uploads**
   ```bash
   mkdir -p uploads
   chmod 755 uploads
   ```

#### JavaScript console shows errors

**Solución:**
1. Abre DevTools (F12)
2. Ve a "Console"
3. Lee el error
4. Revisa que:
   - `API_BASE` es correcto
   - Token se pasó correctamente
   - Endpoint existe

---

### ⚙️ Configuración

#### Variables de entorno no se cargan

**Síntomas:**
- La app usa valores por defecto
- Las variables del .env se ignoran

**Soluciones:**

1. **Verifica que .env existe**
   ```bash
   ls -la .env
   ```

2. **Verifica formato**
   ```bash
   # Correcto:
   TELEGRAM_BOT_TOKEN=abc123
   STRIPE_API_KEY=sk_test_xyz
   
   # Incorrecto:
   TELEGRAM_BOT_TOKEN = abc123  # Espacios
   STRIPE_API_KEY: sk_test_xyz  # Dos puntos
   ```

3. **Recarga la app**
   ```bash
   Ctrl+C
   python app.py
   ```

4. **Verifica que se cargan**
   ```bash
   grep "Settings loaded\|Loading config" server.log
   ```

#### Puerto 8000 ya está en uso

**Error:**
```
OSError: [Errno 48] Address already in use
```

**Soluciones:**

1. **Mata el proceso anterior**
   ```bash
   lsof -ti:8000 | xargs kill -9
   ```

2. **Usa otro puerto**
   ```bash
   # En .env
   PORT=8001
   
   # Luego accede a http://localhost:8001
   ```

3. **Encuentra qué está usando el puerto**
   ```bash
   lsof -i :8000
   ```

---

## FAQ

### ¿Cuántos usuarios puedo gestionar?

**Respuesta:**
- **SQLite en desarrollo:** 10,000 - 50,000
- **PostgreSQL en producción:** 1M+

### ¿Qué tan rápido se envían los mensajes?

**Respuesta:**
- Telegram API: ~100 mensajes/segundo
- Estimado: 1 minuto para 6000 usuarios

### ¿Los mensajes se guardan si el servidor cae?

**Respuesta:**
- Sí, se guardan en BD como pendientes
- Se envían en el siguiente ciclo

### ¿Puedo programar múltiples mensajes?

**Respuesta:**
- Sí, ilimitados
- Cada uno con su propio intervalo
- Ej: Mensaje 1 cada 2h, Mensaje 2 cada 4h

### ¿Qué pasa si un usuario me bloquea?

**Respuesta:**
- El envío fallaría silenciosamente
- Se registra en `MessageSent.status = "failed"`
- El bot NO lo desbloquea automáticamente

### ¿Puedo cambiar el mensaje sin perder el historial?

**Respuesta:**
- Sí, edita el mensaje en el panel
- El historial se mantiene en `messages_sent`

### ¿Qué idiomas soportas?

**Respuesta:**
- Español (es), Inglés (en), Francés (fr)
- Alemán (de), Italiano (it), Portugués (pt)
- Ruso (ru), y más

Añade más en `language.py`

### ¿Cómo hago backup de mis datos?

**Respuesta:**
```bash
# SQLite
cp bot.db bot.db.backup

# PostgreSQL
pg_dump -U user database > backup.sql
```

### ¿Puedo ver estadísticas de envíos?

**Respuesta:**
- Revisa tabla `messages_sent`
- Próximamente: Panel de estadísticas

### ¿Qué hacer si alguien reporta el bot como spam?

**Respuesta:**
1. Deactivar el bot en BotFather
2. Esperar 24 horas
3. Recrear el bot
4. Mejorar el contenido (no spam real)
5. No enviar más de 1-2 mensajes por hora por usuario

### ¿Puedo testear sin servidor real?

**Respuesta:**
```bash
# Usa ngrok para exponer localhost:
ngrok http 8000
# Usa URL de ngrok en configuración de webhooks
```

---

## Commandos de Debug

```bash
# Ver logs en tiempo real
tail -f server.log

# Filtrar solo errores
grep "ERROR" server.log

# Ver últimos 100 logs
tail -100 server.log

# Buscar un usuario específico
grep "telegram_id: 123456789" server.log

# Ver consumo de recursos
watch -n 1 'ps aux | grep python'

# Probar conectividad a Stripe
curl https://api.stripe.com/v1/payment_methods -u sk_test_YOUR_KEY:

# Probar bot de Telegram
curl https://api.telegram.org/botTOKEN/getMe

# Ver base de datos (SQLite)
sqlite3 bot.db "SELECT * FROM users;"
```

---

## Performance

### Optimizaciones rápidas

```python
# En database.py, agregar índices
engine.execute("""
CREATE INDEX IF NOT EXISTS idx_users_active 
ON users(is_active);
""")

engine.execute("""
CREATE INDEX IF NOT EXISTS idx_messages_active 
ON messages(is_active);
""")
```

### Monitoreo

```python
# Agregar a app.py para ver requests
from fastapi_logging import LoggingMiddleware
app.add_middleware(LoggingMiddleware)
```

---

## Contacto & Soporte

- **GitHub Issues:** [tu-repo/issues]
- **Email:** soporte@ejemplo.com
- **Discord:** [tu-servidor]

---

**Last updated: 2024-01-15**
