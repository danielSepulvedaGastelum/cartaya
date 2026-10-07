# administracion-catalogo Specification

## Purpose

Permitir que el dueÃ±o mantenga desde su celular las categorÃ­as y los platos de la carta sin exponer la administraciÃ³n a clientes finales.

## Requirements

### Requirement: Acceso protegido a la administración
El sistema MUST exigir una sesión autenticada con la contraseña del establecimiento para acceder o modificar el catálogo o las mesas. El sistema MUST mostrar al dueño una navegación móvil entre las secciones Productos y Mesas, conservando la sección seleccionada. El sistema MUST impedir que una consulta pública acceda a funciones administrativas y MUST no crear cuentas ni perfiles para clientes finales.

#### Scenario: Dueño autenticado administra el catálogo
- **WHEN** el dueño inicia sesión con la contraseña válida del establecimiento
- **THEN** el sistema le permite abrir y usar la administración de Productos y Mesas

#### Scenario: Dueño cambia de sección administrativa
- **WHEN** el dueño elige Productos o Mesas en la navegación administrativa
- **THEN** el sistema muestra la sección elegida sin cerrar su sesión

#### Scenario: Cliente sin sesión intenta administrar
- **WHEN** una persona sin sesión válida solicita una función administrativa
- **THEN** el sistema rechaza el acceso y no modifica el catálogo ni las mesas
### Requirement: GestiÃ³n, archivado y restauraciÃ³n de categorÃ­as
El sistema MUST permitir al dueÃ±o crear, editar, ordenar manualmente, archivar y restaurar categorÃ­as desde una interfaz utilizable en mÃ³vil. Al archivar una categorÃ­a, MUST archivar todos sus platos y retirar la categorÃ­a y sus platos de la carta pÃºblica sin borrar sus datos ni fotografÃ­as. Al restaurar una categorÃ­a, MUST restaurar tambiÃ©n los platos archivados junto con ella.

#### Scenario: DueÃ±o reordena categorÃ­as
- **WHEN** el dueÃ±o cambia el orden manual de dos categorÃ­as
- **THEN** el sistema conserva el nuevo orden y la carta pÃºblica lo refleja

#### Scenario: DueÃ±o archiva una categorÃ­a
- **WHEN** el dueÃ±o archiva una categorÃ­a con platos publicados
- **THEN** el sistema archiva la categorÃ­a y todos sus platos sin borrar sus datos ni fotografÃ­as

#### Scenario: DueÃ±o restaura una categorÃ­a
- **WHEN** el dueÃ±o restaura una categorÃ­a archivada
- **THEN** el sistema restaura la categorÃ­a y los platos archivados junto con ella para que vuelvan a poder publicarse

### Requirement: GestiÃ³n, archivado y restauraciÃ³n de platos
El sistema MUST permitir al dueÃ±o crear, editar, ordenar manualmente, archivar y restaurar platos dentro de una categorÃ­a. Un plato MUST incluir nombre, precio en pesos mexicanos con dos decimales y descripciÃ³n breve; la fotografÃ­a serÃ¡ opcional. El dueÃ±o MUST seleccionar los alÃ©rgenos aplicables del catÃ¡logo de 14 y puede no seleccionar ninguno. Al archivar un plato, el sistema MUST conservarlo junto con su fotografÃ­a; al restaurarlo, MUST recuperar su informaciÃ³n y fotografÃ­a para la carta pÃºblica.

#### Scenario: DueÃ±o crea un plato sin alÃ©rgenos declarados
- **WHEN** el dueÃ±o guarda un plato con los campos obligatorios y sin alÃ©rgenos seleccionados
- **THEN** el sistema lo conserva sin una declaraciÃ³n negativa de alÃ©rgenos y el plato se puede publicar en su categorÃ­a

#### Scenario: DueÃ±o reordena platos de una categorÃ­a
- **WHEN** el dueÃ±o cambia el orden manual de los platos de una categorÃ­a
- **THEN** el sistema conserva el nuevo orden y la carta pÃºblica lo refleja

#### Scenario: DueÃ±o archiva y restaura un plato
- **WHEN** el dueÃ±o archiva y posteriormente restaura un plato con fotografÃ­a
- **THEN** el sistema conserva y recupera el plato y su fotografÃ­a sin borrarlos definitivamente

### Requirement: Carga controlada de fotografÃ­as
El sistema MUST permitir al dueÃ±o asociar opcionalmente una fotografÃ­a a un plato. El sistema MUST aceptar Ãºnicamente imÃ¡genes JPEG, PNG o WebP de hasta 5 MB y MUST informar el error sin cambiar la fotografÃ­a existente cuando el archivo no cumpla estas condiciones.

#### Scenario: DueÃ±o carga una fotografÃ­a vÃ¡lida
- **WHEN** el dueÃ±o carga una fotografÃ­a WebP de 5 MB o menos
- **THEN** el sistema la asocia al plato y la deja disponible para su consulta pÃºblica

#### Scenario: DueÃ±o carga una fotografÃ­a demasiado grande
- **WHEN** el dueÃ±o intenta cargar una imagen mayor a 5 MB
- **THEN** el sistema rechaza el archivo, informa el lÃ­mite y conserva la fotografÃ­a anterior del plato

### Requirement: Gestión de agotamiento temporal independiente del archivado
El sistema MUST permitir al dueño autenticado marcar un plato no archivado como agotado temporalmente y devolverle disponibilidad desde Productos. La administración MUST distinguir la condición de agotado temporalmente y ofrecer la acción aplicable «Agotado» o «Disponible». Marcar agotado MUST ocultar el plato de las siguientes consultas de carta pública e impedir su confirmación en pedidos nuevos, conservando nombre, descripción, precio, fotografía, alérgenos, orden y pedidos históricos. Devolver disponibilidad MUST retirar únicamente la condición de agotado temporalmente y MUST publicar el plato solo si ni él ni su categoría están archivados. Cambiar disponibilidad MUST no archivar, restaurar ni borrar el plato o su categoría. Archivar y restaurar MUST no borrar la condición de agotado temporalmente. Ninguna operación pública sin sesión MUST poder modificar esa condición.

#### Scenario: Dueño marca un plato agotado temporalmente
- **WHEN** el dueño marca «Agotado» en un plato publicado
- **THEN** el plato queda identificado como agotado temporalmente en Productos y deja de aparecer en nuevas consultas públicas
- **AND** se conserva su información y los pedidos confirmados anteriormente

#### Scenario: Dueño devuelve disponibilidad a un plato
- **WHEN** el dueño elige «Disponible» en un plato agotado cuyo plato y categoría no están archivados
- **THEN** el plato vuelve a publicarse y puede añadirse y confirmarse en pedidos nuevos

#### Scenario: Reactivar disponibilidad no restaura archivos
- **WHEN** el dueño solicita devolver disponibilidad a un plato archivado o perteneciente a una categoría archivada
- **THEN** el sistema no altera el archivado y el plato permanece fuera de la carta pública

#### Scenario: Restaurar un plato conserva su agotamiento
- **WHEN** el dueño archiva y después restaura un plato que estaba agotado temporalmente, directamente o junto con su categoría
- **THEN** el plato sigue agotado y no se publica hasta que el dueño le devuelva disponibilidad

#### Scenario: Cliente intenta modificar la disponibilidad
- **WHEN** una persona sin sesión válida intenta marcar agotado o devolver disponibilidad
- **THEN** el sistema rechaza la operación y conserva la condición anterior del plato
