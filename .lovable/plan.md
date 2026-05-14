# Sistema de inscripciones a torneos por WhatsApp (Twilio)

Estado: PENDIENTE — pausado a la espera de conectar Twilio.

## Stack elegido
- Gateway: Twilio WhatsApp via connector de Lovable Cloud (`https://connector-gateway.lovable.dev/twilio/Messages.json`)
- Para pruebas: Sandbox de Twilio WhatsApp (gratis)
- Producción: número WhatsApp Business + plantillas pre-aprobadas por Meta

## Roadmap acordado (ejecutar cuando se retome)

### Paso 1 — Conectar Twilio
- Lanzar `standard_connectors--connect` con `connector_id: twilio`
- Requisitos previos del usuario: cuenta Twilio + API Key + número WhatsApp (sandbox o productivo)

### Paso 2 — Migración de BBDD
Tablas nuevas:
- **player_contacts**: `player_id` (FK players), `phone_e164`, `whatsapp_opt_in` (bool), `verified_at` (timestamp)
- **registrations**: `round_id`, `player_id`, `status` enum (`invited`/`confirmed`/`declined`/`waitlist`/`cancelled`), `invited_at`, `responded_at`, `notes`
- **whatsapp_messages**: log entrada/salida (auditoría) — `direction`, `from`, `to`, `body`, `twilio_sid`, `created_at`

Campos nuevos en **rounds**:
- `max_players` (int, nullable)
- `registration_deadline` (timestamp, nullable)

RLS:
- Admin gestiona todo (has_role admin)
- Lectura pública: registrations puede ser pública para mostrar inscritos en /jornades, o restringida (a decidir)
- player_contacts: solo admin

### Paso 3 — UI Admin
Nueva pestaña **"Inscripcions"** dentro de cada jornada en `/admin/rounds`:
- Lista jugadores con estado (pendiente/confirmado/rechazado/lista espera)
- Capacidad visible (X/Y inscritos)
- Botón "Enviar invitaciones" (Paso 4)
- Botón "Enviar recordatorio" (futuro)
- Inscripción/cambio de estado manual por admin
- Gestión de teléfonos y opt-in en ficha jugador (`/admin/players`)

### Paso 4 — Edge function `send-tournament-invitations`
- Input: `round_id`
- Selecciona jugadores con `whatsapp_opt_in=true` y sin registro previo para esa jornada
- Crea fila en `registrations` con status `invited`
- Envía template WhatsApp via Twilio gateway
- Logs en `whatsapp_messages`
- Lanzable manualmente desde admin (cron en futura iteración)

### Paso 5 — Edge function `whatsapp-webhook`
- Endpoint público (verify_jwt=false), valida firma Twilio
- Recibe respuestas entrantes
- Identifica jugador por `From` (E.164) → `player_contacts`
- Parser básico de intención:
  - SI / SÍ / OK / CONFIRMO / VOY → `confirmed`
  - NO / NO PUC / CANCELO → `declined`
  - ESPERA / WAITLIST → `waitlist`
  - AJUDA / HELP → menú con comandos
  - Fallback → mensaje con sugerencias + alerta admin
- Actualiza última `registration` con status `invited` del jugador
- Responde confirmación al jugador

URL a pegar en consola Twilio (Messaging → Sandbox / número productivo → "When a message comes in"):
`https://ehyjwpoexafoxjepoyob.supabase.co/functions/v1/whatsapp-webhook`

## Roadmap futuro (siguientes iteraciones)
- `send-reminders` cron (7 días y 2 días antes de deadline)
- Lista de espera con auto-promoción cuando alguien cancela
- Dashboard de tasas de respuesta / no-shows
- Plantillas pre-aprobadas Meta para producción
- Comando STOP global (GDPR)

## Bloqueante actual
Usuario rechazó la primera invocación de `standard_connectors--connect` para Twilio (le dio skip sin querer en una iteración, y en la siguiente cancelaron el flow). Al retomar, primero relanzar la conexión.

## Consideraciones
- Meta exige plantillas pre-aprobadas para mensajes salientes fuera de ventana 24h → empezar con Sandbox Twilio
- GDPR: opt-in explícito antes de enviar; comando STOP para baja
- Coste Twilio: ~0.005-0.05€/mensaje según país y tipo
- Activar SMS Pumping Protection y Geo Permissions en consola Twilio antes de producción
