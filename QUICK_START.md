# ⚡ Quick Start - Mensajería Manual

> ¡Comienza en 5 minutos!

## 1️⃣ Inicia el Servidor (1 min)

```bash
cd /Users/danielsantiago/Documents/workspace/BotTelegramRosa

# Si tienes Docker
docker-compose up --build

# O si prefieres Python directo
cd src/backend
python3 -m uvicorn app:app --reload --port 8000
```

Espera hasta ver:
```
✅ Bot polling ACTIVE - listening for /start and messages...
Application started successfully
```

## 2️⃣ Abre el Panel Admin (1 min)

1. Abre en navegador: http://localhost:8000
2. Te pide un token → ingresa el de `.env` (ADMIN_TOKEN)
3. Haz clic en "Acceder"

## 3️⃣ Navega a Mensajes Manuales (30 seg)

En el navbar superior, haz clic en:
```
[Lotes] [Mensajes Manuales] ← AQUÍ
        [Links] [Usuarios] [...]
```

## 4️⃣ Selecciona un Usuario (30 seg)

- A la izquierda ves la lista de usuarios
- Haz clic en uno (ej: "Rosa")
- A la derecha se carga el historial

## 5️⃣ Envía tu Primer Mensaje (1 min)

```
1. Escribe: "¡Hola Rosa! 👋"
2. Haz clic en [Enviar]
3. Verás ✓ cuando se envíe
4. Rosa recibe en Telegram
```

## 🎯 Prueba las Características

### Enviar Archivo Predefinido
```
1. Con usuario seleccionado, haz clic [🎵 Audio]
2. Si no hay audios, haz clic en "+ Nuevo"
3. Sube un MP3
4. Selecciona y se envía automático
```

### Recibir Mensaje de Usuario
```
1. Desde Telegram, envía un mensaje al bot
2. Vuelve al panel
3. Verá el mensaje en azul con etiqueta "user"
4. Responde desde el panel
```

### Buscar Usuario
```
1. En el input [Buscar usuario...]
2. Escribe nombre, username o telegram_id
3. Filtra en tiempo real
```

## 📊 Elementos de la UI

```
┌─ USUARIO SELECCIONADO ─────┐
│ Rosa María                 │
│ @rosa_user (telegram_id)   │
├─────────────────────────────┤
│ 💬 HISTORIAL DE CHAT        │
│                             │
│ Rosa: "¿Hola?"        [✓]   │
│                             │
│ Admin: "¡Hola!"      [✓✓]   │
│                             │
├─ ENVÍA UN MENSAJE ─────────┤
│ [Escribe aquí...]          │
│                             │
│ [Archivo] [🎵] [🖼️]         │
│ [🎬]     [🔗]   [Enviar ✓]  │
└─────────────────────────────┘
```

Leyenda:
- ✓ = Enviado
- ✓✓ = Entregado en Telegram
- ✗ = Falló

## 🎵 Crear Primer Asset Predefinido

Así puedes reutilizar archivos:

```
1. Con usuario seleccionado, haz clic [🎵 Audio]
2. En el modal, haz clic "+ Nuevo"
3. Llena:
   - Nombre: "Bienvenida"
   - Categoría: "greetings"
   - Descripción: (opcional)
   - Archivo: Sube un MP3
4. Haz clic "Crear"
5. Próxima vez, solo selecciona sin subir
```

## 🔧 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| "Bot not initialized" | Verifica TELEGRAM_BOT_TOKEN en .env |
| "User not found" | El usuario debe existir (haber escrito /start) |
| Los archivos no aparecen | Recarga la página (F5) |
| El chat está vacío | Es normal si es usuario nuevo |
| "Invalid token" | Copia bien el ADMIN_TOKEN de .env |

## ✅ Verificación

Para confirmar que todo funciona:

```bash
# Terminal 1: Inicia servidor
cd src/backend && python3 -m uvicorn app:app --reload

# Terminal 2: Test de health
curl http://localhost:8000/health

# Terminal 3: Test de usuarios
curl -H "X-API-Token: tu_token_aqui" \
  http://localhost:8000/api/admin/users
```

Deberías recibir JSON con usuarios.

## 📚 Documentación Completa

Para más detalles, lee:
- `IMPLEMENTATION_SUMMARY.md` - Resumen de todo
- `MANUAL_MESSAGING_FEATURE.md` - Guía completa
- `TESTING_SETUP.md` - Tests y debugging

## 🎉 ¡Listo!

Ya tienes:
✅ Chat con usuarios  
✅ Archivos predefinidos  
✅ Estado de entrega  
✅ Respuestas de usuarios  

**Próximo paso**: Crea tus propios archivos predefinidos para usar recurrentemente.

---

**Duración**: 5 minutos ⏱️  
**Dificultad**: Muy fácil 😊  
**Status**: Ready to Go! 🚀
