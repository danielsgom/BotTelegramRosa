# Arquitectura Técnica - BotTelegramRosa

## Visión General

BotTelegramRosa es un sistema completo de mensajería automática para Telegram que integra:

- **Bot de Telegram** para comunicación con usuarios
- **API REST** para gestión de mensajes y configuración
- **Panel Web** intuitivo para control
- **Integración Stripe** para procesamiento de pagos
- **Detección automática de idioma** para mensajes personalizados
- **Sistema de scheduling** para envíos programados

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                     USUARIOS EN TELEGRAM                         │
│  /start → Bot (idioma detectado) → Mensajes cada X horas        │
│  Click en pago → Stripe → Webhook → VIP Link                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────┐
        │    BOT TELEGRAM (python-      │
        │    telegram-bot)              │
        │                               │
        │  - Detecta idioma            │
        │  - Envía mensajes            │
        │  - Registra usuarios         │
        └────────┬────────────────────┬─┘
                 │                    │
    ┌────────────▼──────────────┐     │
    │   SCHEDULER                │     │
    │ (APScheduler)              │     │
    │                            │     │
    │ - Envía cada X horas      │     │
    │ - Gestiona trabajos       │     │
    └────────────────────────────┘     │
                 │                     │
        ┌────────▼──────────────┐      │
        │   API REST (FastAPI)  │◄─────┘
        │                       │
        │  POST /api/messages   │
        │  GET  /api/users      │
        │  POST /webhook/stripe │
        └────────┬──────────────┘
                 │
    ┌────────────┼──────────────┐
    │            │              │
    ▼            ▼              ▼
┌────────┐ ┌─────────┐ ┌──────────────┐
│Database│ │ Stripe  │ │ Panel Web    │
│(SQLite)│ │  API    │ │ (Frontend)   │
└────────┘ └─────────┘ └──────────────┘
```

## Componentes Principales

### 1. Bot de Telegram (`bot.py`)

**Responsabilidad:** Comunicación con usuarios

```
bot.py
├── TelegramBot class
│   ├── start_command()      # Maneja /start
│   ├── help_command()       # Maneja /help
│   ├── status_command()     # Maneja /status
│   ├── send_message_to_user() # Envía mensaje individual
│   └── send_bulk_messages()   # Envía a todos los usuarios
└── Handlers
    ├── CommandHandler        # Comandos /
    ├── MessageHandler        # Mensajes normales
    └── CallbackQueryHandler  # Botones inline
```

**Flujo de usuario:**
```
Usuario: /start
  ↓
Bot detecta idioma (telegram_user.language_code)
  ↓
Bot guarda usuario en BD
  ↓
Bot envía welcome message en idioma del usuario
  ↓
Scheduler envía mensaje cada X horas
  ↓
Usuario hace click en botón de pago
  ↓
Se abre link de Stripe
```

### 2. Scheduler (`scheduler.py`)

**Responsabilidad:** Programación automática de envíos

```
scheduler.py
├── MessageScheduler class
│   ├── start()              # Inicia APScheduler
│   ├── schedule_message()   # Programa un mensaje
│   ├── reschedule_all()     # Recarga BD y reprograma
│   ├── pause_message()      # Pausa envíos
│   ├── resume_message()     # Reanuda envíos
│   └── _send_message_task() # Task que se ejecuta
└── APScheduler
    └── Ejecuta tareas cada X horas
```

**Ventajas:**
- No requiere cron externo
- Persiste en memoria
- Fácil de pausar/reanudar
- Se integra con la aplicación

### 3. API REST (`app.py`)

**Responsabilidad:** Endpoints para control y webhooks

**Estructura:**

```
/health              → GET  - Verificar estado
/api/messages        → GET  - Listar mensajes
                     → POST - Crear mensaje
/api/messages/{id}   → GET  - Obtener detalle
                     → PUT  - Editar
                     → DELETE - Eliminar
/api/messages/{id}/send → POST - Enviar ahora
/api/users           → GET  - Listar usuarios
/api/users/{id}      → GET  - Obtener usuario
                     → DELETE - Desactivar
/api/scheduler/jobs  → GET  - Ver trabajos programados
/api/scheduler/pause/{id} → POST - Pausar
/api/scheduler/resume/{id} → POST - Reanudar
/webhook/stripe      → POST - Webhooks de Stripe
```

### 4. Base de Datos (`database.py`)

**Modelos:**

```
User
├── telegram_id       (único, indexado)
├── first_name
├── username
├── language          (2 caracteres: es, en, fr...)
├── is_active
├── is_vip
├── vip_expires_at
├── joined_at
└── last_message_at

Message
├── title
├── text
├── image_url
├── stripe_links      (JSON: {"url": "https://..."})
├── hours_interval
├── is_active
├── created_at
├── updated_at
├── last_sent_at
└── next_send_at

MessageSent
├── message_id (FK)
├── user_id (FK)
├── telegram_message_id
├── sent_at
├── status           (sent, failed, read)
└── error_message

Payment
├── stripe_payment_id (único, indexado)
├── user_id (FK)
├── message_id (FK)
├── amount
├── currency
├── status           (pending, completed, failed, refunded)
├── vip_link
├── vip_link_sent
├── created_at
└── webhook_data     (JSON del webhook)

AuditLog
├── action
├── admin_id
├── resource_type
├── resource_id
├── details
└── created_at
```

**Relaciones:**
```
User ──────┬──→ MessageSent ──→ Message
           │
           └──→ Payment
```

### 5. Detección de Idioma (`language.py`)

**Estrategia de detección (en orden de prioridad):**

1. **Telegram language_code** (más confiable)
   - Telegram proporciona `user.language_code`
   - Ej: `es`, `en`, `fr_FR`

2. **Análisis de texto** (fallback)
   - Usa `langdetect` para detectar lenguaje del mensaje
   - Solo si Telegram no lo proporciona

3. **Default** (último recurso)
   - Español (es) por defecto

**Plantillas multiidioma:**
```python
MESSAGE_TEMPLATES = {
    "es": {"start": "¡Bienvenido!...", ...},
    "en": {"start": "Welcome!...", ...},
    "fr": {"start": "Bienvenue!...", ...},
    ...
}
```

### 6. Manejo de Stripe (`stripe_handler.py`)

**Flujo de pago:**

```
1. Usuario hace click en link de pago
   ↓
2. Se abre página de Stripe
   ↓
3. Usuario completa el pago
   ↓
4. Stripe envía webhook a /webhook/stripe
   ↓
5. Verificamos firma del webhook (validación)
   ↓
6. Marcamos pago como "completed"
   ↓
7. Generamos link VIP
   ↓
8. Enviamos link al usuario vía Telegram
   ↓
9. Marcamos usuario como VIP
```

**Seguridad:**
- Verificación de firma del webhook
- Validación de tokens API
- Almacenamiento seguro de datos sensibles

### 7. Panel Web (`frontend/`)

**Stack:**
- HTML5
- CSS3 (Bootstrap 5)
- JavaScript (Fetch API)

**Características:**
- Responsive design
- Gestión de mensajes en tiempo real
- Upload de imágenes
- Formularios validados
- Almacenamiento local de token

**Secciones:**
```
Panel Web
├── Mensajes
│   ├── Crear/Editar/Eliminar
│   ├── Preview
│   └── Enviar ahora
├── Usuarios
│   ├── Listar
│   └── Ver detalles
├── Scheduling
│   ├── Ver trabajos
│   ├── Pausar/Reanudar
│   └── Cambiar intervalo
└── Configuración
    ├── Token API
    ├── Intervalo de mensajes
    ├── Link de canal VIP
    └── Idioma por defecto
```

## Flujos Principales

### Flujo 1: Nuevo Usuario

```
Usuario abre Telegram
  ↓
Busca el bot y le da /start
  ↓
TelegramBot.start_command()
  ├─ Detecta idioma
  ├─ Crea registro en User
  ├─ Envía mensaje bienvenida
  └─ Registra en logs

Usuario ahora recibe mensajes cada X horas
```

### Flujo 2: Envío de Mensaje Programado

```
APScheduler tick (cada X horas)
  ↓
scheduler._send_message_task()
  ├─ Obtiene Message activo
  ├─ Obtiene todos los User activos
  └─ Para cada usuario:
      ├─ Prepara botones de pago
      ├─ Envía mensaje con bot.send_message_to_user()
      ├─ Registra en MessageSent
      ├─ Captura errores
      └─ Registra en logs

Todos los usuarios reciben el mensaje
```

### Flujo 3: Procesamiento de Pago

```
Usuario completa pago en Stripe
  ↓
Stripe envía POST a /webhook/stripe
  ↓
StripeHandler.verify_webhook_signature()
  ├─ Valida firma
  └─ Valida autenticidad

stripe_webhook() handler
  ├─ Obtiene tipo de evento
  ├─ Si es payment_intent.succeeded:
  │   ├─ Marca Payment como "completed"
  │   ├─ Genera VIP link
  │   ├─ Envía link al usuario
  │   └─ Marca usuario como is_vip = True
  └─ Si es payment_intent.payment_failed:
      └─ Marca Payment como "failed"

Usuario recibe link VIP en Telegram
  ↓
Usuario hace click en link
  ↓
Usuario entra al canal VIP
```

## Flujos de API

### Ejemplo: Crear un mensaje

```bash
curl -X POST http://localhost:8000/api/messages \
  -H "X-API-Token: admin-token-123" \
  -H "Content-Type: multipart/form-data" \
  -F "title=Oferta Especial" \
  -F "text=¡50% descuento hoy!" \
  -F "hours_interval=2" \
  -F "is_active=true" \
  -F "stripe_links=[{\"url\": \"https://stripe.com/...\"}]" \
  -F "image=@image.jpg"
```

**Respuesta:**
```json
{
  "success": true,
  "message_id": 1,
  "title": "Oferta Especial"
}
```

### El scheduler automáticamente:
1. Detecta el nuevo mensaje activo
2. Lo programa para enviar cada 2 horas
3. Comienza a enviar a todos los usuarios

## Decisiones de Diseño

### 1. APScheduler en lugar de Cron

**Ventajas:**
- ✅ No requiere configuración del sistema
- ✅ Fácil de pausar/reanudar
- ✅ Se recarga con la app
- ✅ No se ejecuta en segundo plano

**Desventajas:**
- ❌ Se detiene si la app se reinicia
- ❌ No es persistente entre reinicios

**Solución:** Guardar `next_send_at` en BD

### 2. SQLite por defecto

**Ventajas:**
- ✅ Sin dependencias externas
- ✅ Perfecto para desarrollo
- ✅ Fácil de hacer backup

**Para producción:**
- Usar PostgreSQL (compatible, solo cambiar `DATABASE_URL`)

### 3. FastAPI en lugar de Flask/Django

**Ventajas:**
- ✅ Async/await nativo
- ✅ Validación automática
- ✅ Documentación auto (Swagger)
- ✅ Mejor rendimiento

### 4. Bootstrap para UI

**Ventajas:**
- ✅ Responsive sin esfuerzo
- ✅ Componentes listos
- ✅ Temas disponibles

## Escalabilidad

### Limitaciones actuales

- APScheduler en memoria (no persiste)
- SQLite en un archivo (no multiconexión)
- Sin caché
- Sin cola de trabajos

### Para escalar a producción

```
Nivel 1: Actualizar BD
├─ Usar PostgreSQL
└─ Múltiples instancias de la app

Nivel 2: Async mejorado
├─ Celery + Redis para tareas
└─ RabbitMQ para cola

Nivel 3: Microservicios
├─ Bot en servicio separado
├─ API en servicio separado
├─ Scheduler en servicio separado
└─ Balanceador de carga

Nivel 4: Cloud
├─ Kubernetes
├─ CloudSQL/RDS
├─ Redis Cache
└─ CDN para imágenes
```

## Seguridad

### Implementado

- ✅ Validación de firma de webhooks Stripe
- ✅ Token API en headers
- ✅ Variables de entorno para secretos
- ✅ CORS configurables

### Recomendaciones para producción

- 🔐 HTTPS obligatorio
- 🔐 Rate limiting en API
- 🔐 Validación de entrada
- 🔐 CORS restrictivo
- 🔐 Monitoreo de logs
- 🔐 Auditoría de cambios

## Monitoreo

### Logs

```python
logger.info(f"Message {message_id} sent to {stats['sent']} users")
logger.error(f"Error sending message: {e}")
logger.warning(f"User {user_id} not found")
```

### Métricas a monitorear

- Mensajes enviados/fallidos
- Usuarios activos/VIP
- Pagos completados/fallidos
- Errores de API
- Tiempo de respuesta

### Para producción

- Usar ELK Stack (Elasticsearch, Logstash, Kibana)
- Usar Prometheus + Grafana
- Alertas en Slack/Discord

---

**Documentación completa de arquitectura.**
