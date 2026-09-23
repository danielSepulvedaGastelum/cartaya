# Design

## Context

La aplicación ya expone una carta pública en `GET /api/carta` y conserva en su URL el token opaco de mesa generado con HMAC. El catálogo de SQLite guarda precios como `precio_centavos`, y la carta sólo publica platos y categorías no archivados. Véanse `proposal.md` y las deltas de `pedidos-mesa` y `carta-digital-publica` para el comportamiento requerido.

## Goals / Non-Goals

**Goals:**

- Confirmar de forma atómica pedidos públicos vinculados a una mesa válida, con líneas y totales inmutables.
- Extender la carta móvil con controles accesibles para componer, revisar y confirmar un pedido.
- Dejar cada pedido en estado `recibido` para que un panel de cocina futuro pueda actualizarlo.
- Evitar pedidos duplicados de un mismo intento técnico.

**Non-Goals:**

- Implementar el panel de cocina, cambios de estado, consulta del estado tras recargar, notificaciones en tiempo real o SSE en este cambio.
- Añadir cuentas, sesiones de cliente, datos personales, pago, propinas, división de cuenta, llamadas al camarero o pedidos para llevar.
- Cambiar el formato del QR ni añadir dependencias.

## Decisions

### Resolver el token de QR contra las mesas configuradas

El servidor derivará el token esperado para cada entrada de `config.mesas` mediante la misma función HMAC que usa el generador de QR y sólo permitirá crear pedidos cuando encuentre una coincidencia. `GET /api/carta` devolverá además una señal de que la mesa es válida, para que el cliente oculte los controles de pedido en consultas sin QR o manipuladas. Se guardará el identificador de mesa configurado, no el token ni datos de cliente.

Esto reutiliza el mecanismo existente, evita una tabla adicional de QR y mantiene el token como identificador opaco. Como alternativa se consideró aceptar cualquier parámetro `mesa`, pero permitiría asociar pedidos a mesas inexistentes; también se descartó crear una tabla de tokens, porque duplicaría la configuración sin aportar una necesidad actual.

### Persistir pedidos y líneas con instantáneas de catálogo

`createDatabase` creará las tablas `pedidos` y `pedido_lineas`. Un pedido tendrá un identificador entero autogenerado que se mostrará como número consecutivo global, la mesa, el estado `recibido`, el total en centavos y su fecha de creación. Cada línea tendrá la referencia al plato, nombre del plato, cantidad de 1 a 20, nota opcional, precio unitario y subtotal en centavos; la nota tendrá un máximo de 140 caracteres. No habrá límite de líneas y cada línea conservará su propia nota, por lo que un plato podrá repetirse cuando las indicaciones difieran.

El servicio nuevo de pedidos resolverá los platos activos junto con su categoría y construirá las instantáneas. Guardar sólo el identificador del plato se descartó porque posteriores cambios de nombre o precio alterarían la lectura histórica. No se almacena una persona, contacto, sesión ni dirección de entrega.

### Separar activo, agotado temporalmente y archivado

El catálogo añadirá un indicador de agotamiento temporal independiente de `platos.archivado`. Un plato será publicable únicamente si no está archivado, no está agotado temporalmente y su categoría no está archivada. El agotamiento temporal retira el plato de la carta y de la validación de pedidos, pero permite reactivarlo sin restaurar un archivo.

Reutilizar sólo el archivado se descartó porque no representa una ausencia temporal de existencias y obligaría a restauraciones administrativas innecesarias.

### Confirmar con una transacción y requerir revisión de cambios

`POST /api/pedidos` recibirá el token de mesa, una clave de idempotencia y las líneas normalizadas del pedido en curso. Dentro de una transacción SQLite, el servicio validará la mesa, comprobará el estado público de todos los platos y obtendrá sus precios vigentes. Si todos están disponibles y sus precios no han cambiado respecto al resumen aceptado, insertará pedido y líneas con las instantáneas vigentes y devolverá `201` con número, estado, líneas y total confirmados.

Si una o varias líneas ya no son publicables, no insertará nada y responderá con las líneas retiradas. Si cambió algún precio, no insertará nada y responderá con las líneas y el total recalculados a precios vigentes. El cliente quitará las líneas retiradas o actualizará los precios, anunciará el cambio y exigirá una nueva acción explícita de confirmar. Se descartó registrar parcialmente las líneas disponibles o aceptar silenciosamente un total distinto porque el cliente debe ver y aceptar el nuevo total.

### Hacer idempotente cada intento técnico de confirmación

Al iniciar una confirmación, el cliente generará una clave opaca y deshabilitará el botón hasta recibir respuesta. Conservará la misma clave sólo para reintentar ese envío tras un fallo de red; después de éxito, disponibilidad retirada o precio cambiado, una acción nueva generará una clave nueva. El servidor persistirá la clave junto con el pedido y aplicará unicidad por mesa e intento para devolver el pedido ya creado a los reintentos equivalentes. Si una clave se reutiliza con un contenido diferente, el servidor la rechazará.

El bloqueo sólo en interfaz se descartó porque una respuesta perdida aún permite un reintento HTTP. Tratar todas las confirmaciones de una mesa como idénticas se descartó porque impediría pedidos adicionales intencionales.

### Mantener el pedido en curso únicamente en el cliente

`CartaPublica` mantendrá en estado de React las líneas por plato, cantidad y nota, y calculará subtotales y total a partir de los precios ya mostrados. Al tener una mesa válida, cada plato dispondrá de una acción grande para agregarlo; el resumen permitirá aumentar, disminuir, eliminar y editar notas, mostrará el contador de caracteres y la advertencia de no incluir datos personales. Tras una respuesta exitosa, se sustituirá el pedido en curso por la confirmación con el número y estado.

No se persistirá un carrito ni se añadirá consulta de pedido tras recargar: el pedido no existe hasta la confirmación y la visualización posterior a una recarga no forma parte de este cambio. Los controles usarán etiquetas, mensajes con `aria-live`, contraste y tamaños táctiles coherentes con la carta existente.

### Separar disponibilidad pública del acceso administrativo

Se añadirá al servicio de catálogo una consulta reutilizable para obtener platos publicables, considerando `platos.archivado`, el agotamiento temporal y `categorias.archivada`. El servicio de pedidos la usará sólo para validar el envío; las rutas públicas de pedidos no usarán ni ampliarán el enrutador administrativo ni requerirán sesión.

No se agregan dependencias: Express, React y better-sqlite3 ya cubren el cambio. Crear un segundo proceso o una cola de cocina se descarta hasta que exista la capacidad de panel de cocina.

## Risks / Trade-offs

- [Un plato se archiva o se agota después de abrir la carta] → La validación se repite dentro de la transacción y el cliente recibe las líneas retiradas para revisar el nuevo total.
- [Un precio cambia después de abrir la carta] → El servidor devuelve el precio vigente y el cliente debe revisarlo antes de una confirmación nueva.
- [Un doble toque o respuesta perdida duplica el envío] → La clave de idempotencia persiste el resultado del intento y el cliente bloquea el botón mientras espera.
- [Una URL de carta puede llevar un token alterado] → El servidor resuelve el token contra las mesas configuradas y rechaza crear pedidos sin coincidencia.
- [El dueño modifica un plato ya pedido] → Las instantáneas de las líneas y total mantienen el historial confirmado.
- [Un pedido se pierde al recargar antes de confirmar] → Es un carrito deliberadamente efímero; sólo la confirmación queda persistida.
- [El número entero revela el volumen aproximado de pedidos] → No contiene datos personales y es el identificador simple requerido para la confirmación y el futuro panel de cocina.

## Migration Plan

1. Incorporar las tablas, la clave de idempotencia y los índices de pedidos mediante `CREATE TABLE IF NOT EXISTS`, y añadir el indicador de agotamiento temporal al catálogo sin alterar pedidos existentes.
2. Desplegar el servicio y ruta pública de pedidos junto con la actualización de la respuesta de carta y la interfaz de React.
3. Ejecutar las pruebas de base de datos, API y cliente trazables a las deltas antes de publicar.
4. Para revertir, retirar la interfaz y las rutas nuevas; conservar las tablas y pedidos ya confirmados para no perder historial. No hay migración destructiva ni dependencia nueva que revertir.
