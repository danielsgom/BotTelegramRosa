# 💬 Feature: Mensajería Manual - Guía de Uso

## Descripción General
Esta feature permite a los administradores gestionar conversaciones manuales con usuarios de forma bidireccional a través del panel admin. Los usuarios pueden responder desde Telegram y ver en el panel, y el admin puede enviar mensajes, archivos y links predefinidos.

## 🎯 Características Implementadas

### 1. **Panel de Mensajes Manuales**
- Nueva pestaña "Mensajes Manuales" en el navbar del admin
- Interfaz tipo chat con:
  - **Panel izquierdo**: Lista de usuarios con búsqueda
  - **Panel derecho**: Historial de chat y área de envío de mensajes

### 2. **Historial de Conversaciones Bidireccional**
- Ver todos los mensajes del usuario (enviados por usuario o admin)
- Timestampo de cada mensaje
- Estado de entrega: ✗ fallido, ✓ enviado, ✓✓ entregado

### 3. **Tipos de Mensaje Soportados**
- 📝 **Texto**: Mensajes de texto plano
- 🎵 **Audio**: MP3 y archivos de audio predefinidos
- 🖼️ **Imagen**: JPG, PNG, etc. predefinidas
- 🎬 **Video**: MP4 y otros formatos de video
- 🔗 **Links**: URLs predefinidas

### 4. **Gestión de Archivos Predefinidos**
- Subir y guardar archivos reutilizables
- Categorizar archivos por tipo
- Seleccionar desde el panel sin subir cada vez
- CRUD completo desde el panel

### 5. **Captura de Mensajes de Usuario**
- Los mensajes que envían los usuarios desde Telegram se guardan automáticamente
- Aparecen en el historial del chat en el panel admin
- Permite respuestas en contexto

## 🔧 Cambios Técnicos

### Base de Datos - Nuevos Modelos

#### `UserMessage`
```python
- id: Integer (PK)
- user_id: Integer (FK → users)
- content: Text (texto del mensaje)
- message_type: String (text|audio|image|video|link)
- sent_by: String (user|admin)
- attachment_url: String (URL del archivo)
- telegram_message_id: Integer (ID de Telegram)
- status: String (sent|delivered|failed)
- created_at: DateTime
- delivered_at: DateTime
- error_message: Text
```

#### `PredefinedAsset`
```python
- id: Integer (PK)
- name: String (nombre único)
- asset_type: String (audio|image|video|link)
- file_url: String (URL del archivo subido)
- link_url: String (URL para links)
- category: String (categorización)
- description: Text
- created_at/updated_at: DateTime
```

### Backend - API Endpoints

#### Mensajería
- `GET /api/admin/users` - Listar usuarios
- `GET /api/admin/users/{user_id}/chat/history` - Historial del chat
- `POST /api/admin/users/{user_id}/chat/message` - Enviar mensaje
- `PATCH /api/admin/users/{user_id}/chat/message/{msg_id}/status` - Actualizar estado

#### Archivos Predefinidos
- `GET /api/admin/predefined-assets` - Listar archivos
- `POST /api/admin/predefined-assets` - Crear archivo
- `DELETE /api/admin/predefined-assets/{asset_id}` - Eliminar archivo

### Bot de Telegram - Nuevas Funcionalidades

#### En `bot.py`
- `handle_message()` - Captura mensajes de usuarios y los guarda en `user_messages`
- `send_manual_message()` - Envía mensajes manuales vía Telegram API

#### En `database.py`
- Nuevos modelos: `UserMessage`, `PredefinedAsset`

### Frontend - Nueva Interfaz

#### Archivo: `index.html`
- Nuevo tab "mensajes-tab" con layout de chat
- Panel izquierdo: lista de usuarios filtrable
- Panel derecho: historial + área de envío

#### Archivo: `app.js`
- `loadUsersForChat()` - Carga usuarios
- `selectUserForChat()` - Selecciona un usuario y carga historial
- `renderChatHistory()` - Renderiza los mensajes
- `sendManualMessage()` - Envía un mensaje
- `showPredefinedAssets()` - Muestra assets predefinidos
- `loadPredefinedAssets()` - Carga assets

#### Archivo: `style.css`
- Estilos para chat UI
- Scrollbars personalizados
- Hovering effects

## 📖 Cómo Usar

### 1. **Enviar un Mensaje Manual**
1. Ve a la pestaña "Mensajes Manuales"
2. Haz clic en un usuario de la lista izquierda
3. Escribe tu mensaje en el área de texto
4. Haz clic en "Enviar" ✓

### 2. **Enviar un Archivo Predefinido**
1. Selecciona un usuario
2. Haz clic en uno de los botones:
   - 🎵 Audio
   - 🖼️ Imagen
   - 🎬 Video
   - 🔗 Link
3. Selecciona de la lista
4. Se envía automáticamente

### 3. **Crear un Archivo Predefinido**
1. Abre el modal de archivos (botones 🎵, 🖼️, etc.)
2. Haz clic en "+ Nuevo"
3. Llena el formulario:
   - Nombre
   - Categoría (opcional)
   - Descripción
   - Archivo/Link
4. Haz clic en "Crear"

### 4. **Ver Historial de Chat**
- Al seleccionar un usuario, verás automáticamente:
  - Todos los mensajes previos
  - Quién envió cada uno (usuario 👤 o admin 💼)
  - Timestamps
  - Estado de entrega

### 5. **Ver Respuestas de Usuarios**
- Los mensajes que envían los usuarios desde Telegram aparecen automáticamente en el historial
- Aparecen con la etiqueta del usuario
- Puedes responder directamente

## 🔐 Seguridad

- Todos los endpoints requieren token API (`X-API-Token`)
- Solo los admin puede acceder al panel
- Los archivos se suben al directorio `/uploads`
- Se validan tipos de archivo

## 📝 Notas Importantes

1. **Telegram Integration**: El bot debe estar corriendo y configurado
2. **Webhooks**: Los mensajes del usuario se capturan vía polling de Telegram
3. **Delivery Status**: Se actualiza cuando Telegram confirma entrega
4. **Timestamps**: Todos en zona horaria Madrid (UTC+1)

## 🐛 Troubleshooting

### Los mensajes no se envían
- Verifica que el token de Telegram esté configurado
- Revisa los logs para errores
- Asegúrate de que el bot esté corriendo

### Los archivos predefinidos no aparecen
- Recarga la página
- Verifica que hayas subido el archivo correctamente
- Comprueba permisos de carpeta `/uploads`

### El chat no muestra mensajes antiguos
- Los últimos 50 mensajes se cargan por defecto
- Espera un momento a que carguen
- Verifica la conexión de API

## 📊 Ejemplo de Flujo

```
Admin abre panel → Mensajes Manuales
    ↓
Selecciona usuario "Rosa"
    ↓
Ve historial:
  - Rosa: "Hola, ¿tienen envío a mi zona?"
  - Admin: "Sí, enviamos a todo el país"
  - Rosa: "¿Cuál es el costo?"
    ↓
Admin escribe respuesta o selecciona audio predefinido
    ↓
Mensaje se envía vía Telegram
    ↓
Estado cambia a "✓✓ Entregado"
    ↓
Rosa recibe en Telegram
```

## 🎨 UI Preview

```
┌─────────────────────────────────────────────────┐
│ BotTelegramRosa - Mensajes Manuales             │
├──────────────────┬───────────────────────────────┤
│ 👤 Rosa          │ Rosa María                    │
│ @rosa_user       │ telegram_id: 123456789        │
│ Last: hace 2h    │                              │
│                  │ Rosa: "Hola, tengo una        │
│ 👤 Juan          │ pregunta..."      [hace 5m] ✓ │
│ @juan_dev        │                              │
│ Last: hace 1h    │ Admin: "Claro, ¿qué          │
│                  │ necesitas?"       [ahora] ✓✓  │
│ [Buscar...]      ├──────────────────────────────┤
│                  │ ┌────────────────────────────┐ │
│                  │ │ Escribe tu mensaje...      │ │
│                  │ ├────────────────────────────┤ │
│                  │ │ [File] [🎵] [🖼️] [🎬] [🔗]   │
│                  │ │            [Enviar ✓]    │ │
│                  │ └────────────────────────────┘ │
└──────────────────┴───────────────────────────────┘
```

## ✅ Testing

Para probar la feature:

1. Inicia el servidor
2. Ve a http://localhost:8000
3. Autentícate con tu token
4. Abre "Mensajes Manuales"
5. Prueba:
   - Ver usuarios
   - Buscar usuarios
   - Enviar un mensaje de texto
   - Crear un archivo predefinido
   - Enviar un archivo predefinido
   - Envía un mensaje desde Telegram y verás que aparece en el panel

## 🚀 Próximas Mejoras (Opcional)

- [ ] Soporte para mensajes de foto/video enviados desde Telegram
- [ ] Notificaciones en tiempo real con WebSockets
- [ ] Descarga de historial completo en CSV/PDF
- [ ] Encriptación de mensajes
- [ ] Plantillas de respuesta rápida
- [ ] Asignación de usuarios a admin
- [ ] Rate limiting de mensajes
- [ ] Análisis de sentimiento de mensajes

---

**Versión**: 1.0  
**Fecha**: 2026-06-25  
**Estado**: ✅ Completado
