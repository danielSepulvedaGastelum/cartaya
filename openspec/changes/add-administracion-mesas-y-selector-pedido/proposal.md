# Proposal

## Why

Las mesas se configuran fuera de la aplicacion y sus QR solo se generan con un comando, por lo que el dueno no puede gestionarlas desde su telefono. La carta tambien necesita una composicion de pedido mas directa y visible por plato para resultar intuitiva durante el servicio.

## What Changes

- Anadir una seccion protegida de Mesas junto a Productos en la administracion.
- Permitir crear sin limite, renombrar, consultar su historial, desactivar y reactivar mesas; una mesa desactivada conserva sus pedidos y deja de aceptar pedidos nuevos.
- Mostrar para cada mesa, incluso si esta inactiva, su URL publica, su codigo QR en la web y una accion para descargarlo, diferenciando visualmente las inactivas.
- Sustituir la configuracion estatica de mesas por mesas persistidas, manteniendo una migracion inicial de las mesas configuradas y tokens QR opacos y estables.
- Reemplazar el boton unico para agregar un plato por controles tactiles de disminuir, contador y aumentar dentro de su tarjeta, con el subtotal acumulado del plato.
- Permitir abrir desde la tarjeta un panel de indicaciones con sus propios controles de cantidad. Cada captura, incluso vacia o repetida, crea una linea independiente del mismo plato; el resumen final permite editar o eliminar esas lineas y muestra subtotales y total.

### Decisiones de negocio (2026-09-23)

- Quitar una mesa significa desactivarla, nunca borrarla definitivamente; el dueno puede reactivarla despues.
- Antes de desactivar una mesa, el dueno debe confirmar la accion. No existe limite de mesas.
- El dueno puede renombrar una mesa y consultar sus pedidos historicos.
- Toda mesa, activa o inactiva, conserva URL y QR; una mesa inactiva se muestra desaturada y claramente identificada como tal.
- No existe regeneracion de QR: el codigo de cada mesa permanece estable.
- `MESAS` se usa solo para crear las mesas iniciales durante la migracion.
- Un QR de mesa desactivada sigue pudiendo abrir la carta publica, pero muestra un mensaje y no habilita ni acepta pedidos.
- El identificador usado por el QR es estable aunque cambie el nombre visible de la mesa.
- Los controles de cantidad sin indicaciones modifican la linea sin indicaciones, mientras el contador de tarjeta suma todas las lineas del plato.
- Una linea de indicacion tiene sus propios controles `+` y `-`; puede guardarse sin texto y cada captura, incluso repetida, agrega una linea separada.
- El resumen permite editar una indicacion ademas de eliminar su linea.
- Se conservan los limites vigentes: cada linea admite de 1 a 20 unidades y una nota opcional de hasta 140 caracteres.

## Capabilities

### New Capabilities

- `administracion-mesas`: Gestion protegida de mesas persistidas, historial, URL publica y QR descargable.

### Modified Capabilities

- `administracion-catalogo`: La administracion incorpora navegacion entre Productos y Mesas.
- `carta-digital-publica`: La carta muestra controles por tarjeta para componer el pedido y sus indicaciones.

## Impact

- Afecta SQLite, configuracion inicial, generacion y validacion de QR, historial de pedidos, rutas administrativas y publicas de carta/pedidos.
- Afecta la interfaz React de administracion y carta, sus estilos y sus pruebas de API, base de datos y cliente.
- No agrega dependencias, cuentas de cliente, pagos ni datos personales.
