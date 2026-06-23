# Software Driven Design (SDD) - BotTelegramRosa

## 🎯 Visión del Producto

Un bot de Telegram que envía mensajes automáticos cada X horas con:
- 📸 Imágenes
- 📝 Texto personalizado
- 💳 Links de pago Stripe
- 🔗 Generación automática de links VIP después del pago
- 🌐 Detección automática de idioma
- 🎛️ Panel web intuitivo para gestionar todo

## 📊 Mapa Mental SDD

```
                    ┌─────────────────────┐
                    │  BotTelegramRosa    │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
    ┌────────┐         ┌──────────────┐      ┌──────────────┐
    │  BOT   │         │    ADMIN     │      │   USUARIOS   │
    │Telegram│         │     PANEL    │      │   Telegram   │
    └────────┘         └──────────────┘      └──────────────┘
        │                      │                      │
        │              (Panel Web/REST API)           │
        │                      │                      │
        └──────────────┬───────┴───────┬──────────────┘
                       │               │
                   ┌───▼────────────────▼──┐
                   │    API REST (FastAPI)  │
                   │                        │
                   │  /api/messages         │
                   │  /api/users            │
                   │  /api/scheduler        │
                   │  /webhook/stripe       │
                   └────────────┬───────────┘
                                │
        ┌───────────────┬───────┴────────┬──────────────┐
        │               │                │              │
        ▼               ▼                ▼              ▼
    ┌────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────┐
    │DATABASE│  │ SCHEDULER   │  │   STRIPE   │  │  BOT    │
    │(Users) │  │(APScheduler)│  │(Webhooks)  │  │(python- │
    │        │  │             │  │            │  │telegram)│
    │(Messages)│ │(Every X hrs)│  │(Payments)  │  │         │
    │        │  │             │  │            │  │(Sending)│
    └────────┘  └─────────────┘  └────────────┘  └──────────┘
```

## 🔄 Ciclo de Vida SDD

### Fase 1: Descubrimiento
```
Problem:
├─ Usuarios quieren enviar mensajes masivos a Telegram
├─ Necesitan incluir imágenes, textos y links
├─ Quieren monetizar con Stripe
└─ Necesitan panel simple sin código

Solution:
├─ Bot de Telegram automático
├─ API REST para gestión
├─ Panel web intuitivo
└─ Detección de idioma automática
```

### Fase 2: Arquitectura
```
┌─────────────────────────────────────────────┐
│         ARCHITECTURE LAYERS                  │
├─────────────────────────────────────────────┤
│  PRESENTATION: Frontend Web (HTML/CSS/JS)  │
│                                             │
│  API: REST Endpoints (FastAPI)              │
│                                             │
│  BUSINESS LOGIC:                            │
│  ├─ Bot Handler                             │
│  ├─ Scheduler                               │
│  ├─ Stripe Handler                          │
│  └─ Language Detection                      │
│                                             │
│  DATA: Database (SQLAlchemy ORM)            │
│                                             │
│  EXTERNAL:                                  │
│  ├─ Telegram API                            │
│  └─ Stripe API                              │
└─────────────────────────────────────────────┘
```

### Fase 3: Diseño de Datos

```
ENTITIES:

User
├─ telegram_id (PK)
├─ language (detected)
├─ is_vip (boolean)
└─ joined_at

Message
├─ id (PK)
├─ title
├─ text
├─ image_url
├─ stripe_links (JSON)
├─ hours_interval
└─ is_active

MessageSent (Audit Trail)
├─ id (PK)
├─ message_id (FK)
├─ user_id (FK)
├─ sent_at
└─ status (sent/failed/read)

Payment
├─ stripe_payment_id (PK)
├─ user_id (FK)
├─ status (pending/completed)
└─ vip_link_sent (boolean)
```

### Fase 4: Diseño de Interfaces

```
USUARIO FINAL (Telegram):
└─ /start → Recibe bienvenida en su idioma
└─ Cada 2h → Recibe imagen + texto + botón pago
└─ Click pago → Stripe → Paga
└─ Webhook → Recibe link VIP
└─ Click link → Entra al canal

ADMINISTRADOR (Panel Web):
├─ Crear/Editar/Eliminar mensajes
├─ Subir imágenes
├─ Agregar links de pago
├─ Ver usuarios conectados
├─ Ver estadísticas
└─ Cambiar horarios
```

### Fase 5: Flujos Principales

```
FLUJO 1: Nuevo Usuario
┌─────────────────────┐
│ User /start Telegram│
└──────────┬──────────┘
           │
        ┌──▼───────────────────┐
        │ Bot detecta idioma   │
        │ (telegram_user.lang) │
        └──┬────────────────────┘
           │
        ┌──▼──────────────────┐
        │ Crea User en BD     │
        │ (is_active=true)    │
        └──┬───────────────────┘
           │
        ┌──▼──────────────────────────┐
        │ Envía mensaje bienvenida    │
        │ (en idioma detectado)       │
        └──┬───────────────────────────┘
           │
        ┌──▼───────────────────────┐
        │ Usuario listo            │
        │ Recibirá mensajes cada   │
        │ X horas automáticamente  │
        └──────────────────────────┘

FLUJO 2: Envío de Mensaje Programado
┌──────────────────────────────────┐
│ APScheduler tick (cada X horas)  │
└──────────────┬───────────────────┘
               │
        ┌──────▼──────────────────┐
        │ Obtiene Message activo  │
        └──────┬───────────────────┘
               │
        ┌──────▼──────────────────┐
        │ Obtiene Users activos   │
        └──────┬───────────────────┘
               │
        ┌──────▼─────────────────────────────┐
        │ Para cada user:                    │
        │ ├─ Prepara botones de pago        │
        │ ├─ Envía mensaje (Telegram API)   │
        │ ├─ Registra en MessageSent        │
        │ └─ Captura errores                │
        └──────┬─────────────────────────────┘
               │
        ┌──────▼──────────────────┐
        │ Mensajes enviados ✓     │
        └──────────────────────────┘

FLUJO 3: Pago y VIP
┌──────────────────────────────┐
│ Usuario completa pago Stripe │
└──────────────┬───────────────┘
               │
        ┌──────▼─────────────────────┐
        │ Stripe envía webhook       │
        │ POST /webhook/stripe       │
        └──────┬──────────────────────┘
               │
        ┌──────▼────────────────────┐
        │ Verificamos firma webhook │
        │ (validación seguridad)    │
        └──────┬───────────────────┘
               │
        ┌──────▼──────────────────────┐
        │ Marcamos Payment como done  │
        │ Generamos VIP link          │
        └──────┬───────────────────────┘
               │
        ┌──────▼───────────────────────┐
        │ Bot envía VIP link al usuario│
        │ vía Telegram                 │
        └──────┬────────────────────────┘
               │
        ┌──────▼──────────────────────┐
        │ Marcamos User como VIP      │
        │ is_vip = true               │
        └──────────────────────────────┘
```

## 📋 Requerimientos Por Capas

### Capa de Presentación (Frontend)
```
Requirements:
✓ Página principal (index.html)
✓ Panel de administración
✓ Formularios de mensaje (CRUD)
✓ Gestor de usuarios
✓ Monitor de scheduling
✓ Configuración
✓ Responsive design
✓ Almacenamiento local de token
```

### Capa de API
```
Requirements:
✓ CRUD de mensajes
✓ CRUD de usuarios
✓ Endpoints de scheduler
✓ Endpoint de webhook Stripe
✓ Autenticación con token
✓ Documentación Swagger
✓ CORS habilitado
```

### Capa de Negocio
```
Requirements:
✓ Bot de Telegram
✓ Scheduling automático
✓ Detección de idioma
✓ Integración Stripe
✓ Generación de links VIP
✓ Logging y auditoría
```

### Capa de Datos
```
Requirements:
✓ Modelo User
✓ Modelo Message
✓ Modelo MessageSent
✓ Modelo Payment
✓ Índices para performance
✓ Integridad referencial
```

## 🚀 Capacidades del Sistema

| Capacidad | Implementación |
|-----------|-----------------|
| Usuarios concurrentes | 10K (SQLite) → 1M+ (PostgreSQL) |
| Velocidad de envío | ~100 msg/s (Telegram API limit) |
| Idiomas soportados | 7+ (extensible) |
| Intervalo mínimo | 1 hora |
| Imagenes máximo | 10MB |
| Uptime objetivo | 99% |
| Timeout de webhook | 10 segundos |

## 🔒 Requisitos de Seguridad

```
✓ Autenticación API (token)
✓ Validación de webhook Stripe
✓ Variables de entorno para secretos
✓ HTTPS en producción
✓ Rate limiting (futuro)
✓ Validación de entrada
✓ Sanitización de datos
✓ Logs auditados
```

## 📈 Roadmap SDD

```
MVP (v1.0) ✅ ACTUAL
├─ Bot básico
├─ Panel web
├─ Integración Stripe
└─ Detección idioma

v1.1 (Mejoras)
├─ Estadísticas en tiempo real
├─ Templates de mensajes
├─ A/B testing
└─ Soporte multicanal

v2.0 (Escalado)
├─ Microservicios
├─ Caché distribuida
├─ Processamiento en lote
└─ Analytics avanzado

v3.0 (IA)
├─ Generación automática de mensajes
├─ Optimización de horarios
└─ Segmentación inteligente
```

## 🎯 Objetivos de Diseño

```
1. SIMPLICIDAD
   └─ Panel intuitivo sin código
   
2. AUTOMATIZACIÓN
   └─ Mensajes sin intervención manual
   
3. ESCALABILIDAD
   └─ De 10 a 1M usuarios sin cambios
   
4. CONFIABILIDAD
   └─ Mensajes se envían siempre
   
5. FLEXIBILIDAD
   └─ Fácil personalizar todo
   
6. SEGURIDAD
   └─ Datos y pagos protegidos
```

## 📊 Métricas de Éxito

```
Métricas Técnicas:
├─ Uptime: >99%
├─ Latencia API: <100ms
├─ Tasa de envío exitoso: >99%
└─ Tasa de error webhook: <0.1%

Métricas de Negocio:
├─ Usuarios activos
├─ Pagos completados
├─ Tasa de conversión
└─ Retención de usuarios
```

## 🏗️ Stack Tecnológico (Justificado)

```
Python 3.11
├─ Razón: Ecosistema fuerte, comunidad, simplemente
├─ Alternativas: Node.js, Go (más complejos)

FastAPI
├─ Razón: Moderno, rápido, async, auto-documentado
├─ Alternativas: Flask, Django (más lentos)

SQLAlchemy
├─ Razón: ORM flexible, portable (SQLite→PostgreSQL)
├─ Alternativas: Pony, peewee (menos potentes)

APScheduler
├─ Razón: Scheduling in-process, fácil de usar
├─ Alternativas: Celery, Airflow (complejos)

Bootstrap 5
├─ Razón: UI bonita, responsive, comunidad grande
├─ Alternativas: Tailwind (aprender curva)

SQLite (dev) / PostgreSQL (prod)
├─ Razón: SQLite simple, PostgreSQL robusto
├─ Alternativas: MySQL, MongoDB (overkill para esto)
```

---

**Documento SDD completo de BotTelegramRosa v1.0**

*Próxima revisión: Q2 2024*
