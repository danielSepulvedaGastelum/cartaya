# administracion-catalogo Specification

## Purpose

Permitir que el dueño mantenga desde su celular las categorías y los platos de la carta sin exponer la administración a clientes finales.

## Requirements

### Requirement: Acceso protegido a la administración
El sistema MUST exigir una sesión autenticada con la contraseña del establecimiento para acceder o modificar el catálogo. El sistema MUST impedir que una consulta pública acceda a funciones administrativas y MUST no crear cuentas ni perfiles para clientes finales.

#### Scenario: Dueño autenticado administra el catálogo
- **WHEN** el dueño inicia sesión con la contraseña válida del establecimiento
- **THEN** el sistema le permite abrir y usar la administración del catálogo

#### Scenario: Cliente sin sesión intenta administrar
- **WHEN** una persona sin sesión válida solicita una función administrativa
- **THEN** el sistema rechaza el acceso y no modifica el catálogo

### Requirement: Gestión, archivado y restauración de categorías
El sistema MUST permitir al dueño crear, editar, ordenar manualmente, archivar y restaurar categorías desde una interfaz utilizable en móvil. Al archivar una categoría, MUST archivar todos sus platos y retirar la categoría y sus platos de la carta pública sin borrar sus datos ni fotografías. Al restaurar una categoría, MUST restaurar también los platos archivados junto con ella.

#### Scenario: Dueño reordena categorías
- **WHEN** el dueño cambia el orden manual de dos categorías
- **THEN** el sistema conserva el nuevo orden y la carta pública lo refleja

#### Scenario: Dueño archiva una categoría
- **WHEN** el dueño archiva una categoría con platos publicados
- **THEN** el sistema archiva la categoría y todos sus platos sin borrar sus datos ni fotografías

#### Scenario: Dueño restaura una categoría
- **WHEN** el dueño restaura una categoría archivada
- **THEN** el sistema restaura la categoría y los platos archivados junto con ella para que vuelvan a poder publicarse

### Requirement: Gestión, archivado y restauración de platos
El sistema MUST permitir al dueño crear, editar, ordenar manualmente, archivar y restaurar platos dentro de una categoría. Un plato MUST incluir nombre, precio en pesos mexicanos con dos decimales y descripción breve; la fotografía será opcional. El dueño MUST seleccionar los alérgenos aplicables del catálogo de 14 y puede no seleccionar ninguno. Al archivar un plato, el sistema MUST conservarlo junto con su fotografía; al restaurarlo, MUST recuperar su información y fotografía para la carta pública.

#### Scenario: Dueño crea un plato sin alérgenos declarados
- **WHEN** el dueño guarda un plato con los campos obligatorios y sin alérgenos seleccionados
- **THEN** el sistema lo conserva sin una declaración negativa de alérgenos y el plato se puede publicar en su categoría

#### Scenario: Dueño reordena platos de una categoría
- **WHEN** el dueño cambia el orden manual de los platos de una categoría
- **THEN** el sistema conserva el nuevo orden y la carta pública lo refleja

#### Scenario: Dueño archiva y restaura un plato
- **WHEN** el dueño archiva y posteriormente restaura un plato con fotografía
- **THEN** el sistema conserva y recupera el plato y su fotografía sin borrarlos definitivamente

### Requirement: Carga controlada de fotografías
El sistema MUST permitir al dueño asociar opcionalmente una fotografía a un plato. El sistema MUST aceptar únicamente imágenes JPEG, PNG o WebP de hasta 5 MB y MUST informar el error sin cambiar la fotografía existente cuando el archivo no cumpla estas condiciones.

#### Scenario: Dueño carga una fotografía válida
- **WHEN** el dueño carga una fotografía WebP de 5 MB o menos
- **THEN** el sistema la asocia al plato y la deja disponible para su consulta pública

#### Scenario: Dueño carga una fotografía demasiado grande
- **WHEN** el dueño intenta cargar una imagen mayor a 5 MB
- **THEN** el sistema rechaza el archivo, informa el límite y conserva la fotografía anterior del plato
