# Sistema de Lotes de Mensajes (Message Batches)

## 📋 Descripción General

El sistema ha sido rediseñado para usar **lotes ordenados de mensajes**. En lugar de enviar cada mensaje de forma independiente, ahora:

- ✅ Los mensajes se organizan en **lotes** (grupos)
- ✅ Cada lote tiene un **orden** (1, 2, 3...)
- ✅ Solo **un lote está activo** a la vez
- ✅ Cada **2 horas** se envía el siguiente mensaje del lote activo a todos los usuarios
- ✅ Cuando se agota un lote, **rota al siguiente**
- ✅ Cuando llega al final, **vuelve al primer lote**
- ✅ **Cada mensaje se envía una sola vez** a cada usuario (no se repite)

## 🔄 Flujo de Envío

```
Hora 0:00   → Envía Mensaje 1 del Lote 1 a todos los usuarios
Hora 2:00   → Envía Mensaje 2 del Lote 1 a todos los usuarios
Hora 4:00   → Envía Mensaje 3 del Lote 1 a todos los usuarios
Hora 6:00   → Lote 1 agotado → Rota al Lote 2
           → Envía Mensaje 1 del Lote 2 a todos los usuarios
Hora 8:00   → Envía Mensaje 2 del Lote 2 a todos los usuarios
...
→ Cuando se agota Lote 2, vuelve al Lote 1 (ciclo continuo)
```

## 📊 Estructura de Datos

### MessageBatch (Lote)
```
id: 1
name: "Lote Febrero 2026"
description: "Primer conjunto de mensajes del mes"
order: 1              # Orden en la rotación (1, 2, 3...)
is_active: true       # Solo un lote puede ser activo
messages: [...]       # Array de mensajes en este lote
created_at: 2026-02-01
```

### Message (Mensaje dentro de un Lote)
```
id: 5
batch_id: 1          # Pertenece a este lote
title: "Oferta Especial ⚡"
text: "¡50% descuento hoy!"
image_url: "/uploads/image.jpg"
sequence_order: 1    # Orden dentro del lote (1, 2, 3...)
stripe_links: {...}  # Links de pago (SIEMPRE IGUALES - se envían con cada mensaje)
```

### BatchScheduleState (Estado del Scheduler)
```
id: 1
current_batch_id: 1              # Qué lote está activo
current_message_index: 2         # Próximo mensaje a enviar (0-indexed)
last_sent_at: 2026-02-03 10:00
next_send_at: 2026-02-03 12:00
```

## 🎯 Ejemplo Práctico

**Tu configuración:**
- Lote 1: "Bienvenida" (3 mensajes)
  - Mensaje 1: "¡Bienvenido!"
  - Mensaje 2: "Conoce nuestros productos"
  - Mensaje 3: "Consigue acceso VIP"
  
- Lote 2: "Promociones" (2 mensajes)
  - Mensaje 1: "Oferta Flash"
  - Mensaje 2: "Última oportunidad"

**Secuencia de envíos:**
```
Día 1, 10:00 → Lote 1, Msg 1: "¡Bienvenido!" a todos
Día 1, 12:00 → Lote 1, Msg 2: "Conoce nuestros productos" a todos
Día 1, 14:00 → Lote 1, Msg 3: "Consigue acceso VIP" a todos
Día 1, 16:00 → Lote 2, Msg 1: "Oferta Flash" a todos (rotó al Lote 2)
Día 1, 18:00 → Lote 2, Msg 2: "Última oportunidad" a todos
Día 1, 20:00 → Lote 1, Msg 1: "¡Bienvenido!" a todos (volvió al Lote 1)
...continúa rotando...
```

## 🔧 API Endpoints

### Gestión de Lotes

#### Crear Lote
```bash
POST /api/batches
Body:
{
  "name": "Mi Lote 1",
  "description": "Descripción opcional",
  "order": 1
}
```

#### Obtener Todos los Lotes
```bash
GET /api/batches
Response:
{
  "success": true,
  "batches": [
    {
      "id": 1,
      "name": "Mi Lote 1",
      "order": 1,
      "is_active": true,
      "message_count": 3,
      "messages": [...]
    }
  ]
}
```

#### Obtener un Lote Específico
```bash
GET /api/batches/{batch_id}
```

#### Actualizar Lote
```bash
PUT /api/batches/{batch_id}
Body:
{
  "name": "Nuevo Nombre",
  "order": 2
}
```

#### Eliminar Lote
```bash
DELETE /api/batches/{batch_id}
# También elimina todos sus mensajes
```

#### Activar Lote
```bash
POST /api/batches/{batch_id}/activate
# Desactiva todos los demás lotes
# Inicializa el scheduler para empezar con el primer mensaje
```

### Gestión de Mensajes en Lotes

#### Agregar Mensaje a Lote
```bash
POST /api/batches/{batch_id}/messages
Body:
{
  "title": "Título del Mensaje",
  "text": "Contenido del mensaje",
  "sequence_order": 1,
  "stripe_links": "[{\"label\": \"Plan Premium\", \"url\": \"https://stripe.com/...\"}, ...]",
  "image": <archivo>  # opcional
}
```

#### Actualizar Mensaje en Lote
```bash
PUT /api/batches/{batch_id}/messages/{message_id}
Body:
{
  "title": "Nuevo Título",
  "sequence_order": 2,
  "stripe_links": "..."
}
```

#### Eliminar Mensaje de Lote
```bash
DELETE /api/batches/{batch_id}/messages/{message_id}
```

### Consultar Estado del Scheduler

#### Obtener Estado Actual
```bash
GET /api/batches/schedule/state
Response:
{
  "success": true,
  "state": {
    "current_batch": {
      "id": 1,
      "name": "Mi Lote 1",
      "total_messages": 3
    },
    "current_message_index": 1,  # Próximo a enviar (0-indexed)
    "current_message": {
      "id": 5,
      "title": "Conoce nuestros productos"
    },
    "last_sent_at": "2026-02-03T10:00:00",
    "next_send_at": "2026-02-03T12:00:00"
  }
}
```

## ⚙️ Cómo Usar

### Paso 1: Crear tu Primer Lote
1. Ve al Panel → "Lotes"
2. Click "Crear Lote"
3. Nombre: "Mi Lote 1"
4. Order: 1
5. Guardar

### Paso 2: Agregar Mensajes al Lote
1. Dentro del Lote, click "Agregar Mensaje"
2. Título: "Mensaje 1"
3. Texto: Tu contenido
4. Stripe Links: Tus opciones de pago
5. Sequence Order: 1 (primero)
6. Guardar

### Paso 3: Activar el Lote
1. Selecciona el Lote en la lista
2. Click "Activar Lote"
3. El scheduler comenzará a enviar cada 2 horas

### Paso 4: Crear Segundo Lote (Opcional)
1. Crear Lote con Order: 2
2. Agregar mensajes
3. Cuando termina el Lote 1, automáticamente rota al Lote 2

## 📌 Importante

### Links de Pago (Stripe Links)
- ✅ Los links son **SIEMPRE LOS MISMOS**
- ✅ Se envían **con cada mensaje** del lote
- ✅ No cambian entre rotaciones
- ✅ Ejemplo: ["Plan Basic: $10/mes", "Plan Premium: $30/mes"]

### Unicidad de Mensajes
- ✅ Cada mensaje se envía **una sola vez** a cada usuario en cada ciclo
- ✅ Si hay 3 mensajes en Lote 1, el usuario recibe 3 mensajes antes de rotar
- ✅ Las MessageSent records garantizan el rastreo

### Rotación Automática
- ✅ NO NECESITAS hacer nada manualmente
- ✅ El scheduler rota automáticamente cada 2 horas
- ✅ Cuando termina un lote, pasa al siguiente automáticamente

## 🚀 Ejemplo de Configuración Completa

```sql
-- Crear 2 lotes
INSERT INTO message_batches (name, order, is_active) 
VALUES 
  ('Onboarding', 1, true),
  ('Promotions', 2, false);

-- Agregar 3 mensajes al Lote 1
INSERT INTO messages (batch_id, title, text, sequence_order, stripe_links)
VALUES 
  (1, 'Bienvenido', '¡Hola!', 1, '[{"url": "..."}]'),
  (1, 'Productos', 'Nuestros productos', 2, '[{"url": "..."}]'),
  (1, 'VIP', 'Acceso VIP', 3, '[{"url": "..."}]');

-- Agregar 2 mensajes al Lote 2
INSERT INTO messages (batch_id, title, text, sequence_order, stripe_links)
VALUES 
  (2, 'Oferta', '50% desc', 1, '[{"url": "..."}]'),
  (2, 'Última', 'Termina hoy', 2, '[{"url": "..."}]');

-- Inicializar estado
INSERT INTO batch_schedule_state (current_batch_id, current_message_index)
VALUES (1, 0);
```

**Resultado:** Cada 2 horas, alterna entre estos 5 mensajes en orden.

## 📊 Ventajas

| Aspecto | Anterior | Nuevo (Batches) |
|---------|----------|-----------------|
| Control | Manual, cada mensaje independiente | Automático, orden definido |
| Repeticiones | Podían repetirse | Cada mensaje una sola vez |
| Escalabilidad | Complejo con muchos mensajes | Fácil, agrupa en lotes |
| Links de Pago | Podían cambiar | Siempre iguales |
| Rotación | Manual | Automática |
| Complejidad | Media | Alta (pero mejor UX) |

## 🔗 Relacionado

- [API.md](API.md) - Documentación REST completa
- [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitectura del sistema
- [QUICKSTART.md](QUICKSTART.md) - Inicio rápido
