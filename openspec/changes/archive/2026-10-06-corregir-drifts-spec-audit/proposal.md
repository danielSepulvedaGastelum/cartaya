# Proposal

## Why

La auditoría de CartaYa detectó once divergencias: el cliente no reconcilia precios ni disponibilidad, los reintentos pueden duplicar pedidos, la sesión revocada conserva su canal SSE y faltan garantías de interfaz y pruebas. Aunque los 89 tests existentes pasan, las reproducciones aisladas confirman estos defectos; corregirlos permite volver a confiar en las especificaciones vivas.

## What Changes

- H1: actualizar líneas, precios, tarjetas y total ante conflictos de confirmación, anunciar los cambios y requerir una nueva confirmación explícita.
- H2–H3: conservar el intento técnico ante respuestas inciertas y asociar su idempotencia a la identidad estable de mesa; migrar los datos sin borrar pedidos ni alterar sus instantáneas históricas.
- H4: ofrecer un flujo explícito para iniciar otro pedido desde la confirmación, en la misma página.
- H5: cerrar todos los canales SSE de una sesión al revocarla y volver al acceso cuando el cliente reciba el rechazo de autenticación.
- H6–H7: conservar la advertencia de privacidad en el resumen y permitir editar indicaciones de cualquier línea, incluidas las creadas desde la tarjeta.
- H8: regularizar en la spec administrativa las acciones existentes para marcar agotado temporalmente y devolver disponibilidad, independientes del archivado.
- H9: reparar textos propios con codificación dañada y verificar su presentación en español de México.
- H10: completar pruebas por escenario en la capa correspondiente y documentar la trazabilidad de las cinco capacidades, sin confundir presencia de un nombre con cobertura efectiva.
- H11: medir el contenido útil de la carta compilada en un navegador con condiciones reproducibles, conservando el presupuesto vigente de menos de dos segundos.

### Decisiones de negocio propuestas — 2026-10-06

- Mantener las specs vigentes como contrato: los defectos de implementación se corrigen y el agotamiento administrativo se documenta como comportamiento ya deseado.
- Ante una respuesta incierta, ofrecer reintentar el mismo envío y bloquear su edición hasta conocer el resultado; no sugerir una nueva confirmación que pueda duplicarlo. El intento sigue siendo efímero durante la vida de la página, como el carrito actual.
- Después del éxito, ofrecer «Hacer otro pedido», que abre un carrito vacío para la misma mesa y conserva los pedidos previos.
- Al agregar una nota a la línea normal, conservar su identidad y cantidad como línea independiente; el selector de tarjeta queda disponible para una nueva línea sin indicaciones. Vaciar después esa nota no fusiona líneas.
- Cerrar sesión revoca únicamente esa sesión y sus conexiones; las sesiones independientes del establecimiento siguen operando.
- Mantener pesos mexicanos con centavos, límite de 20 unidades por línea, 140 caracteres por nota, anonimato y los alcances actuales de pedidos y cocina.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pedidos-mesa`: precisar reconciliación visible, ciclo del intento técnico, identidad estable e inicio explícito de pedidos adicionales.
- `carta-digital-publica`: precisar edición de todas las líneas y permanencia de la advertencia de privacidad.
- `panel-cocina`: precisar la revocación de streams vinculados a una sesión cerrada.
- `administracion-catalogo`: incorporar el contrato de agotamiento temporal y reactivación.

Los requisitos de `administracion-mesas` no cambian; su identidad estable, historial y QR se verifican como regresión. Codificación, trazabilidad y medición cumplen requisitos ya existentes y no añaden capacidades de producto.

## Impact

- Cliente: `CartaPublica.jsx`, mensajes de `Admin.jsx`, tratamiento de errores en `api.js` y recuperación de acceso en `Cocina.jsx`.
- Servidor: `pedidos.js`, esquema y migraciones en `database.js`, inicialización de mesas en `mesas.js`, sesiones en `auth.js`, streams en `cocina.js` y errores en `app.js`.
- Compatibilidad: conservar rutas, tokens QR, números, importes y datos de pedidos; sustituir la unicidad por nombre mediante migración transaccional. Detectar colisiones existentes y detener esa migración sin elegir ni borrar pedidos automáticamente.
- Verificación: ampliar Vitest y agregar pruebas de navegador con `@playwright/test` como dependencia de desarrollo, justificada para medir el build real y ejecutar recorridos completos que jsdom no representa; ninguna dependencia nueva de producción.
- Documentación futura: matriz de escenarios y procedimiento reproducible de rendimiento. Este cambio crea únicamente artefactos de planificación; la implementación y la sincronización de specs quedan para sus workflows respectivos.
