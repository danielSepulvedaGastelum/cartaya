# Spec Delta

## MODIFIED Requirements

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
