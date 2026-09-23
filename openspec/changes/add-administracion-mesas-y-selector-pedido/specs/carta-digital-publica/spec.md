# Spec Delta

## ADDED Requirements

### Requirement: Seleccion de pedido por tarjeta
Cuando la carta se abre con una mesa activa, el sistema MUST mostrar en cada tarjeta de plato activo controles tactiles para disminuir, mostrar y aumentar la linea sin indicaciones, junto con un contador y subtotal acumulado de todas las lineas de ese plato en pesos mexicanos con dos decimales. La linea sin indicaciones MUST iniciar en cero, MUST no ser negativa y cada linea resultante MUST respetar el maximo de 20 unidades. Cuando la carta no tenga una mesa activa, el sistema MUST permitir la consulta pero MUST no mostrar controles de pedido.

#### Scenario: Cliente ajusta la cantidad desde una tarjeta
- **WHEN** un cliente de una mesa activa aumenta dos veces la cantidad de un plato
- **THEN** la tarjeta muestra cantidad total 2 y el subtotal de dos unidades en pesos mexicanos con dos decimales

#### Scenario: Cliente disminuye la cantidad de un plato
- **WHEN** un cliente disminuye una cantidad de 1
- **THEN** la tarjeta muestra cantidad 0 y el plato deja de aparecer como linea sin indicaciones en el resumen

#### Scenario: Consulta sin mesa activa
- **WHEN** un cliente abre la carta sin una mesa activa
- **THEN** el sistema muestra la carta publica sin controles para agregar o confirmar pedidos

### Requirement: Indicaciones y resumen de pedido desde la carta
Cuando la carta se abre con una mesa activa, cada tarjeta de plato MUST ofrecer una accion para abrir un panel de indicaciones. El panel MUST permitir crear una linea independiente del mismo plato con una nota opcional de hasta 140 caracteres y controles tactiles propios para disminuir, mostrar y aumentar su cantidad. El sistema MUST permitir guardar la linea aunque la nota este vacia y MUST agregar una linea independiente por cada captura, incluso si la nota se repite. El sistema MUST mostrar al final de la carta un resumen de todas las lineas seleccionadas, sus cantidades, indicaciones cuando existan, precios unitarios, subtotales y total en pesos mexicanos con dos decimales. El resumen MUST permitir editar la indicacion o eliminar una linea y MUST conservar la advertencia de no incluir datos personales.

#### Scenario: Cliente agrega una indicacion a un plato
- **WHEN** un cliente abre el panel de indicaciones de un plato y guarda la nota "sin cebolla"
- **THEN** el sistema agrega una linea separada de ese plato con la nota y actualiza el subtotal de su tarjeta y el resumen

#### Scenario: Cliente agrega indicaciones distintas o repetidas al mismo plato
- **WHEN** un cliente guarda las notas "sin cebolla", "muy picante" y nuevamente "sin cebolla" para el mismo plato
- **THEN** el resumen muestra tres lineas separadas con sus propias cantidades, notas y subtotales

#### Scenario: Cliente elimina una linea desde el resumen
- **WHEN** un cliente elimina una linea seleccionada desde el resumen
- **THEN** el sistema retira esa linea y recalcula el subtotal de su tarjeta y el total del pedido

#### Scenario: Cliente edita una indicacion desde el resumen
- **WHEN** un cliente cambia la indicacion de una linea desde el resumen
- **THEN** el sistema conserva su cantidad, actualiza el texto de esa linea y mantiene actualizados los subtotales y el total
