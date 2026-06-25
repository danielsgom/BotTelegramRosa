# 📡 API Reference - Mensajería Manual

Todos los endpoints requieren header: `X-API-Token: tu_admin_token`

## Users Management

### Get All Users
```http
GET /api/admin/users?limit=100&skip=0&search=opcional
```

**Response:**
```json
{
  "success": true,
  "total": 5,
  "users": [
    {
      "id": 1,
      "telegram_id": 123456789,
      "first_name": "Rosa",
      "last_name": "García",
      "username": "rosa_user",
      "language": "es",
      "is_active": true,
      "is_vip": false,
      "joined_at": "2026-06-20T10:00:00",
      "last_message_at": "2026-06-25T14:30:00"
    }
  ]
}
```

**Query Parameters:**
- `limit` - Máximo de usuarios (default: 50)
- `skip` - Saltar N usuarios (paginación)
- `search` - Filtrar por nombre/username/telegram_id

---

## Chat History

### Get Chat History
```http
GET /api/admin/users/{user_id}/chat/history?limit=50
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "telegram_id": 123456789,
    "first_name": "Rosa",
    "last_name": "García",
    "username": "rosa_user",
    "is_vip": false
  },
  "messages": [
    {
      "id": 42,
      "content": "¿Tienes stock?",
      "type": "text",
      "sent_by": "user",
      "attachment_url": null,
      "status": "delivered",
      "created_at": "2026-06-25T14:25:00",
      "delivered_at": "2026-06-25T14:25:05"
    },
    {
      "id": 43,
      "content": "Sí, tenemos stock",
      "type": "text",
      "sent_by": "admin",
      "status": "delivered",
      "created_at": "2026-06-25T14:30:00",
      "delivered_at": "2026-06-25T14:30:03"
    }
  ]
}
```

**Query Parameters:**
- `limit` - Máximo de mensajes (default: 50)

**Message Types:**
- `text` - Texto plano
- `audio` - Archivo de audio
- `image` - Imagen
- `video` - Video
- `link` - Enlace

**Message Status:**
- `sent` - Enviado pero no confirmado
- `delivered` - Entregado en Telegram ✓✓
- `failed` - Error al enviar

---

## Send Manual Message

### Send Message/Audio/Image/Video/Link
```http
POST /api/admin/users/{user_id}/chat/message
Content-Type: multipart/form-data
```

**Form Parameters:**

```
content=string (opcional, texto del mensaje)
message_type=string (default: text) [text|audio|image|video|link]
attachment=file (opcional, archivo a subir)
attachment_url=string (opcional, URL externa)
predefined_asset_id=integer (opcional, usar asset predefinido)
```

**Examples:**

### 1. Send Text Message
```bash
curl -X POST \
  -H "X-API-Token: tu_token" \
  -F "content=¡Hola Rosa!" \
  -F "message_type=text" \
  http://localhost:8000/api/admin/users/1/chat/message
```

### 2. Send Audio File
```bash
curl -X POST \
  -H "X-API-Token: tu_token" \
  -F "content=Bienvenida" \
  -F "message_type=audio" \
  -F "attachment=@/path/to/audio.mp3" \
  http://localhost:8000/api/admin/users/1/chat/message
```

### 3. Send Predefined Asset
```bash
curl -X POST \
  -H "X-API-Token: tu_token" \
  -F "predefined_asset_id=10" \
  http://localhost:8000/api/admin/users/1/chat/message
```

### 4. Send External Image
```bash
curl -X POST \
  -H "X-API-Token: tu_token" \
  -F "content=Imagen del producto" \
  -F "message_type=image" \
  -F "attachment_url=https://ejemplo.com/imagen.jpg" \
  http://localhost:8000/api/admin/users/1/chat/message
```

**Response:**
```json
{
  "success": true,
  "message_id": 44,
  "status": "sent"
}
```

---

## Predefined Assets

### Get All Assets
```http
GET /api/admin/predefined-assets?asset_type=optional&category=optional
```

**Response:**
```json
{
  "success": true,
  "assets": [
    {
      "id": 10,
      "name": "Welcome Audio",
      "asset_type": "audio",
      "file_url": "/uploads/1234567890_bienvenida.mp3",
      "link_url": null,
      "category": "greetings",
      "description": "Audio de bienvenida para nuevos usuarios",
      "created_at": "2026-06-24T10:00:00"
    },
    {
      "id": 11,
      "name": "Product Catalog",
      "asset_type": "link",
      "file_url": null,
      "link_url": "https://catalogo.ejemplo.com",
      "category": "sales",
      "description": "Catálogo de productos",
      "created_at": "2026-06-23T15:30:00"
    }
  ]
}
```

**Query Parameters:**
- `asset_type` - Filtrar por tipo (audio|image|video|link)
- `category` - Filtrar por categoría

### Create Asset
```http
POST /api/admin/predefined-assets
Content-Type: multipart/form-data
```

**Form Parameters:**
```
name=string (required, unique)
asset_type=string (required) [audio|image|video|link]
category=string (optional)
description=string (optional)
file=file (optional, para tipos que necesitan archivo)
link_url=string (optional, para type=link)
```

**Example:**
```bash
curl -X POST \
  -H "X-API-Token: tu_token" \
  -F "name=Audio_Promocion" \
  -F "asset_type=audio" \
  -F "category=promotions" \
  -F "description=Audio sobre la promo de verano" \
  -F "file=@promo.mp3" \
  http://localhost:8000/api/admin/predefined-assets
```

**Response:**
```json
{
  "success": true,
  "asset_id": 12,
  "name": "Audio_Promocion"
}
```

### Delete Asset
```http
DELETE /api/admin/predefined-assets/{asset_id}
```

**Example:**
```bash
curl -X DELETE \
  -H "X-API-Token: tu_token" \
  http://localhost:8000/api/admin/predefined-assets/12
```

**Response:**
```json
{
  "success": true,
  "message": "Asset deleted"
}
```

---

## Error Responses

### User Not Found
```json
{
  "detail": "User not found"
}
```
HTTP Status: 404

### Invalid Token
```json
{
  "detail": "Invalid or missing API token"
}
```
HTTP Status: 401

### Asset Not Found
```json
{
  "detail": "Asset not found"
}
```
HTTP Status: 404

### File Upload Failed
```json
{
  "detail": "Failed to process file"
}
```
HTTP Status: 500

---

## Rate Limits

No hay límite oficial, pero se recomienda:
- No enviar más de 10 mensajes/segundo
- No subir archivos > 50MB
- Máximo 100 usuarios por query

---

## Ejemplo Completo de Flujo

### 1. Get Users
```bash
curl -H "X-API-Token: mytoken" \
  http://localhost:8000/api/admin/users | jq '.users[0].id'
# Output: 1
```

### 2. Get Chat History
```bash
curl -H "X-API-Token: mytoken" \
  http://localhost:8000/api/admin/users/1/chat/history | jq '.messages'
```

### 3. Create Predefined Asset
```bash
curl -X POST \
  -H "X-API-Token: mytoken" \
  -F "name=Welcome" \
  -F "asset_type=audio" \
  -F "file=@welcome.mp3" \
  http://localhost:8000/api/admin/predefined-assets | jq '.asset_id'
# Output: 5
```

### 4. Send Message Using Asset
```bash
curl -X POST \
  -H "X-API-Token: mytoken" \
  -F "predefined_asset_id=5" \
  http://localhost:8000/api/admin/users/1/chat/message
```

### 5. Get Updated History
```bash
curl -H "X-API-Token: mytoken" \
  http://localhost:8000/api/admin/users/1/chat/history | jq '.messages[-1]'
```

---

## Testing con Postman

Importa esta colección:

```json
{
  "info": {
    "name": "BotTelegramRosa - Manual Messages",
    "version": "1.0"
  },
  "auth": {
    "type": "apiKey",
    "apiKey": [
      {
        "key": "X-API-Token",
        "value": "{{api_token}}",
        "type": "string"
      }
    ]
  },
  "item": [
    {
      "name": "Get Users",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/admin/users?limit=100"
      }
    },
    {
      "name": "Get Chat History",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/admin/users/{{user_id}}/chat/history"
      }
    },
    {
      "name": "Send Message",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/admin/users/{{user_id}}/chat/message",
        "body": {
          "mode": "formdata",
          "formdata": [
            {"key": "content", "value": "Hola!"},
            {"key": "message_type", "value": "text"}
          ]
        }
      }
    }
  ]
}
```

**Environment Variables:**
```
base_url = http://localhost:8000
api_token = tu_admin_token
user_id = 1
```

---

## Notes

- Todos los timestamps están en UTC (formato ISO 8601)
- Los archivos se guardan en `/uploads/`
- El nombre del archivo se genera automáticamente: `{timestamp}_{original_name}`
- Máximo 50 mensajes por query de historial
- Los campos `delivered_at` son null hasta que Telegram confirme

---

**Version**: 1.0  
**Last Updated**: 2026-06-25
