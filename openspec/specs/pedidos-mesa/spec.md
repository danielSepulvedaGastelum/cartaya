# pedidos-mesa Specification

## Purpose

Permitir que un cliente confirme desde la carta pública pedidos asociados a su mesa, sin registro ni datos personales, para que queden disponibles para cocina.

## Requirements

### Requirement: Composición de un pedido de mesa
El sistema MUST permitir que una carta abierta con un identificador de mesa válido añada platos activos a un pedido en curso, ajuste una cantidad entera de 1 a 20 unidades por cada línea y elimine líneas del pedido. El sistema MUST permitir líneas distintas del mismo plato cuando sus notas difieran. Para cada línea, el sistema MUST permitir una nota libre opcional de hasta 140 caracteres y MUST advertir que no se incluyan datos personales, sin solicitarlos ni filtrar o rechazar la nota por ese motivo. El sistema MUST impedir que un pedido en curso contenga un plato inactivo, una cantidad fuera de 1 a 20 o una nota de más de 140 caracteres. El sistema MUST no imponer un límite de líneas por pedido.

#### Scenario: Cliente añade un plato con cantidad y nota
- **WHEN** un cliente añade un plato activo, selecciona cantidad 2 y escribe la nota "sin cebolla"
- **THEN** el pedido en curso muestra una línea de ese plato con cantidad 2 y la nota indicada

#### Scenario: Cliente actualiza o elimina una línea
- **WHEN** un cliente cambia la cantidad de una línea del pedido o la elimina
- **THEN** el pedido en curso refleja la nueva cantidad o deja de mostrar esa línea

#### Scenario: Nota demasiado larga
- **WHEN** un cliente intenta guardar una nota de 141 caracteres para una línea
- **THEN** el sistema informa el límite de 140 caracteres y no guarda esa nota

#### Scenario: Mismo plato con indicaciones distintas
- **WHEN** un cliente agrega el mismo plato con las notas "sin cebolla" y "muy picante"
- **THEN** el sistema conserva dos líneas separadas con sus respectivas indicaciones

#### Scenario: Cantidad máxima por línea
- **WHEN** un cliente intenta establecer 21 unidades en una línea
- **THEN** el sistema informa el límite de 20 unidades y no guarda esa cantidad

#### Scenario: Advertencia de privacidad en la nota
- **WHEN** un cliente edita la nota de una línea
- **THEN** el sistema advierte que no incluya datos personales y no solicita ningún dato personal

### Requirement: Resumen y confirmación sin datos personales
Antes de confirmar, el sistema MUST mostrar un resumen de todas las líneas del pedido en curso, sus cantidades, notas cuando existan, precios unitarios, subtotales y total en pesos mexicanos con dos decimales. El sistema MUST requerir una acción explícita de confirmación y MUST impedir confirmar un pedido sin líneas. La confirmación MUST no solicitar ni almacenar nombre, correo electrónico, teléfono, cuenta ni otro dato personal del cliente.

#### Scenario: Cliente revisa y confirma un pedido
- **WHEN** un cliente con al menos una línea selecciona confirmar desde el resumen
- **THEN** el sistema muestra el total en pesos mexicanos con dos decimales y registra el pedido sin pedir datos personales

#### Scenario: Cliente intenta confirmar un pedido vacío
- **WHEN** un cliente selecciona confirmar sin líneas en el pedido
- **THEN** el sistema no registra un pedido e informa que debe añadir al menos un plato

### Requirement: Validación de disponibilidad y precio durante la confirmación
El sistema MUST volver a validar que todos los platos del pedido estén activos y obtener su precio vigente inmediatamente antes de registrar la confirmación. Si algún plato ya no está activo, incluido uno agotado temporalmente o archivado, el sistema MUST retirarlo del pedido en curso, identificarlo al cliente y mostrar el resumen y total actualizados antes de permitir una nueva confirmación. Si cambia el precio de una línea, el sistema MUST aplicar el precio vigente, informar el cambio y mostrar el resumen y total actualizados antes de permitir una nueva confirmación. El sistema MUST no registrar un pedido mientras haya líneas retiradas o precios modificados pendientes de revisión.

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

### Requirement: Registro independiente por mesa y confirmación visible
Al confirmar un pedido válido, el sistema MUST registrarlo como un pedido independiente asociado únicamente a la mesa identificada por su QR, con un número de pedido consecutivo global único y el estado inicial `recibido`. El sistema MUST conservar por cada línea el nombre del plato, la cantidad, la nota, el precio unitario y el subtotal confirmados, y MUST conservar el total confirmado en pesos mexicanos con dos decimales. El sistema MUST mostrar en el móvil una confirmación con el número y el estado del pedido. El sistema MUST permitir confirmar pedidos adicionales de la misma mesa sin modificar los pedidos previos.

#### Scenario: Confirmación muestra número y estado
- **WHEN** un cliente confirma un pedido válido de una mesa identificada
- **THEN** el sistema muestra el número consecutivo global único del pedido y el estado `recibido`

#### Scenario: Mesa confirma dos pedidos durante el servicio
- **WHEN** una mesa confirma un pedido y posteriormente confirma otro pedido distinto
- **THEN** el sistema registra dos pedidos independientes asociados a esa misma mesa con números distintos

#### Scenario: Cambio posterior en el catálogo
- **WHEN** el dueño modifica el nombre o precio de un plato después de confirmar un pedido que lo incluye
- **THEN** el pedido confirmado conserva el nombre, precio unitario, subtotales y total que tenía al confirmarse

### Requirement: Confirmación idempotente por intento técnico
El sistema MUST bloquear una confirmación adicional mientras una confirmación está en curso. El sistema MUST tratar los reintentos del mismo intento técnico como idempotentes y devolver el mismo pedido confirmado, sin crear un duplicado. Una nueva confirmación explícita posterior MUST poder crear un pedido independiente.

#### Scenario: Doble toque en confirmar
- **WHEN** un cliente toca dos veces confirmar antes de que finalice el primer envío
- **THEN** el sistema procesa un único pedido y muestra una sola confirmación

#### Scenario: Reintento de red del mismo intento
- **WHEN** el cliente reintenta un envío técnico cuya respuesta se perdió
- **THEN** el sistema devuelve el pedido ya confirmado para ese intento sin crear otro

### Requirement: Alcance limitado del pedido desde mesa
El sistema MUST limitar el flujo público a pedidos para consumir en la mesa identificada y MUST no ofrecer pago en línea, propinas, división de cuenta, llamada al camarero ni pedidos para llevar.

#### Scenario: Cliente revisa las acciones disponibles del pedido
- **WHEN** un cliente usa el flujo de pedido desde la carta pública
- **THEN** el sistema ofrece únicamente la composición, revisión y confirmación del pedido para su mesa y no ofrece las funciones fuera de alcance

