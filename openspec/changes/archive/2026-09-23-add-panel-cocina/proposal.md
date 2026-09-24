# Proposal

## Why

Los pedidos confirmados ya llegan al sistema con estado `recibido`, pero cocina y barra no tienen una vista operativa para verlos ni avanzar su preparación. Este cambio habilita una cola compartida, visible en una tablet y actualizada al instante, para atender cada pedido sin recargar la página ni perder su historial del día.

## What Changes

- Añadir un panel de cocina protegido por la misma sesión con contraseña del establecimiento que utiliza la administración.
- Mostrar todos los pedidos activos, aunque hayan sido confirmados en una fecha anterior, ordenados del más antiguo al más reciente y con mesa, número, platos, cantidades, notas, horas registradas y tiempo transcurrido desde la confirmación.
- Permitir únicamente las transiciones de preparación `recibido` → `en_preparacion` → `servido`, validándolas también en el servidor, sin saltos ni retrocesos.
- Exigir confirmación antes de servir o cancelar; permitir cancelar únicamente un pedido que siga en `recibido`, sin solicitar motivo, y conservar el pedido y sus líneas.
- Registrar las horas de confirmación, inicio de preparación, servicio y cancelación que correspondan a cada pedido.
- Organizar el panel en columnas separadas para Recibidos, En preparación, Servidos y Cancelados, con un menú superior para navegar entre todos los estados operativos.
- Retirar de las columnas activas los pedidos servidos y cancelados, y mantenerlos en el histórico del día de finalización, ordenados del más reciente al más antiguo.
- Actualizar el panel mediante Server-Sent Events (SSE) cuando se confirme, avance o cancele un pedido, sin polling ni recarga manual.
- Mostrar un aviso visible mientras se pierda la conexión y emitir un aviso sonoro simple tanto al aparecer un pedido nuevo como al recuperar después de una desconexión pedidos activos que el panel no había mostrado.
- Añadir pruebas automatizadas trazables por nombre a cada escenario de la especificación.

### Decisiones de negocio (2026-09-23)

- El restaurante no trabaja después de medianoche; el día operativo coincide con la fecha calendario local del establecimiento y termina a las 00:00.
- La cola activa conserva todos los pedidos no terminados aunque cambie la fecha y los ordena por `creado_en` ascendente y, como desempate, por número de pedido ascendente.
- Bebidas y alimentos forman parte del mismo pedido y avanzan juntos; no existen estados, asignaciones ni tareas separadas para cocina y barra.
- Los únicos valores del estado de preparación son `recibido`, `en_preparacion` y `servido`; el servidor rechaza cualquier salto, retroceso o repetición de transición.
- La cancelación no introduce un cuarto valor de `estado`: se registra en `cancelado_en` como una terminación separada, válida sólo mientras el estado sea `recibido` y el pedido no se haya cancelado antes.
- Un pedido cancelado deja de estar activo y se presenta en la columna Cancelados, conservando su estado de preparación `recibido`, su hora de cancelación y todas sus líneas; no se solicita ni almacena un motivo.
- Servir y cancelar son acciones irreversibles y requieren una confirmación explícita previa; iniciar la preparación no requiere confirmación adicional.
- Cada pedido conserva `creado_en` como hora de recepción y registra `en_preparacion_en`, `servido_en` o `cancelado_en` al producirse cada hito aplicable.
- Marcar un pedido como `servido` lo archiva únicamente de la vista activa; no borra ni mueve sus datos fuera de la base y permanece en el histórico del día.
- El histórico del día incluye los pedidos servidos o cancelados durante esa fecha local, aunque se hubieran recibido en una fecha anterior, y los ordena del más reciente al más antiguo por su hora de finalización; los pedidos aún activos permanecen sólo en las columnas activas.
- La misma cookie de sesión del establecimiento autoriza tanto la administración como el panel y permanece válida hasta la medianoche local para cubrir la jornada completa; no se crean usuarios, roles, turnos ni perfiles de empleados.
- El tiempo transcurrido se calcula desde la confirmación del pedido y se actualiza visualmente en el cliente, sin efectuar consultas periódicas al servidor.
- El panel separa visualmente Recibidos, En preparación, Servidos y Cancelados, y ofrece un menú superior para navegar entre esas columnas.
- SSE es el único mecanismo de actualización en tiempo real. El cliente obtiene una instantánea al abrir el panel, muestra un aviso mientras esté desconectado y lo retira sólo tras reconciliar una instantánea vigente, sin duplicar pedidos.
- El aviso sonoro se intenta por cada pedido nuevo recibido después de la carga inicial y también al recuperar pedidos activos que no habían sido mostrados durante una desconexión. Si el navegador bloquea audio automático, los pedidos deben seguir apareciendo de forma visual y operable.
- El panel está pensado primero para una tablet apoyada en la barra: tendrá alto contraste, texto legible y controles táctiles grandes.
- Quedan fuera de alcance las métricas y estadísticas, la impresión de tickets, la gestión de turnos o empleados y la configuración de sonidos.

## Capabilities

### New Capabilities

- `panel-cocina`: Consultar y operar en tiempo real la cola activa persistente y el histórico diario de pedidos desde cocina o barra, con acceso protegido, transiciones estrictas, cancelación temprana y avisos operativos.

### Modified Capabilities

- Ninguna.

## Impact

- Afecta el esquema y la migración de SQLite para ampliar el estado permitido y registrar inicio de preparación, servicio y cancelación sin eliminar datos existentes.
- Afecta el servicio de pedidos y Express con consultas diarias, operaciones autenticadas de transición y cancelación, y un canal SSE protegido.
- Afecta el enrutado y la interfaz React con una nueva pantalla de cocina para tablet, una cola activa, el histórico del día, tiempos transcurridos y reconexión SSE.
- Afecta las pruebas de base de datos, API y cliente; la entrega SSE requiere pruebas de publicación, autorización y reconciliación.
- Reutiliza la autenticación, Express, React y SQLite actuales; no añade dependencias de producción.
