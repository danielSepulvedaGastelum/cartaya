# Spec Delta

## Purpose

Permitir que el dueno gestione desde la administracion las mesas que pueden pedir, consulte sus pedidos historicos y entregue sus codigos QR sin herramientas externas.

## ADDED Requirements

### Requirement: Gestion persistida de mesas
El sistema MUST permitir al dueno autenticado crear cualquier cantidad de mesas con un nombre no vacio y distinto, renombrarlas, consultar sus mesas activas e inactivas, desactivarlas y reactivarlas despues. El sistema MUST solicitar confirmacion antes de desactivar una mesa. Desactivar una mesa MUST conservar sus pedidos e historial y MUST impedir nuevos pedidos asociados a ella; el sistema MUST no eliminar definitivamente una mesa desde la administracion.

#### Scenario: Dueno crea una mesa
- **WHEN** el dueno guarda una mesa nueva con un nombre valido
- **THEN** el sistema la muestra como activa y disponible para generar su URL y codigo QR

#### Scenario: Dueno renombra una mesa
- **WHEN** el dueno guarda un nombre valido distinto para una mesa
- **THEN** el sistema actualiza su nombre visible sin cambiar su URL ni codigo QR

#### Scenario: Dueno desactiva y reactiva una mesa
- **WHEN** el dueno confirma la desactivacion de una mesa y posteriormente la reactiva
- **THEN** el sistema conserva su historial, bloquea pedidos mientras esta inactiva y vuelve a permitirlos al reactivarla

### Requirement: Consulta de historial por mesa
El sistema MUST permitir al dueno autenticado consultar desde la administracion los pedidos historicos asociados a una mesa activa o inactiva, conservando el nombre mostrado al momento de cada pedido.

#### Scenario: Dueno consulta el historial de una mesa inactiva
- **WHEN** el dueno abre el historial de una mesa inactiva
- **THEN** el sistema muestra los pedidos previamente asociados a esa mesa sin reactivarla

### Requirement: Consulta y descarga de QR de mesa
El sistema MUST mostrar para cada mesa, activa o inactiva, su URL publica y su codigo QR dentro de la administracion. El sistema MUST permitir descargar ese mismo codigo QR para imprimirlo, MUST mostrar una mesa inactiva con una apariencia visual desaturada y un estado inequivoco, y MUST mantener estable la URL y el codigo QR de una mesa aunque cambie su nombre visible. El sistema MUST no ofrecer regeneracion de codigos QR.

#### Scenario: Dueno consulta y descarga el QR de una mesa
- **WHEN** el dueno abre la seccion Mesas y elige una mesa
- **THEN** el sistema muestra su URL, muestra su codigo QR y permite descargarlo

#### Scenario: Mesa inactiva visible en administracion
- **WHEN** el dueno consulta una mesa inactiva
- **THEN** el sistema mantiene visibles su URL y QR, pero los presenta desaturados y claramente identificados como inactivos

#### Scenario: QR de mesa inactiva
- **WHEN** un cliente abre el QR de una mesa que fue desactivada
- **THEN** el sistema permite consultar la carta publica, muestra que la mesa no acepta pedidos y no ofrece ni acepta la confirmacion de un pedido para esa mesa
