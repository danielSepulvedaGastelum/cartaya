# Tasks

## 1. Persistencia y dominio de mesas

- [x] 1.1 Crear la tabla `mesas`, agregar `pedidos.mesa_id` y sembrar `MESAS` una sola vez con tokens HMAC heredados; verificar con pruebas de migracion que pedidos previos conservan su nombre y relacion.
- [x] 1.2 Implementar altas sin limite, renombre, listado, desactivacion confirmable y reactivacion con token inmutable; verificar los escenarios "Dueno crea una mesa", "Dueno renombra una mesa" y "Dueno desactiva y reactiva una mesa".
- [x] 1.3 Implementar la consulta de pedidos y lineas historicas por mesa activa o inactiva; verificar el escenario "Dueno consulta el historial de una mesa inactiva".
- [x] 1.4 Integrar mesas persistidas en la validacion y almacenamiento de pedidos; verificar que una mesa inactiva rechaza pedidos nuevos y que una reactivada vuelve a aceptarlos.
- [x] 1.5 Adaptar `npm run qr` para generar PNG de mesas activas persistidas sin regenerar tokens; verificar que genera la URL y archivo de una mesa activa sin anadir dependencias.

## 2. API publica, administrativa y QR

- [x] 2.1 Actualizar `GET /api/carta` para distinguir mesa activa, inactiva y token desconocido; verificar el escenario "QR de mesa inactiva" con catalogo y estado de no disponibilidad.
- [x] 2.2 Exponer rutas autenticadas para CRUD logico de mesas, historial y QR; verificar que clientes sin sesion no pueden modificar ni consultar recursos administrativos.
- [x] 2.3 Generar el mismo PNG de QR para visualizacion y descarga, incluida una mesa inactiva, con URL y token estables; verificar los escenarios "Dueno consulta y descarga el QR de una mesa" y "Mesa inactiva visible en administracion".
- [x] 2.4 Mantener la defensa de servidor en `POST /api/pedidos` ante una mesa desactivada durante una sesion de cliente; verificar que devuelve un mensaje especifico de mesa no disponible.

## 3. Panel administrativo de Productos y Mesas

- [x] 3.1 Incorporar navegacion accesible entre Productos y Mesas, conservando sesion y seccion elegida; verificar el escenario "Dueño cambia de sección administrativa".
- [x] 3.2 Construir la seccion Mesas con alta, renombre, URL, QR, descarga, historial y acciones de activar/desactivar; verificar que no impone limite de mesas.
- [x] 3.3 Anadir confirmacion antes de desactivar y presentacion gris o desaturada con estado explicito para una mesa inactiva, manteniendo visibles URL y QR; verificar el comportamiento con prueba de interfaz.
- [x] 3.4 Preservar el flujo de Productos dentro de la nueva navegacion; verificar el escenario "Dueño autenticado administra el catálogo" y el rechazo sin sesion.

## 4. Selector, indicaciones y resumen de pedido

- [x] 4.1 Reemplazar el boton unico por controles grandes de linea normal y mostrar contador y subtotal agregados de todas las lineas del plato en MXN; verificar el escenario "Cliente ajusta la cantidad desde una tarjeta" con una linea especial incluida.
- [x] 4.2 Mantener la carta de solo consulta y un mensaje explicito para mesa ausente, desconocida o inactiva; verificar los escenarios "Cliente disminuye la cantidad de un plato" y "Consulta sin mesa activa".
- [x] 4.3 Implementar panel de indicaciones que cree siempre una linea independiente, aun con nota vacia o repetida, con controles propios de cantidad de 1 a 20; verificar los escenarios "Cliente agrega una indicacion a un plato" y "Cliente agrega indicaciones distintas o repetidas al mismo plato".
- [x] 4.4 Permitir desde el resumen aumentar, disminuir, editar la nota o eliminar cada linea especial, conservando advertencia de privacidad, subtotales y total; verificar los escenarios "Cliente elimina una linea desde el resumen" y "Cliente edita una indicacion desde el resumen".
- [x] 4.5 Conservar idempotencia, precios y manejo de disponibilidad con el nuevo modelo de lineas; verificar que los flujos existentes de confirmacion siguen pasando en pruebas de cliente y API.

## 5. Integracion y calidad

- [x] 5.1 Ajustar estilos para alto contraste, controles tactiles grandes, QR legible, estado inactivo desaturado y diseno movil sin desplazamiento horizontal; verificar manualmente Productos, Mesas, historial, tarjetas y resumen.
- [x] 5.2 Ejecutar `npm run test`, corregir fallos y comprobar que cada escenario nuevo tiene una prueba trazable por nombre; ejecutar `openspec validate add-administracion-mesas-y-selector-pedido --strict`.
