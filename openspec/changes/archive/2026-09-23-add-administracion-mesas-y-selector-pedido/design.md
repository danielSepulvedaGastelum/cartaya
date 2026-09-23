# Design

## Context

La aplicacion usa SQLite mediante `better-sqlite3`, Express y React. Las mesas actuales proceden de `MESAS` y sus QR se derivan del nombre y de `SESSION_SECRET`; por ello no soportan administracion ni cambio de nombre. Los pedidos almacenan la mesa como texto y la carta actual usa lineas independientes para enviar el pedido. El paquete `qrcode` ya esta instalado.

La propuesta y sus deltas definen el alcance funcional. Este diseno explica como migrar las mesas sin perder QR ni pedidos previos, como exponer su historial y como representar el pedido por lineas normales y especiales.

## Goals / Non-Goals

**Goals:**

- Persistir mesas sin limite con identidad, token QR inmutable, nombre editable y estado de activacion.
- Mantener URL, QR e historial de una mesa aunque este inactiva; los QR no se regeneran.
- Permitir al dueno consultar el historial de pedidos por mesa desde Administracion.
- Mantener una interaccion clara entre cantidad total por tarjeta y controles propios de cada indicacion.

**Non-Goals:**

- No se anaden cuentas, roles, pagos, borrado fisico de mesas ni un servicio externo de QR.
- No se implementa una vista global nueva de pedidos: el historial se consulta desde cada mesa.
- No se cambia idempotencia, precios, maximo de 20 unidades por linea ni maximo de 140 caracteres por nota.

## Decisions

### Mesas persistidas, QR unico y migracion inicial

La tabla `mesas` contendra identificador, nombre unico normalizado, token unico, estado y marcas temporales. El token es opaco e inmutable: para las mesas creadas despues de la migracion se genera criptograficamente y no existira una ruta ni boton para regenerarlo. El nombre puede modificarse sin afectar token, URL o QR.

Al crear la tabla, `MESAS` se leera unicamente si no hay mesas persistidas. Sus valores se insertaran con el HMAC que ya generaba `mesaToken`, conservando los QR impresos. Desde ese momento la tabla, no la variable de entorno, es la fuente de verdad; no hay limite de registros.

Se descarta recalcular un token desde el nombre o permitir regenerarlo porque cualquiera de ambas opciones invalidaria QR entregados a clientes.

### Relacion con pedidos e historial visible

`pedidos` recibira `mesa_id` como referencia a `mesas.id`; el texto de mesa se conserva como instantanea legible. La migracion anadira la columna y relacionara pedidos existentes por nombre. Los nuevos pedidos guardaran ambos valores en la misma transaccion.

El servicio de mesas incluira una consulta ordenada de pedidos y lineas por `mesa_id`, serializada con los datos que ya se muestran al confirmar. Una mesa nunca se borra, por lo que este historial queda disponible tanto activa como inactiva. Se descarta una pantalla global de historial para mantener la administracion sencilla.

### Estados de mesa y QR en las dos experiencias

Una mesa inactiva conserva URL, endpoint PNG y accion de descarga en Administracion, pero su tarjeta se presenta desaturada con etiqueta de estado inequivoca. El boton de desactivacion abre una confirmacion nativa o accesible antes de cambiar el estado.

`GET /api/carta` distinguira token activo, inactivo y desconocido. Para token inactivo entregara la carta y un indicador de inactividad; la carta mostrara un mensaje explicito y ocultara todos los controles de pedido. `POST /api/pedidos` repetira la validacion y rechazara la operacion si la mesa esta inactiva, incluso con una pagina antigua abierta.

Las rutas protegidas seran `GET /mesas`, `POST /mesas`, `PATCH /mesas/:id`, `POST /mesas/:id/desactivar`, `POST /mesas/:id/reactivar`, `GET /mesas/:id/historial` y `GET /mesas/:id/qr`. Esta ultima devolvera el mismo PNG para visualizacion o descarga mediante `Content-Disposition` y `qrcode`, sin guardar archivos ni anadir dependencias. `npm run qr` enumerara mesas activas persistidas para generacion por lote.

### Administracion por secciones

`Admin` conservara su navegacion de Productos y Mesas. Mesas tendra lista sin limite, formulario de alta o renombre, confirmacion de desactivacion, recursos QR/URL y una vista expandible de historial. La carga de catalogo, mesas e historial se realizara solo cuando corresponda y se actualizara despues de cada mutacion.

### Lineas normales y especiales de la carta

El carrito seguira como una lista de lineas. Cada captura desde el panel crea siempre una linea nueva, incluso con nota vacia o repetida. La linea especial inicia en una unidad y tiene en el panel, y despues en el resumen, sus propios controles `+` y `-` entre 1 y 20; eliminarla es equivalente a bajarla por debajo de una unidad.

Los botones de la tarjeta modifican unicamente la linea normal sin nota. El contador y subtotal de la tarjeta agregan la linea normal y todas las especiales, por lo que representan el total real del plato. El resumen permite editar el texto de una nota, eliminar la linea y recalcula los importes desde el mismo estado que se envia al API.

Se descarta fusionar lineas con la misma nota: cada captura representa un grupo que cocina puede preparar o entregar por separado.

## Risks / Trade-offs

- [Una URL base incorrecta produce QR inaccesibles] -> Mostrar la URL final en Administracion y verificarla antes de imprimir.
- [Una migracion puede dejar pedidos heredados sin relacion] -> Crear tablas, columna y relleno de forma comprobable, conservar el texto anterior y respaldar SQLite antes del despliegue.
- [El historial puede crecer por mesa] -> Consultarlo bajo demanda y ordenar por fecha; el volumen esperado de una cafeteria permite SQLite sin paginacion inicial.
- [Una mesa inactiva mantiene un QR util visualmente] -> Desaturar y etiquetar su estado en Administracion, y bloquear pedidos en cliente y servidor.
- [La tarjeta total puede mostrar unidades especiales que su control rapido no reduce] -> Dar controles propios a cada linea especial en panel y resumen, ademas de describir el contador como total.

## Migration Plan

1. Respaldar el archivo SQLite antes de desplegar.
2. Crear `mesas`; si esta vacia, sembrarla desde `MESAS` con tokens heredados. Agregar `pedidos.mesa_id` y rellenarlo por nombre cuando sea posible.
3. Desplegar servicio, rutas, interfaz y pruebas; comprobar un QR heredado, una mesa nueva, una renombrada y una inactiva.
4. Confirmar desde Administracion que URL, QR, descarga e historial siguen disponibles tras desactivar una mesa y que la carta muestra el mensaje de inactividad.
5. Si falla antes de operar nuevas mesas, restaurar respaldo y version anterior. Una vez creadas mesas nuevas, preservar la tabla en cualquier rollback para no perder sus identidades.
