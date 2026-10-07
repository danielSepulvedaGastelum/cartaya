# Spec Delta

## MODIFIED Requirements

### Requirement: Validación de disponibilidad y precio durante la confirmación
El sistema MUST volver a validar que todos los platos del pedido estén activos y obtener su precio vigente inmediatamente antes de registrar la confirmación. Si algún plato ya no está activo, incluido uno agotado temporalmente o archivado, el sistema MUST retirarlo del pedido en curso, identificarlo al cliente y mostrar el resumen y total actualizados antes de permitir una nueva confirmación. Si cambia el precio de una línea, el sistema MUST aplicar el precio vigente, informar el cambio y mostrar el resumen y total actualizados antes de permitir una nueva confirmación. El sistema MUST no registrar un pedido mientras haya líneas retiradas o precios modificados pendientes de revisión. La carta MUST reflejar también esos cambios en los controles, contadores y subtotales de las tarjetas, sin volver a ofrecer los platos retirados como disponibles. Si ocurren retiros y cambios de precio en el mismo envío, el sistema MUST presentar ambos en la misma revisión. Los cambios MUST conservar la identidad, cantidad y nota de las líneas que sigan disponibles, incluidas las líneas repetidas del mismo plato. El sistema MUST requerir otra acción explícita de confirmación después de mostrar la revisión y MUST impedir confirmar si no quedan líneas.

#### Scenario: Plato archivado antes de confirmar
- **WHEN** un cliente confirma un pedido que contiene un plato que fue archivado después de añadirlo
- **THEN** el sistema retira ese plato, informa cuál dejó de estar disponible y muestra el resumen con el total actualizado sin registrar aún el pedido

#### Scenario: Todos los platos siguen activos al confirmar
- **WHEN** un cliente confirma un pedido cuyas líneas corresponden todas a platos activos
- **THEN** el sistema registra el pedido con todas sus líneas

#### Scenario: Plato agotado temporalmente antes de confirmar
- **WHEN** un cliente confirma un pedido que contiene un plato marcado como agotado temporalmente después de añadirlo
- **THEN** el sistema retira ese plato, informa que está agotado temporalmente y muestra el resumen con el total actualizado sin registrar aún el pedido

#### Scenario: Precio cambia antes de confirmar
- **WHEN** el precio de un plato cambia después de añadirlo y antes de confirmar
- **THEN** el sistema aplica el precio vigente, informa la variación y muestra el nuevo total sin registrar aún el pedido

#### Scenario: Disponibilidad y precio cambian en el mismo envío
- **WHEN** un envío contiene un plato retirado y líneas de otro plato cuyo precio cambió
- **THEN** la carta informa ambos cambios, retira las líneas no disponibles y actualiza los precios y subtotales de las restantes conservando sus cantidades, notas e identidades
- **AND** actualiza las tarjetas y el total sin registrar ningún pedido hasta otra confirmación explícita

#### Scenario: Revisión deja el pedido vacío
- **WHEN** todos los platos seleccionados dejan de estar disponibles antes de confirmar
- **THEN** el sistema muestra el pedido vacío con total cero, informa los retiros y no permite registrar un pedido vacío

### Requirement: Registro independiente por mesa y confirmación visible
Al confirmar un pedido válido, el sistema MUST registrarlo como un pedido independiente asociado únicamente a la mesa identificada por su QR, con un número de pedido consecutivo global único y el estado inicial `recibido`. El sistema MUST conservar por cada línea el nombre del plato, la cantidad, la nota, el precio unitario y el subtotal confirmados, y MUST conservar el total confirmado en pesos mexicanos con dos decimales. El sistema MUST mostrar en el móvil una confirmación con el número y el estado del pedido. El sistema MUST permitir confirmar pedidos adicionales de la misma mesa sin modificar los pedidos previos. Desde la confirmación, el sistema MUST ofrecer la acción explícita «Hacer otro pedido» sin exigir recargar la página; esta acción MUST abrir un pedido en curso vacío para la misma mesa y MUST restablecer los controles y el resumen si la mesa continúa activa. Mientras se muestra únicamente la confirmación, el sistema MUST no permitir acumular líneas sin un resumen operable. Si la mesa dejó de estar activa, el sistema MUST mostrar la carta en modo consulta e informar que no acepta pedidos.

#### Scenario: Confirmación muestra número y estado
- **WHEN** un cliente confirma un pedido válido de una mesa identificada
- **THEN** el sistema muestra el número consecutivo global único del pedido y el estado `recibido`

#### Scenario: Mesa confirma dos pedidos durante el servicio
- **WHEN** una mesa confirma un pedido y posteriormente confirma otro pedido distinto
- **THEN** el sistema registra dos pedidos independientes asociados a esa misma mesa con números distintos

#### Scenario: Cambio posterior en el catálogo
- **WHEN** el dueño modifica el nombre o precio de un plato después de confirmar un pedido que lo incluye
- **THEN** el pedido confirmado conserva el nombre, precio unitario, subtotales y total que tenía al confirmarse

#### Scenario: Cliente inicia otro pedido desde la confirmación
- **WHEN** un cliente elige «Hacer otro pedido» después de confirmar y su mesa continúa activa
- **THEN** la misma página muestra un pedido vacío, cantidades iniciales en cero y controles para seleccionar y confirmar otro pedido
- **AND** conserva la mesa identificada y los datos del pedido anterior en el servidor

#### Scenario: Mesa desactivada antes de iniciar otro pedido
- **WHEN** un cliente elige «Hacer otro pedido» y la mesa fue desactivada
- **THEN** el sistema informa que la mesa no acepta pedidos y muestra la carta sin controles de pedido

### Requirement: Confirmación idempotente por intento técnico
El sistema MUST bloquear una confirmación adicional mientras una confirmación está en curso. El sistema MUST tratar los reintentos del mismo intento técnico como idempotentes y devolver el mismo pedido confirmado, sin crear un duplicado. Una nueva confirmación explícita posterior MUST poder crear un pedido independiente. Mientras la página permanezca abierta, una respuesta perdida o de resultado incierto MUST conservar el identificador y el contenido completo del intento, MUST ofrecer reintentar ese mismo envío y MUST impedir editarlo o iniciar otro hasta recibir un resultado definitivo. Los reintentos MUST no ejecutarse en un ciclo automático ilimitado. Un rechazo definitivo sin registro MUST devolver el control de edición al cliente; una revisión de precio o disponibilidad MUST requerir un intento nuevo después de su aceptación explícita. El sistema MUST rechazar la reutilización de un identificador con contenido distinto. La identidad de mesa usada para idempotencia MUST permanecer estable aunque cambie su nombre; las instantáneas históricas MUST conservar el nombre original. La devolución de un pedido ya confirmado MUST seguir disponible para el mismo intento aunque la mesa haya sido desactivada, sin permitir pedidos nuevos para ella. El sistema MUST preservar estas garantías al actualizar datos persistidos de versiones anteriores sin borrar ni fusionar pedidos.

#### Scenario: Doble toque en confirmar
- **WHEN** un cliente toca dos veces confirmar antes de que finalice el primer envío
- **THEN** el sistema procesa un único pedido y muestra una sola confirmación

#### Scenario: Reintento de red del mismo intento
- **WHEN** el cliente reintenta un envío técnico cuya respuesta se perdió
- **THEN** el sistema devuelve el pedido ya confirmado para ese intento sin crear otro

#### Scenario: Cliente conserva un intento de resultado incierto
- **WHEN** el envío falla sin permitir conocer si el pedido quedó registrado
- **THEN** el cliente conserva el identificador y las líneas originales, ofrece reintentar y bloquea la edición y nuevas confirmaciones hasta obtener un resultado definitivo

#### Scenario: Reintento después de renombrar la mesa
- **WHEN** se renombra una mesa después de registrar un pedido y se reintenta el mismo envío con el mismo QR
- **THEN** el sistema devuelve el pedido original con su mismo número y nombre histórico de mesa, sin insertar otro pedido

#### Scenario: Reintento después de desactivar la mesa
- **WHEN** se desactiva una mesa después de registrar un pedido y se reintenta el mismo envío
- **THEN** el sistema devuelve ese pedido sin crear otro y rechaza una confirmación nueva para la mesa inactiva

#### Scenario: Mismo identificador con contenido distinto
- **WHEN** se reutiliza el identificador de un intento confirmado para enviar otras cantidades, notas, platos o precios
- **THEN** el sistema rechaza la solicitud sin modificar el pedido confirmado ni crear otro

#### Scenario: Mesas distintas usan el mismo identificador de intento
- **WHEN** dos mesas diferentes confirman pedidos con el mismo identificador de intento
- **THEN** cada mesa obtiene su propio pedido sin recibir ni modificar el de la otra

#### Scenario: Actualización conserva los reintentos históricos
- **WHEN** se actualiza una base con pedidos asociados a mesas y se reintenta uno de esos pedidos después de renombrar su mesa
- **THEN** el sistema conserva número, nombre histórico, líneas e importes y devuelve el pedido original sin duplicarlo
