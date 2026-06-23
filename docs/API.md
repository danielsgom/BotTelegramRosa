# API REST - BotTelegramRosa

## Base URL

```
http://localhost:8000/api
```

## Autenticación

Todos los endpoints (excepto `/health`) requieren un token API en el header:

```bash
X-API-Token: <token>
```

El token se configura en la variable de entorno `ADMIN_TOKEN`.

## Health Check

### GET /health

Verificar que el servidor está funcionando.

**Respuesta:**
```json
{
  "status": "ok",
  "app": "BotTelegramRosa",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Mensajes API

### GET /api/messages

Obtener lista de todos los mensajes.

**Parámetros query:**
- `skip` (int, opcional): Saltar N registros. Default: 0
- `limit` (int, opcional): Limitar a N registros. Default: 50

**Ejemplo:**
```bash
curl http://localhost:8000/api/messages?skip=0&limit=10 \
  -H "X-API-Token: admin-token-123"
```

**Respuesta:**
```json
{
  "success": true,
  "count": 3,
  "messages": [
    {
      "id": 1,
      "title": "Oferta Especial",
      "text": "¡50% descuento hoy!...",
      "is_active": true,
      "hours_interval": 2,
      "created_at": "2024-01-15T10:00:00Z",
      "last_sent_at": "2024-01-15T14:00:00Z",
      "image_url": "/uploads/123456_imagen.jpg"
    },
    ...
  ]
}
```

---

### POST /api/messages

Crear un nuevo mensaje.

**Content-Type:** `multipart/form-data`

**Parámetros:**
- `title` (string, requerido): Título del mensaje
- `text` (string, requerido): Contenido del mensaje
- `hours_interval` (int, default: 2): Horas entre envíos
- `is_active` (boolean, default: true): Si se envía automáticamente
- `image` (file, opcional): Imagen para el mensaje
- `stripe_links` (json, default: []): Array de links de pago

**Ejemplo con curl:**
```bash
curl -X POST http://localhost:8000/api/messages \
  -H "X-API-Token: admin-token-123" \
  -F "title=Mi Oferta" \
  -F "text=¡Hola! Aprovecha este descuento" \
  -F "hours_interval=2" \
  -F "is_active=true" \
  -F "stripe_links=[{\"url\": \"https://buy.stripe.com/test123\"}]" \
  -F "image=@imagen.jpg"
```

**Respuesta (201 Created):**
```json
{
  "success": true,
  "message_id": 5,
  "title": "Mi Oferta"
}
```

---

### GET /api/messages/{message_id}

Obtener detalles completos de un mensaje.

**Parámetros:**
- `message_id` (int): ID del mensaje

**Ejemplo:**
```bash
curl http://localhost:8000/api/messages/1 \
  -H "X-API-Token: admin-token-123"
```

**Respuesta:**
```json
{
  "success": true,
  "message": {
    "id": 1,
    "title": "Oferta Especial",
    "text": "¡50% descuento hoy! Accede a nuestro canal VIP",
    "image_url": "/uploads/123456_imagen.jpg",
    "stripe_links": [
      {"url": "https://buy.stripe.com/test123"},
      {"url": "https://buy.stripe.com/test456"}
    ],
    "hours_interval": 2,
    "is_active": true,
    "created_at": "2024-01-15T10:00:00Z",
    "last_sent_at": "2024-01-15T14:00:00Z"
  }
}
```

---

### PUT /api/messages/{message_id}

Actualizar un mensaje existente.

**Content-Type:** `multipart/form-data`

**Parámetros (todos opcionales):**
- `title` (string): Nuevo título
- `text` (string): Nuevo contenido
- `hours_interval` (int): Nuevo intervalo
- `is_active` (boolean): Nuevo estado
- `image` (file): Nueva imagen
- `stripe_links` (json): Nuevos links de pago

**Ejemplo:**
```bash
curl -X PUT http://localhost:8000/api/messages/1 \
  -H "X-API-Token: admin-token-123" \
  -F "title=Oferta Actualizada" \
  -F "hours_interval=3" \
  -F "stripe_links=[{\"url\": \"https://buy.stripe.com/new123\"}]"
```

**Respuesta:**
```json
{
  "success": true,
  "message_id": 1,
  "title": "Oferta Actualizada"
}
```

---

### DELETE /api/messages/{message_id}

Eliminar un mensaje.

**Ejemplo:**
```bash
curl -X DELETE http://localhost:8000/api/messages/1 \
  -H "X-API-Token: admin-token-123"
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Message deleted"
}
```

---

### POST /api/messages/{message_id}/send

Enviar un mensaje inmediatamente a todos los usuarios.

**Ejemplo:**
```bash
curl -X POST http://localhost:8000/api/messages/1/send \
  -H "X-API-Token: admin-token-123"
```

**Respuesta:**
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "sent": 148,
    "failed": 2,
    "errors": [
      "User 12345: User not found",
      "User 67890: Bot blocked by user"
    ]
  }
}
```

---

## Usuarios API

### GET /api/users

Obtener lista de usuarios.

**Parámetros query:**
- `skip` (int, opcional): Default: 0
- `limit` (int, opcional): Default: 50

**Ejemplo:**
```bash
curl http://localhost:8000/api/users?limit=20 \
  -H "X-API-Token: admin-token-123"
```

**Respuesta:**
```json
{
  "success": true,
  "count": 150,
  "users": [
    {
      "id": 1,
      "telegram_id": 123456789,
      "first_name": "Juan",
      "username": "juanperez",
      "language": "es",
      "is_active": true,
      "is_vip": false,
      "joined_at": "2024-01-10T15:30:00Z",
      "last_message_at": "2024-01-15T14:00:00Z"
    },
    ...
  ]
}
```

---

### GET /api/users/{user_id}

Obtener detalles de un usuario específico.

**Ejemplo:**
```bash
curl http://localhost:8000/api/users/1 \
  -H "X-API-Token: admin-token-123"
```

**Respuesta:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "telegram_id": 123456789,
    "first_name": "Juan",
    "last_name": "Pérez",
    "username": "juanperez",
    "language": "es",
    "is_active": true,
    "is_vip": true,
    "vip_expires_at": "2024-12-31T23:59:59Z",
    "joined_at": "2024-01-10T15:30:00Z",
    "last_message_at": "2024-01-15T14:00:00Z",
    "payments_count": 2
  }
}
```

---

### DELETE /api/users/{user_id}

Desactivar un usuario (no recibe más mensajes).

**Ejemplo:**
```bash
curl -X DELETE http://localhost:8000/api/users/1 \
  -H "X-API-Token: admin-token-123"
```

**Respuesta:**
```json
{
  "success": true,
  "message": "User deactivated"
}
```

---

## Scheduler API

### GET /api/scheduler/jobs

Obtener lista de trabajos programados.

**Ejemplo:**
```bash
curl http://localhost:8000/api/scheduler/jobs \
  -H "X-API-Token: admin-token-123"
```

**Respuesta:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "message_1",
      "name": "Send message 1 every 2 hours",
      "next_run": "2024-01-15T16:00:00Z",
      "trigger": "interval[0:02:00]"
    },
    {
      "id": "message_3",
      "name": "Send message 3 every 3 hours",
      "next_run": "2024-01-15T17:30:00Z",
      "trigger": "interval[0:03:00]"
    }
  ]
}
```

---

### POST /api/scheduler/pause/{message_id}

Pausar el envío automático de un mensaje.

**Ejemplo:**
```bash
curl -X POST http://localhost:8000/api/scheduler/pause/1 \
  -H "X-API-Token: admin-token-123"
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Message paused"
}
```

---

### POST /api/scheduler/resume/{message_id}

Reanudar el envío automático de un mensaje.

**Ejemplo:**
```bash
curl -X POST http://localhost:8000/api/scheduler/resume/1 \
  -H "X-API-Token: admin-token-123"
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Message resumed"
}
```

---

## Webhooks

### POST /webhook/stripe

Recibir y procesar webhooks de Stripe.

Este endpoint se configura en el panel de Stripe:
1. Ve a Stripe Dashboard
2. Settings → Webhooks
3. Add endpoint
4. URL: `https://tudominio.com/webhook/stripe`
5. Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`

**Headers (Stripe proporciona):**
```
stripe-signature: t=timestamp,v1=signature
```

**Body (ejemplo para `payment_intent.succeeded`):**
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "amount": 9900,
      "currency": "usd",
      "status": "succeeded",
      "metadata": {
        "user_id": "1",
        "message_id": "1"
      }
    }
  }
}
```

**Respuesta:**
```json
{
  "success": true
}
```

**Qué sucede internamente:**
1. Verifica la firma del webhook
2. Busca el Payment por `stripe_payment_id`
3. Marca como "completed"
4. Genera link VIP
5. Envía link al usuario por Telegram
6. Marca usuario como VIP

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado |
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - Token API inválido |
| 404 | Not Found - Recurso no existe |
| 500 | Internal Server Error - Error del servidor |

**Ejemplo de error:**
```json
{
  "detail": "Invalid or missing API token"
}
```

---

## Ejemplos de Uso

### Python

```python
import requests

API_BASE = "http://localhost:8000/api"
TOKEN = "admin-token-123"

headers = {"X-API-Token": TOKEN}

# Obtener mensajes
response = requests.get(f"{API_BASE}/messages", headers=headers)
messages = response.json()["messages"]

# Crear mensaje
data = {
    "title": "Nuevo Mensaje",
    "text": "Contenido",
    "hours_interval": 2,
    "is_active": True
}
response = requests.post(f"{API_BASE}/messages", json=data, headers=headers)
new_message = response.json()
```

### JavaScript

```javascript
const API_BASE = "http://localhost:8000/api";
const TOKEN = "admin-token-123";

async function getMessages() {
  const response = await fetch(`${API_BASE}/messages`, {
    headers: {"X-API-Token": TOKEN}
  });
  return response.json();
}

async function createMessage(title, text) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("text", text);
  formData.append("is_active", true);
  
  const response = await fetch(`${API_BASE}/messages`, {
    method: "POST",
    headers: {"X-API-Token": TOKEN},
    body: formData
  });
  return response.json();
}
```

### cURL

```bash
# Health check
curl http://localhost:8000/health

# Crear mensaje
curl -X POST http://localhost:8000/api/messages \
  -H "X-API-Token: admin-token-123" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Oferta",
    "text": "Descuento especial",
    "hours_interval": 2,
    "is_active": true
  }'

# Obtener usuarios
curl http://localhost:8000/api/users \
  -H "X-API-Token: admin-token-123"
```

---

## Rate Limiting (Futuro)

Actualmente no implementado. Para producción:

```
- 100 requests por minuto por token
- 1000 requests por hora por token
```

---

**Documentación de API completa.**
