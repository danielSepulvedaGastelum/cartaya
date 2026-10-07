# Spec Delta

## MODIFIED Requirements

### Requirement: Seleccion de pedido por tarjeta
Cuando la carta se abre con una mesa activa y está componiendo un pedido, el sistema MUST mostrar en cada tarjeta de plato activo controles táctiles para disminuir, mostrar y aumentar la línea sin indicaciones, junto con un contador y subtotal acumulado de todas las líneas de ese plato en pesos mexicanos con dos decimales. La línea sin indicaciones MUST iniciar en cero, MUST no ser negativa y cada línea resultante MUST respetar el máximo de 20 unidades. Cuando la carta no tenga una mesa activa, el sistema MUST permitir la consulta pero MUST no mostrar controles de pedido. Durante el envío o un resultado incierto, los controles MUST impedir modificar el pedido; después de una confirmación, MUST permanecer ocultos o bloqueados hasta que el cliente inicie explícitamente otro pedido.

#### Scenario: Cliente ajusta la cantidad desde una tarjeta
- **WHEN** un cliente de una mesa activa aumenta dos veces la cantidad de un plato
- **THEN** la tarjeta muestra cantidad total 2 y el subtotal de dos unidades en pesos mexicanos con dos decimales

#### Scenario: Cliente disminuye la cantidad de un plato
- **WHEN** un cliente disminuye una cantidad de 1
- **THEN** la tarjeta muestra cantidad 0 y el plato deja de aparecer como línea sin indicaciones en el resumen

#### Scenario: Consulta sin mesa activa
- **WHEN** un cliente abre la carta sin una mesa activa
- **THEN** el sistema muestra la carta pública sin controles para agregar o confirmar pedidos

#### Scenario: Selector respeta el estado del envío
- **WHEN** el cliente está enviando un pedido, espera resolver un resultado incierto o acaba de recibir la confirmación
- **THEN** los selectores no permiten cambiar cantidades hasta volver a una composición editable mediante la acción correspondiente

### Requirement: Indicaciones y resumen de pedido desde la carta
Cuando la carta se abre con una mesa activa, cada tarjeta de plato MUST ofrecer una acción para abrir un panel de indicaciones. El panel MUST permitir crear una línea independiente del mismo plato con una nota opcional de hasta 140 caracteres y controles táctiles propios para disminuir, mostrar y aumentar su cantidad. El sistema MUST permitir guardar la línea aunque la nota esté vacía y MUST agregar una línea independiente por cada captura, incluso si la nota se repite. El sistema MUST mostrar al final de la carta un resumen de todas las líneas seleccionadas, sus cantidades, indicaciones cuando existan, precios unitarios, subtotales y total en pesos mexicanos con dos decimales. El resumen MUST permitir editar la indicación o eliminar cualquier línea, incluidas las creadas con los controles de la tarjeta, y MUST conservar visible la advertencia de no incluir datos personales mientras haya notas editables, aunque el panel de indicaciones esté cerrado. Al agregar una indicación no vacía a una línea creada con el selector de tarjeta, el sistema MUST conservar su identidad, cantidad y precio como línea independiente con controles propios; el selector de tarjeta MUST operar a partir de entonces sobre una nueva línea sin indicaciones que inicia en cero. Vaciar posteriormente la nota de una línea independiente MUST no fusionarla con otras líneas. Editar o eliminar líneas MUST actualizar los contadores, subtotales y total sin perder las otras líneas del plato. Durante un envío o un intento de resultado incierto, la edición MUST permanecer bloqueada conforme al contrato de confirmación idempotente.

#### Scenario: Cliente agrega una indicacion a un plato
- **WHEN** un cliente abre el panel de indicaciones de un plato y guarda la nota "sin cebolla"
- **THEN** el sistema agrega una línea separada de ese plato con la nota y actualiza el subtotal de su tarjeta y el resumen

#### Scenario: Cliente agrega indicaciones distintas o repetidas al mismo plato
- **WHEN** un cliente guarda las notas "sin cebolla", "muy picante" y nuevamente "sin cebolla" para el mismo plato
- **THEN** el resumen muestra tres líneas separadas con sus propias cantidades, notas y subtotales

#### Scenario: Cliente elimina una linea desde el resumen
- **WHEN** un cliente elimina una línea seleccionada desde el resumen
- **THEN** el sistema retira esa línea y recalcula el subtotal de su tarjeta y el total del pedido

#### Scenario: Cliente edita una indicacion desde el resumen
- **WHEN** un cliente cambia la indicación de una línea desde el resumen
- **THEN** el sistema conserva su cantidad, actualiza el texto de esa línea y mantiene actualizados los subtotales y el total

#### Scenario: Advertencia permanece al editar desde el resumen
- **WHEN** el cliente cierra el panel de indicaciones y edita una nota desde el resumen
- **THEN** la advertencia de no incluir datos personales permanece visible junto a la edición, sin solicitar datos personales ni filtrar la nota por su contenido

#### Scenario: Cliente agrega indicaciones a una línea del selector
- **WHEN** el cliente agrega dos unidades con el selector de tarjeta y escribe una nota en esa línea desde el resumen
- **THEN** conserva una línea independiente de dos unidades con esa nota y controles propios, sin alterar su subtotal
- **AND** el contador de la tarjeta sigue mostrando dos y su siguiente incremento crea una unidad adicional sin indicaciones

#### Scenario: Cliente vacía una indicación sin fusionar líneas
- **WHEN** el cliente vacía la nota de una línea independiente y existe otra línea del mismo plato
- **THEN** ambas líneas conservan su identidad y cantidad por separado, aunque sus notas queden iguales

#### Scenario: Cliente guarda una línea independiente sin nota
- **WHEN** el cliente guarda el panel de indicaciones con una nota vacía y una cantidad válida
- **THEN** el resumen conserva una línea independiente editable con esa cantidad y la advertencia de privacidad
