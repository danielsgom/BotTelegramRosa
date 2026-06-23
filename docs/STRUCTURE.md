```
BotTelegramRosa/
│
├── 📄 README.md                    # Documentación principal
├── 📄 QUICKSTART.md               # Inicio rápido (5 minutos)
├── 📄 requirements.txt            # Dependencias Python
├── 📄 .env.example                # Variables de entorno (template)
├── 📄 .gitignore                  # Git ignore rules
│
├── 🐳 Dockerfile                  # Para deployment con Docker
├── 🐳 docker-compose.yml          # Orquestación Docker
│
├── 📁 src/
│   ├── 🐍 backend/               # Backend Python/FastAPI
│   │   ├── __init__.py           # Package init
│   │   ├── app.py                # 🎯 Main FastAPI app (COMIENZA AQUÍ)
│   │   ├── config.py             # Configuración desde .env
│   │   ├── database.py           # Modelos SQLAlchemy & ORM
│   │   ├── bot.py                # Bot de Telegram (python-telegram-bot)
│   │   ├── scheduler.py          # APScheduler para envíos programados
│   │   ├── language.py           # Detección de idioma & plantillas
│   │   ├── stripe_handler.py     # Integración Stripe & webhooks
│   │   │
│   │   └── 📁 routes/            # Endpoints de API (posible)
│   │       └── messages.py       # (En futura refactorización)
│   │
│   └── 🌐 frontend/              # Panel Web
│       ├── index.html            # 🎯 Panel principal (acceso en / )
│       ├── 📁 static/
│       │   ├── 📁 css/
│       │   │   └── style.css     # Estilos Bootstrap + custom
│       │   │
│       │   └── 📁 js/
│       │       └── app.js        # JavaScript del panel (Fetch API)
│       │
│       └── 📁 templates/         # (Para futuro Jinja2)
│
├── 📁 docs/                      # Documentación completa
│   ├── SETUP.md                  # Guía de instalación
│   ├── ARCHITECTURE.md           # Arquitectura técnica
│   ├── API.md                    # Documentación de endpoints
│   ├── TROUBLESHOOTING.md        # FAQ & solución de problemas
│   └── STRUCTURE.md              # Este archivo
│
├── 📁 uploads/                   # Imágenes subidas (creado en runtime)
│   ├── 1234567890_imagen.jpg
│   ├── 1234567891_foto.png
│   └── ...
│
└── 📁 .vscode/                   # Configuración VS Code
    ├── settings.json
    └── launch.json
```

## 📋 Guía Rápida de Archivos Importantes

### 🎯 Por dónde empezar

1. **Primera vez:** Comienza en `QUICKSTART.md`
2. **Instalación:** Lee `docs/SETUP.md`
3. **Ejecución:** Corre `src/backend/app.py`
4. **Panel:** Accede a `http://localhost:8000`

### 🔧 Archivos de Configuración

| Archivo | Propósito |
|---------|-----------|
| `.env.example` | Template de variables de entorno |
| `.env` | Tu configuración (¡NO commits!) |
| `requirements.txt` | Dependencias Python |
| `Dockerfile` | Docker image definition |
| `docker-compose.yml` | Servicios Docker (bot, postgres, redis) |

### 🐍 Backend - Orden de Lectura

```
1. config.py         → Entiende la configuración
2. database.py       → Comprende los modelos (User, Message, etc.)
3. language.py       → Cómo se detecta idioma
4. bot.py            → Lógica del bot de Telegram
5. stripe_handler.py → Manejo de pagos
6. scheduler.py      → Cómo funciona el scheduling
7. app.py            → API REST (endpoints)
```

### 🌐 Frontend

| Archivo | Propósito |
|---------|-----------|
| `index.html` | Estructura HTML del panel |
| `css/style.css` | Estilos Bootstrap + custom |
| `js/app.js` | Lógica del panel (llamadas a API) |

### 📚 Documentación - Orden Sugerido

```
1. README.md          → Visión general
2. QUICKSTART.md      → Inicio rápido (5 min)
3. docs/SETUP.md      → Instalación completa
4. docs/ARCHITECTURE.md → Entiende cómo funciona
5. docs/API.md        → Endpoints disponibles
6. docs/TROUBLESHOOTING.md → Problemas y soluciones
```

## 🔄 Flujos de Datos Principales

### Flujo 1: Nuevo Usuario
```
Telegram /start
    ↓
bot.py → start_command()
    ↓
database.py → User.create()
    ↓
language.py → detect_language()
    ↓
Respuesta en idioma del usuario
```

### Flujo 2: Mensaje Programado
```
APScheduler (cada X horas)
    ↓
scheduler.py → _send_message_task()
    ↓
app.py → /api/messages/{id}/send
    ↓
bot.py → send_bulk_messages()
    ↓
Telegram API → Envía a todos los usuarios
```

### Flujo 3: Pago Completado
```
Stripe Payment Success
    ↓
app.py → POST /webhook/stripe
    ↓
stripe_handler.py → verify_webhook()
    ↓
stripe_handler.py → generate_vip_link()
    ↓
bot.py → send_message_to_user()
    ↓
Usuario recibe link VIP
```

## 📊 Base de Datos

```
database.py contiene:
├── User          → Usuarios de Telegram
├── Message       → Plantillas de mensajes
├── MessageSent   → Registro de envíos
├── Payment       → Pagos de Stripe
└── AuditLog      → Acciones administrativas
```

## 🚀 Proceso de Desarrollo

### Desarrollo Local

```bash
# 1. Instala dependencias
pip install -r requirements.txt

# 2. Configura .env
cp .env.example .env
# Edita con tus credenciales

# 3. Ejecuta
cd src/backend
python app.py

# 4. Accede panel
http://localhost:8000
```

### Testing

```bash
# Verifica que todo funciona
curl http://localhost:8000/health

# En Telegram: /start
# En navegador: http://localhost:8000
```

### Deployment

```bash
# Con Docker
docker-compose up -d

# Con Heroku
git push heroku main

# Con VPS
# Ver docs/SETUP.md → "Deployment en Producción"
```

## 📝 Convenciones de Código

### Naming

```python
# Clases: PascalCase
class TelegramBot:
    pass

# Funciones: snake_case
def send_message_to_user():
    pass

# Constantes: UPPERCASE
ADMIN_TOKEN = "..."

# Variables privadas: _leading_underscore
_internal_variable = 123
```

### Comentarios

```python
# Las funciones principales tienen docstrings
def send_bulk_messages(message_id: int) -> dict:
    """
    Send message to all active users
    
    Args:
        message_id: Message template ID
        
    Returns:
        Dictionary with statistics
    """
    pass
```

### Logging

```python
import logging

logger = logging.getLogger(__name__)

# Tres niveles principales
logger.info(f"Message {id} sent")
logger.warning(f"Retrying user {uid}")
logger.error(f"Failed to send: {e}")
```

## 🔒 Seguridad

### Secretos (¡NO commits!)

```bash
# ❌ NUNCA commits
TELEGRAM_BOT_TOKEN=abc123xyz
STRIPE_API_KEY=sk_live_...

# ✅ SIEMPRE usa .env
# Agregado a .gitignore
```

### Validación

```python
# Siempre valida entrada
if not token or len(token) < 10:
    raise ValueError("Invalid token")

# Verifica tipos
assert isinstance(user_id, int)

# Usa Pydantic
from pydantic import BaseModel
class MessageCreate(BaseModel):
    title: str
    text: str
    hours_interval: int
```

## 📦 Estructura de Dependencias

```
requirements.txt
├── FastAPI (API web)
├── python-telegram-bot (Bot)
├── SQLAlchemy (ORM)
├── APScheduler (Scheduling)
├── stripe (Pagos)
├── langdetect (Idioma)
└── python-dotenv (Configuración)
```

## 🧪 Testing (Futuro)

```
tests/
├── test_bot.py
├── test_scheduler.py
├── test_stripe.py
├── test_api.py
└── test_language.py
```

## 📱 API Endpoints Quick Reference

```
GET /health                      → Estado del servidor
GET /api/messages                → Listar mensajes
POST /api/messages               → Crear mensaje
GET /api/messages/{id}           → Obtener detalle
PUT /api/messages/{id}           → Editar
DELETE /api/messages/{id}        → Eliminar
POST /api/messages/{id}/send     → Enviar ahora
GET /api/users                   → Listar usuarios
DELETE /api/users/{id}           → Desactivar usuario
GET /api/scheduler/jobs          → Ver trabajos
POST /api/scheduler/pause/{id}   → Pausar
POST /api/scheduler/resume/{id}  → Reanudar
POST /webhook/stripe             → Webhook Stripe
```

---

**Última actualización:** 2024-01-15
