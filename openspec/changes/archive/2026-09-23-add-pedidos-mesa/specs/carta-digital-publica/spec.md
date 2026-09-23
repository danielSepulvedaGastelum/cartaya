# Spec Delta

## MODIFIED Requirements

### Requirement: Consulta pública identificada por mesa
El sistema MUST permitir consultar la carta sin iniciar sesión, crear una cuenta ni proporcionar datos personales. Cada QR de mesa MUST abrir una URL pública con un identificador único y válido de mesa. La consulta MUST conservar ese identificador y MUST permitir iniciar desde la carta un pedido asociado a esa mesa. Cuando la URL no contenga un identificador de mesa válido, el sistema MUST permitir consultar la carta, pero MUST no permitir iniciar un pedido.

#### Scenario: Cliente consulta la carta desde el QR de su mesa
- **WHEN** un cliente abre el QR único de una mesa
- **THEN** el sistema muestra la carta sin solicitar autenticación ni datos personales, conserva el identificador de esa mesa en la URL y permite iniciar el pedido de esa mesa

#### Scenario: Consulta sin mesa identificada
- **WHEN** un cliente abre la carta sin un identificador de mesa válido
- **THEN** el sistema muestra la carta pública y no ofrece la acción para iniciar un pedido

## ADDED Requirements

### Requirement: Visibilidad de platos según disponibilidad
El sistema MUST mostrar en la carta pública sólo los platos activos. Un plato agotado temporalmente o archivado MUST no aparecer como disponible ni poder agregarse a un pedido; el agotamiento temporal MUST poder revertirse sin restaurar un plato archivado.

#### Scenario: Plato agotado temporalmente no aparece en la carta
- **WHEN** el establecimiento marca un plato como agotado temporalmente
- **THEN** el sistema deja de mostrarlo como disponible en la carta pública y permite que vuelva a mostrarse al reactivarlo
