# Proposal

## Why

La carta digital actual permite consultar el catálogo desde el QR de una mesa, pero obliga al cliente a solicitar sus platos por otro medio. Permitir que confirme pedidos desde esa misma carta agiliza el servicio sin crear cuentas ni recopilar datos personales.

## What Changes

- Añadir un flujo público de pedido asociado exclusivamente a la mesa identificada por su QR: agregar platos, ajustar cantidades de hasta 20 unidades por línea, anotar indicaciones por plato y revisar el total antes de confirmar, sin límite de líneas.
- Permitir líneas del mismo plato cuando sus indicaciones sean distintas y advertir que las notas no deben incluir datos personales.
- Crear pedidos independientes para una misma mesa; cada confirmación genera un número consecutivo global y el estado inicial `recibido`, que un futuro panel de cocina podrá actualizar.
- Validar de nuevo la disponibilidad y el precio vigente de los platos al confirmar; retirar e informar los que ya no estén disponibles y volver a presentar el total recalculado antes de permitir el envío.
- Evitar duplicados por doble toque o reintentos técnicos mediante bloqueo de la confirmación e idempotencia entre cliente y servidor.
- Mostrar una confirmación móvil con el número y el estado del pedido, sin solicitar registro ni datos personales.
- Ampliar la carta pública para que la mesa identificada pueda iniciar el flujo de pedido desde ella.

### Decisiones de negocio (2026-09-23)

- Los importes se muestran y se conservan en pesos mexicanos con centavos; se omite toda referencia a euros.
- El pedido se identifica por la mesa derivada del QR válido, nunca por una persona ni por datos de contacto.
- Cada envío confirmado es un pedido independiente, incluso cuando proviene de la misma mesa durante el mismo servicio.
- El estado inicial visible será `recibido`; un futuro panel de cocina podrá actualizarlo. La consulta del estado tras recargar queda fuera de este cambio.
- Al confirmar se conservan el nombre, precio unitario y total de cada línea para que cambios posteriores en el catálogo no alteren el pedido ya enviado.
- El precio vigente al confirmar prevalece sobre el visto al agregar. Si cambia, se informa el nuevo total y se exige una nueva confirmación explícita.
- Si un plato deja de estar disponible antes de confirmar, se retira, se informa y se recalcula el total; se exige una nueva confirmación explícita.
- Cada intento técnico de confirmación es idempotente y el botón se bloquea mientras está en curso; confirmaciones deliberadamente nuevas generan pedidos distintos.
- El mismo plato puede aparecer en líneas distintas cuando las indicaciones difieren.
- No se solicitan datos personales y se advierte no incluirlos en las notas; no se filtra ni rechaza el texto de una nota por ese motivo.
- La carta se puede consultar con cualquier URL, pero sólo un token QR válido de una mesa configurada permite pedir.
- Un plato puede estar `activo`, `agotado temporalmente` o archivado; los agotados temporalmente no son pedibles ni visibles en la carta pública, pero pueden reactivarse sin restaurar un archivo.
- El número de pedido es un consecutivo global simple.
- Cada línea admite de 1 a 20 unidades; no hay límite de líneas por pedido.

## Capabilities

### New Capabilities

- `pedidos-mesa`: Crear, validar, persistir y confirmar pedidos públicos de una mesa, con sus líneas, total, número y estado inicial.

### Modified Capabilities

- `carta-digital-publica`: Permitir que la carta abierta mediante un QR de mesa inicie el pedido asociado a esa mesa, conserve su identificador y muestre sólo platos disponibles.

## Impact

- Afecta la carta pública de React, sus estilos y su cliente de API.
- Afecta Express, SQLite y el servicio de catálogo para validar mesas, estado, disponibilidad y precio vigente de platos durante la confirmación.
- Añade rutas públicas de pedidos, idempotencia y tablas para pedidos y sus líneas; amplía el estado de disponibilidad de los platos, sin añadir dependencias ni autenticación de clientes.
- Requiere pruebas de API, base de datos y cliente trazables a los escenarios de las specs.
