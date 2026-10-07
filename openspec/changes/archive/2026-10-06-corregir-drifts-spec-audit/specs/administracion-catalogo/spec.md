# Spec Delta

## ADDED Requirements

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
