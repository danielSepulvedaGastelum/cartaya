# panel-cocina Specification

## Purpose

Permitir que cocina y barra atiendan desde una tablet todos los pedidos activos y consulten el histórico diario de terminados, con cambios de estado seguros, cancelación temprana y actualización inmediata sin recargar la página.

## Requirements

### Requirement: Acceso protegido y uso en tablet
El sistema MUST exigir la misma sesión autenticada con la contraseña del establecimiento para consultar o modificar el panel de cocina y para conectarse a sus actualizaciones en tiempo real. Una sesión iniciada durante la jornada MUST permanecer válida hasta la medianoche local del establecimiento y MUST expirar entonces. El sistema MUST rechazar todas esas operaciones cuando no exista una sesión válida. El panel MUST presentar texto legible, contraste alto y controles táctiles de tamaño adecuado para usarse en una tablet.

#### Scenario: Sesión del establecimiento abre el panel
- **WHEN** una persona inicia sesión con la contraseña válida del establecimiento y abre el panel de cocina
- **THEN** el sistema le permite consultar y operar los pedidos con la misma sesión usada por la administración

#### Scenario: Persona sin sesión intenta consultar el panel
- **WHEN** una persona sin sesión válida solicita la cola, el histórico o el canal de actualizaciones del panel de cocina
- **THEN** el sistema rechaza el acceso y no expone datos de los pedidos

#### Scenario: Sesión cubre la jornada completa
- **WHEN** el establecimiento inicia sesión durante el día y mantiene abierto el panel
- **THEN** la misma sesión continúa válida hasta la medianoche local y expira al terminar esa jornada

#### Scenario: Panel utilizable en tablet
- **WHEN** el panel de cocina se muestra en una tablet
- **THEN** presenta la información con texto legible, contraste alto y controles táctiles de tamaño adecuado

### Requirement: Cola activa persistente
El sistema MUST mostrar en la cola activa todos los pedidos cuyo estado sea `recibido` o `en_preparacion` y que no estén cancelados, aunque se hayan confirmado en una fecha anterior. El sistema MUST ordenarlos del más antiguo al más reciente por su momento de confirmación y, cuando coincida, por su número de pedido ascendente. Para cada pedido, el sistema MUST mostrar su número, mesa, estado, tiempo transcurrido desde la confirmación, horas registradas y todas sus líneas con nombre del plato, cantidad y nota del cliente cuando exista. El tiempo transcurrido MUST continuar actualizándose visualmente sin consultar periódicamente al servidor. Bebidas y alimentos MUST permanecer dentro del mismo pedido y MUST avanzar juntos, sin estados ni tareas separados por área.

#### Scenario: Cocina consulta pedidos activos ordenados
- **WHEN** existen varios pedidos activos creados durante el día
- **THEN** el panel los muestra del más antiguo al más reciente con número, mesa, estado, platos, cantidades, notas existentes y tiempo transcurrido

#### Scenario: Pedido pendiente de otro día permanece en la cola
- **WHEN** cambia la fecha local y un pedido anterior continúa en `recibido` o `en_preparacion` sin cancelación
- **THEN** el panel mantiene ese pedido en la cola activa hasta que sea servido o cancelado

#### Scenario: Bebidas y alimentos avanzan juntos
- **WHEN** un pedido contiene líneas de bebidas y alimentos y cocina inicia o termina su preparación
- **THEN** el sistema aplica la transición al pedido completo sin crear estados ni tareas separados por área

#### Scenario: Tiempo transcurrido avanza sin polling
- **WHEN** un pedido permanece visible en la cola activa
- **THEN** su tiempo transcurrido aumenta en pantalla a partir del momento de confirmación sin realizar consultas periódicas al servidor

### Requirement: Transiciones estrictas de preparación
El sistema MUST permitir únicamente la transición de un pedido no cancelado de `recibido` a `en_preparacion` y después de `en_preparacion` a `servido`. Al iniciar la preparación, el sistema MUST registrar su momento en `en_preparacion_en`. Antes de servir, el sistema MUST solicitar una confirmación explícita y, sólo al confirmarla, MUST registrar el momento en `servido_en`. El sistema MUST validar la transición de forma atómica con el estado vigente y MUST rechazar saltos, retrocesos, repeticiones y cambios sobre pedidos cancelados sin modificar el pedido ni sus horas registradas.

#### Scenario: Cocina comienza un pedido recibido
- **WHEN** cocina avanza un pedido no cancelado de `recibido` a `en_preparacion`
- **THEN** el sistema conserva el pedido con estado `en_preparacion`, registra la hora de inicio y lo mantiene en la cola activa

#### Scenario: Cocina sirve un pedido en preparación
- **WHEN** cocina elige servir un pedido no cancelado en `en_preparacion` y confirma la acción
- **THEN** el sistema conserva el pedido con estado `servido`, registra la hora de servicio, lo retira de la cola activa y lo incluye en el histórico del día de finalización

#### Scenario: Cocina no confirma que el pedido fue servido
- **WHEN** cocina elige servir un pedido pero cancela la confirmación
- **THEN** el sistema conserva el pedido en `en_preparacion` sin registrar una hora de servicio

#### Scenario: Cocina intenta una transición inválida
- **WHEN** cocina intenta saltar de `recibido` a `servido`, retroceder, repetir el estado vigente o cambiar un pedido cancelado
- **THEN** el sistema rechaza la operación, informa que la transición no es válida y conserva el estado y la cancelación vigentes

#### Scenario: Dos pantallas avanzan el mismo pedido
- **WHEN** dos paneles intentan avanzar simultáneamente el mismo pedido desde el mismo estado de origen
- **THEN** el sistema aplica una sola transición y rechaza la operación que ya no coincide con el estado vigente

### Requirement: Cancelación sólo antes de preparar
El sistema MUST permitir cancelar un pedido únicamente mientras conserve el estado `recibido` y no tenga una cancelación previa. Antes de cancelar, el sistema MUST solicitar una confirmación explícita y MUST no solicitar ni almacenar un motivo. Al confirmar la cancelación, el sistema MUST registrar el momento en `cancelado_en`, MUST conservar el pedido y todas sus líneas sin cambiar su estado de preparación, y MUST retirarlo de la cola activa. El sistema MUST rechazar la cancelación de un pedido `en_preparacion`, `servido` o ya cancelado sin modificarlo.

#### Scenario: Cocina cancela un pedido recibido
- **WHEN** cocina elige cancelar un pedido que está en `recibido`, confirma la acción y no se había cancelado
- **THEN** el sistema registra el momento de cancelación sin motivo, conserva el pedido y sus líneas, lo retira de la cola activa y lo identifica como cancelado en el histórico del día de finalización

#### Scenario: Cocina no confirma la cancelación
- **WHEN** cocina elige cancelar un pedido pero cancela la confirmación
- **THEN** el sistema conserva el pedido activo sin registrar momento ni motivo de cancelación

#### Scenario: Cocina intenta cancelar después de iniciar la preparación
- **WHEN** cocina intenta cancelar un pedido que está en `en_preparacion` o `servido`
- **THEN** el sistema rechaza la cancelación, informa que ya no puede cancelarse y conserva el pedido sin cambios

#### Scenario: Cocina intenta cancelar otra vez
- **WHEN** cocina intenta cancelar un pedido que ya tiene un momento de cancelación registrado
- **THEN** el sistema rechaza la operación y conserva el momento de cancelación original

### Requirement: Histórico de pedidos terminados del día
El sistema MUST ofrecer un histórico del día con los pedidos servidos o cancelados durante la fecha calendario local vigente, aunque hayan sido confirmados en una fecha anterior. El histórico MUST separar Servidos y Cancelados y MUST ordenar cada grupo del más reciente al más antiguo por `servido_en` o `cancelado_en`, con el número de pedido como desempate descendente. El histórico MUST conservar y mostrar el número, la mesa, las líneas, el estado de preparación y todas las horas aplicables de recepción, inicio de preparación, servicio o cancelación. El sistema MUST no borrar pedidos ni líneas al retirarlos de la cola activa.

#### Scenario: Cocina consulta el histórico del día
- **WHEN** durante el día existen pedidos servidos y pedidos cancelados
- **THEN** el histórico muestra Servidos y Cancelados por separado, del más reciente al más antiguo, con sus datos y horas conservados

#### Scenario: Pedido anterior termina durante la jornada actual
- **WHEN** un pedido confirmado en una fecha anterior se sirve o cancela durante la fecha local vigente
- **THEN** el sistema lo incluye en el histórico de la fecha en que terminó y conserva su hora original de recepción

#### Scenario: Pedido activo no aparece en el histórico
- **WHEN** un pedido sigue en `recibido` o `en_preparacion` y no está cancelado
- **THEN** el pedido permanece en la cola activa y no aparece en el histórico

### Requirement: Navegación por columnas de estado
El panel MUST presentar columnas separadas para Recibidos, En preparación, Servidos y Cancelados, y MUST ofrecer en la parte superior un menú para navegar directamente entre ellas. Recibidos y En preparación MUST representar la cola activa; Servidos y Cancelados MUST representar el histórico del día. La clasificación Cancelados MUST derivarse de la cancelación registrada sin introducir un cuarto valor en el estado de preparación.

#### Scenario: Cocina navega entre todos los estados operativos
- **WHEN** cocina utiliza el menú superior del panel
- **THEN** puede acceder a las columnas Recibidos, En preparación, Servidos y Cancelados sin perder la posición ni los datos actualizados de los pedidos

### Requirement: Actualización en tiempo real mediante SSE
El sistema MUST actualizar el panel mediante Server-Sent Events, sin polling ni recarga manual. Un pedido confirmado MUST aparecer por sí solo en la cola activa de los paneles conectados; cada transición o cancelación MUST reflejarse en ellos. Al abrir el panel, el sistema MUST entregar una instantánea vigente y después MUST reconciliar los eventos recibidos por número de pedido para evitar duplicados. Tras una interrupción, el cliente MUST mostrar un aviso visible de desconexión, MUST reconectarse y MUST mantener el aviso hasta recuperar y reconciliar una instantánea vigente sin pedidos perdidos ni estados obsoletos.

#### Scenario: Pedido confirmado aparece solo
- **WHEN** un cliente confirma un pedido válido mientras el panel de cocina está conectado
- **THEN** el pedido aparece en orden en la cola activa sin recargar la página ni efectuar polling

#### Scenario: Cambio de pedido se refleja en otros paneles
- **WHEN** un panel avanza o cancela un pedido mientras otro panel está conectado
- **THEN** el otro panel refleja el resultado sin recargar la página y sin duplicar el pedido

#### Scenario: Panel se recupera de una desconexión
- **WHEN** el canal SSE se interrumpe y posteriormente vuelve a conectarse
- **THEN** el panel mantiene visible el aviso de desconexión hasta recuperar una instantánea vigente y después muestra cada pedido una sola vez con su estado o cancelación actual

#### Scenario: Panel avisa mientras está desconectado
- **WHEN** el panel pierde su conexión SSE
- **THEN** muestra de inmediato un aviso visible de que los pedidos pueden estar desactualizados y no lo oculta sólo por iniciar un intento de reconexión

### Requirement: Aviso simple de pedido nuevo
El sistema MUST intentar emitir un aviso sonoro breve una sola vez cuando un pedido nuevo aparezca mediante SSE después de la carga inicial. Después de una desconexión, el sistema MUST intentar emitir un aviso por cada pedido activo recuperado que ese panel no hubiera mostrado antes de perder la conexión. El sistema MUST no reproducir avisos por pedidos ya conocidos, transiciones, cancelaciones ni por la instantánea inicial de una carga nueva. Si el navegador bloquea el sonido, el pedido MUST seguir apareciendo de forma visual y operable sin impedir el uso del panel.

#### Scenario: Llega un pedido después de abrir el panel
- **WHEN** un pedido nuevo aparece mediante SSE después de que terminó la carga inicial
- **THEN** el panel intenta emitir un aviso sonoro una sola vez y muestra el pedido en la cola

#### Scenario: Reconexión recupera un pedido no visto
- **WHEN** el panel recupera después de una desconexión un pedido activo que no había mostrado antes
- **THEN** intenta emitir un aviso sonoro una sola vez para ese pedido y lo muestra en su columna activa

#### Scenario: El navegador bloquea el aviso sonoro
- **WHEN** el navegador impide reproducir el aviso sonoro automático
- **THEN** el panel muestra y permite operar el pedido sin bloquearse ni exigir configurar sonidos
