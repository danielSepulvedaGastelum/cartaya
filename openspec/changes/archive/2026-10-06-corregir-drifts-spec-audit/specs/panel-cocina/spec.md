# Spec Delta

## MODIFIED Requirements

### Requirement: Acceso protegido y uso en tablet
El sistema MUST exigir la misma sesión autenticada con la contraseña del establecimiento para consultar o modificar el panel de cocina y para conectarse a sus actualizaciones en tiempo real. Una sesión iniciada durante la jornada MUST permanecer válida hasta la medianoche local del establecimiento salvo que se cierre explícitamente, y MUST expirar entonces. El sistema MUST rechazar todas esas operaciones cuando no exista una sesión válida. Al cerrar una sesión, el sistema MUST revocarla y cerrar todos sus canales de actualizaciones abiertos antes de completar el cierre de sesión; MUST no entregar nuevos eventos de pedidos por ellos después de la revocación. El cierre de una sesión MUST no revocar otras sesiones independientes. El panel MUST volver al acceso y retirar los pedidos de la pantalla cuando detecte que su sesión dejó de ser válida, sin continuar los intentos de reconexión una vez confirmado el rechazo. El panel MUST presentar texto legible, contraste alto y controles táctiles de tamaño adecuado para usarse en una tablet.

#### Scenario: Sesión del establecimiento abre el panel
- **WHEN** una persona inicia sesión con la contraseña válida del establecimiento y abre el panel de cocina
- **THEN** el sistema le permite consultar y operar los pedidos con la misma sesión usada por la administración

#### Scenario: Persona sin sesión intenta consultar el panel
- **WHEN** una persona sin sesión válida solicita la cola, el histórico o el canal de actualizaciones del panel de cocina
- **THEN** el sistema rechaza el acceso y no expone datos de los pedidos

#### Scenario: Sesión cubre la jornada completa
- **WHEN** el establecimiento inicia sesión durante el día y mantiene abierto el panel sin cerrar la sesión
- **THEN** la misma sesión continúa válida hasta la medianoche local y expira al terminar esa jornada

#### Scenario: Panel utilizable en tablet
- **WHEN** el panel de cocina se muestra en una tablet
- **THEN** presenta la información con texto legible, contraste alto y controles táctiles de tamaño adecuado

#### Scenario: Cierre de sesión corta sus canales abiertos
- **WHEN** se cierra una sesión con dos paneles conectados y después se confirma o actualiza un pedido
- **THEN** ambos canales de esa sesión están cerrados y no reciben el nuevo evento
- **AND** las consultas, operaciones y nuevas conexiones con esa sesión se rechazan

#### Scenario: Cierre de una sesión conserva las demás
- **WHEN** se cierra una sesión y hay otro panel conectado con una sesión independiente válida
- **THEN** el otro panel continúa recibiendo y operando pedidos hasta su propio cierre o vencimiento

#### Scenario: Panel vuelve al acceso tras revocación
- **WHEN** el canal se cierra y el panel confirma que su sesión fue revocada
- **THEN** retira la vista de pedidos, muestra el acceso y detiene su conexión y los intentos de reconexión hasta un nuevo inicio de sesión
