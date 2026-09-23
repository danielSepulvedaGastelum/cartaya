# Tasks

## 1. Modelo y reglas de pedidos

- [ ] 1.1 Crear en `database.js` las tablas, restricciones e índices de `pedidos` y `pedido_lineas`, incluida la clave de idempotencia, con importes en centavos e instantáneas de línea; verificar con pruebas de base de datos cantidades de 1 a 20, notas de hasta 140 caracteres, líneas repetidas con notas distintas, total, estado `recibido`, consecutivo global y datos históricos.
- [ ] 1.2 Añadir al catálogo el estado de agotamiento temporal independiente del archivado y verificar que un plato agotado no es publicable ni pedible, y que se reactiva sin restaurarlo.
- [ ] 1.3 Implementar un servicio de pedidos que resuelva el token HMAC contra `config.mesas`, valide líneas y use una transacción para comprobar que plato y categoría sigan activos antes de crear un pedido; verificar con pruebas unitarias la mesa inválida, pedido vacío, cantidades o notas inválidas, dos pedidos independientes y líneas no disponibles sin inserción parcial.
- [ ] 1.4 Implementar la revalidación del precio vigente durante la transacción y verificar que informa precios modificados, recalcula el total y no inserta hasta una nueva confirmación.
- [ ] 1.5 Implementar idempotencia por mesa e intento técnico y verificar que un reintento de la misma clave devuelve el pedido original, que no crea duplicados y que rechaza reutilizar la clave con contenido distinto.
- [ ] 1.6 Añadir al servicio de catálogo una consulta de platos publicables reutilizable para la validación de pedidos y verificar que excluye platos archivados, agotados temporalmente y platos de categorías archivadas.

## 2. API pública de carta y pedidos

- [ ] 2.1 Ampliar `GET /api/carta` con la indicación de mesa válida sin impedir la consulta pública, y verificar los escenarios “Cliente consulta la carta desde el QR de su mesa”, “Consulta sin mesa identificada” y “Plato agotado temporalmente no aparece en la carta”.
- [ ] 2.2 Añadir `POST /api/pedidos` para confirmar una mesa, clave idempotente y líneas válidas, devolver `201` con número, estado, líneas y total confirmados, y verificar mediante pruebas de API “Cliente revisa y confirma un pedido”, “Cliente intenta confirmar un pedido vacío”, “Confirmación muestra número y estado”, “Mesa confirma dos pedidos durante el servicio” y “Cambio posterior en el catálogo”.
- [ ] 2.3 Definir las respuestas de disponibilidad y precio de `POST /api/pedidos` sin crear el pedido, y verificar mediante pruebas de API “Plato archivado antes de confirmar”, “Plato agotado temporalmente antes de confirmar”, “Precio cambia antes de confirmar” y “Todos los platos siguen activos al confirmar”.
- [ ] 2.4 Verificar mediante pruebas de API “Doble toque en confirmar” y “Reintento de red del mismo intento”, incluida la devolución del pedido previamente confirmado.

## 3. Experiencia de pedido en la carta móvil

- [ ] 3.1 Extender `CartaPublica` con estado efímero de pedido y controles táctiles accesibles para agregar, cambiar cantidad de 1 a 20, eliminar y anotar cada plato sólo cuando la mesa sea válida; verificar con pruebas de cliente “Cliente añade un plato con cantidad y nota”, “Cliente actualiza o elimina una línea”, “Nota demasiado larga”, “Mismo plato con indicaciones distintas” y “Cantidad máxima por línea”.
- [ ] 3.2 Implementar el resumen previo a la confirmación con precios unitarios, subtotales y total en MXN con dos decimales, la advertencia de no incluir datos personales y mensajes accesibles; verificar “Advertencia de privacidad en la nota” y que no muestra ni solicita datos personales ni acciones de pago, propinas, división, camarero o para llevar, cubriendo “Cliente revisa las acciones disponibles del pedido”.
- [ ] 3.3 Conectar la confirmación al API: bloquear el botón durante el envío, reutilizar la clave sólo en reintentos técnicos y mostrar número y estado tras éxito; verificar el flujo completo con pruebas de cliente.
- [ ] 3.4 Ante disponibilidad o cambio de precio, retirar o actualizar las líneas informadas, anunciar el cambio y mostrar el resumen recalculado antes de habilitar una nueva confirmación; verificar ambos flujos con pruebas de cliente.

## 4. Verificación integral

- [ ] 4.1 Ejecutar `npm test` y verificar que cada escenario de las deltas `pedidos-mesa` y `carta-digital-publica` tiene una prueba trazable por su nombre y que la carta y administración preexistentes siguen pasando.
