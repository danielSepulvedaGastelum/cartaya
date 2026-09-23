# carta-digital-publica Specification

## Purpose

Permitir que cualquier cliente consulte la carta vigente de La EstaciÃ³n desde el QR Ãºnico de su mesa, sin instalar una aplicaciÃ³n ni identificarse.

## Requirements

### Requirement: Consulta publica identificada por mesa
El sistema MUST permitir consultar la carta sin iniciar sesion, crear una cuenta ni proporcionar datos personales. Cada QR de mesa MUST abrir una URL publica con un identificador unico de mesa. La consulta MUST conservar ese identificador para el futuro flujo de pedidos y MUST permitir iniciar un pedido cuando la mesa este activa. Cuando la URL no contenga un identificador de mesa valido o identifique una mesa inactiva, el sistema MUST mostrar la carta publica sin permitir iniciar un pedido, sin crear pedidos ni almacenar datos personales.

#### Scenario: Cliente consulta la carta desde el QR de su mesa activa
- **WHEN** el cliente abre la URL codificada en el QR unico de una mesa activa
- **THEN** el sistema muestra la carta sin solicitar autenticacion ni datos personales
- **AND** conserva el identificador de mesa en la URL
- **AND** permite iniciar un pedido asociado a esa mesa

#### Scenario: Consulta de carta sin mesa identificada
- **WHEN** el cliente accede a la carta desde una URL sin un identificador de mesa valido
- **THEN** el sistema muestra la carta publica
- **AND** no permite iniciar un pedido
- **AND** no crea ningun pedido ni almacena datos personales
### Requirement: PublicaciÃ³n y orden del catÃ¡logo
La carta MUST mostrar Ãºnicamente las categorÃ­as no archivadas que tengan platos activos y, dentro de cada una, todos sus platos activos, respetando el orden manual configurado por el dueÃ±o para categorÃ­as y platos. Una categorÃ­a archivada MUST archivar y retirar de la carta pÃºblica todos sus platos. Una categorÃ­a vacÃ­a MUST no mostrarse.

#### Scenario: Plato archivado no se publica
- **WHEN** el dueÃ±o ha archivado un plato
- **THEN** el sistema no muestra ese plato en ninguna categorÃ­a de la carta pÃºblica

#### Scenario: CategorÃ­a archivada no se publica
- **WHEN** el dueÃ±o ha archivado una categorÃ­a con platos
- **THEN** el sistema no muestra la categorÃ­a ni ninguno de sus platos en la carta pÃºblica

#### Scenario: CategorÃ­a vacÃ­a no se publica
- **WHEN** una categorÃ­a no archivada no tiene platos activos
- **THEN** el sistema no muestra esa categorÃ­a en la carta pÃºblica

### Requirement: InformaciÃ³n de cada plato
El sistema MUST mostrar para cada plato activo su nombre, precio en pesos mexicanos con dos decimales, descripciÃ³n breve y foto cuando exista. El sistema MUST mostrar de forma visible sÃ³lo los alÃ©rgenos declarados para el plato, seleccionados del catÃ¡logo fijo de 14: cereales con gluten, crustÃ¡ceos, huevo, pescado, cacahuates, soya, leche, frutos de cÃ¡scara, apio, mostaza, ajonjolÃ­, diÃ³xido de azufre y sulfitos, altramuces y moluscos. Cuando un plato no tenga alÃ©rgenos declarados, el sistema MUST no mostrar una leyenda ni secciÃ³n de alÃ©rgenos.

#### Scenario: Plato con alÃ©rgenos declarados
- **WHEN** un cliente visualiza un plato que tiene huevo y leche declarados
- **THEN** el sistema muestra ambos alÃ©rgenos de forma visible junto con la informaciÃ³n del plato

#### Scenario: Plato sin alÃ©rgenos declarados
- **WHEN** un cliente visualiza un plato sin alÃ©rgenos declarados
- **THEN** el sistema no muestra una leyenda ni secciÃ³n de alÃ©rgenos para ese plato

#### Scenario: Precio con centavos
- **WHEN** un cliente visualiza un plato con precio de 85 pesos
- **THEN** el sistema muestra el precio con dos decimales y sin una leyenda sobre IVA

### Requirement: Carga progresiva y accesible en mÃ³vil
El sistema MUST ofrecer la carta pÃºblica con texto legible, contraste alto y controles tÃ¡ctiles de tamaÃ±o adecuado en mÃ³vil. El sistema MUST presentar desde la carga inicial las categorÃ­as y datos textuales de todos los platos publicables. Las fotografÃ­as que estÃ©n fuera del Ã¡rea visible inicial MUST cargarse de forma diferida cuando el cliente se desplace hacia ellas. Bajo una conexiÃ³n 4G y un celular de gama media, MUST cargar en menos de dos segundos el contenido Ãºtil de la parte superior de la carta.

#### Scenario: FotografÃ­a diferida al desplazarse
- **WHEN** un cliente se desplaza hasta un plato cuya fotografÃ­a estaba fuera del Ã¡rea visible inicial
- **THEN** el sistema carga y muestra la fotografÃ­a de ese plato

#### Scenario: Consulta mÃ³vil con condiciones objetivo
- **WHEN** un cliente abre una carta publicada desde un celular de gama media con conexiÃ³n 4G
- **THEN** el contenido Ãºtil de la parte superior de la carta queda disponible en menos de dos segundos

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

### Requirement: Visibilidad de platos segun disponibilidad
La carta publica MUST mostrar solamente los platos con disponibilidad activa. Los platos sin disponibilidad MUST permanecer ocultos para los clientes y no se deben poder agregar a un pedido.

#### Scenario: Carta con platos no disponibles
- **WHEN** el cliente consulta la carta y existen platos sin disponibilidad activa
- **THEN** el sistema muestra unicamente los platos disponibles
- **AND** no ofrece controles para agregar platos no disponibles a un pedido
