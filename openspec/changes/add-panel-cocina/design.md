# Design

## Context

Ver [proposal.md](./proposal.md#why) para la motivación y [specs/panel-cocina/spec.md](./specs/panel-cocina/spec.md) para el contrato observable.

Hoy `pedidos.estado` sólo admite `recibido` mediante una restricción `CHECK`, `creado_en` se guarda con `CURRENT_TIMESTAMP` y las líneas ya conservan nombre, cantidad y nota. `createPedidos` confirma dentro de una transacción, Express concentra las rutas en `app.js`, la autenticación mantiene una cookie `cartaya_sesion` compartida y React decide la pantalla a partir de `location.pathname`. No existe infraestructura de eventos ni una ruta de cocina.

El despliegue es un único proceso Node.js con un único archivo SQLite, por lo que un canal de publicación en memoria es suficiente. El volumen esperado de una cafetería permite enviar instantáneas pequeñas sin introducir colas, brokers, polling ni sincronización entre procesos.

## Goals / Non-Goals

**Goals:**

- Evolucionar pedidos existentes sin perderlos ni romper sus líneas o el historial por mesa.
- Hacer atómicas las reglas de transición y cancelación aun con dos tablets actuando a la vez.
- Conservar pedidos activos entre jornadas y registrar las horas de cada hito aplicable.
- Mantener sincronizados los paneles mediante SSE con recuperación completa tras reconectar.
- Reutilizar la sesión y las convenciones de rutas, errores y pruebas existentes.
- Mantener la interfaz operable en una tablet y evitar solicitudes de red para actualizar el tiempo transcurrido.

**Non-Goals:**

- Distribuir eventos entre varios procesos o servidores; CartaYa continúa siendo una aplicación de una sola instancia.
- Conservar un registro de auditoría de cada intento rechazado o calcular duraciones por etapa.
- Añadir roles, empleados, turnos, métricas, impresión de tickets o configuración del sonido.
- Añadir una dependencia de producción: se usarán SSE, `EventSource` y audio del navegador disponibles en la plataforma actual.

## Decisions

### 1. Ampliar el pedido con tres estados y marcas horarias independientes

La tabla `pedidos` admitirá `recibido`, `en_preparacion` y `servido` en `estado`, y añadirá `en_preparacion_en TEXT NULL`, `servido_en TEXT NULL` y `cancelado_en TEXT NULL`. `creado_en` seguirá siendo la hora de recepción. Todos los momentos se conservarán en UTC; los límites del día local se calcularán en el servidor y se convertirán a un intervalo UTC semiabierto `[inicio, fin)` sin depender de funciones horarias de SQLite.

Para bases existentes se reconstruirá `pedidos` dentro de una migración transaccional, copiando todas las columnas y filas, recreando índices y preservando la relación de `pedido_lineas`. La comprobación de llaves foráneas se desactivará sólo durante la reconstrucción y se verificará antes de reanudar el servicio. Las instalaciones nuevas crearán directamente el esquema actualizado.

Se descartó representar la cancelación como `estado = cancelado` porque añadiría una transición fuera de la secuencia normativa. La interfaz derivará la clasificación Cancelados de `cancelado_en`. Los timestamps de preparación y servicio no sustituyen a `estado`; documentan los hitos y permiten mostrar sus horas sin convertir este cambio en un sistema de métricas.

### 2. Centralizar consultas y mutaciones de cocina en el servicio de pedidos

El servicio de pedidos incorporará una serialización completa común, la consulta del día y tres operaciones explícitas: iniciar, servir y cancelar. Express expondrá un router autenticado bajo `/api/cocina` con una consulta de instantánea y acciones separadas para esas operaciones, siguiendo las rutas de acción que ya usa la administración.

Cada mutación será un único `UPDATE` condicionado por identificador, estado esperado y `cancelado_en IS NULL`. Iniciar asignará simultáneamente `estado = en_preparacion` y `en_preparacion_en`; servir asignará `estado = servido` y `servido_en`; cancelar conservará `estado = recibido` y asignará `cancelado_en`, sin campo de motivo. Cero filas modificadas provocará una segunda lectura para diferenciar un pedido inexistente (`404`) de un conflicto de estado (`409`). De esta forma, dos pantallas no pueden aplicar la misma transición aunque lean simultáneamente el estado anterior. Sólo después de confirmar la transacción se publicará el cambio.

Se descartó confiar en los botones del cliente porque cualquier llamada directa podría saltarse la secuencia. También se descartó aceptar un estado arbitrario en un `PATCH`: las acciones explícitas reducen entradas inválidas y hacen más legibles las rutas y pruebas.

### 3. Mantener activos sin límite de fecha y clasificar el histórico por finalización

La instantánea contendrá cuatro colecciones visuales derivadas de dos consultas:

- Recibidos y En preparación: todos los pedidos activos, sin filtro de fecha, separados por `estado` y ordenados por `creado_en` y número ascendentes.
- Servidos y Cancelados: pedidos cuya `servido_en` o `cancelado_en` caiga dentro del día local vigente, separados por resultado y ordenados por su hora de finalización y número descendentes.

El servidor calculará una sola vez por consulta el inicio y fin de la fecha local y aplicará el intervalo únicamente a las colecciones históricas. Así, un pedido pendiente no desaparece a medianoche y, cuando termine en una jornada posterior, entra en el histórico de su fecha de servicio o cancelación conservando su recepción original. Al cruzar medianoche expira la sesión; después del nuevo acceso, la instantánea conserva los activos y muestra el histórico de la nueva jornada.

Se descartó filtrar activos por `creado_en` porque ocultaría trabajo pendiente. También se descartó comparar fechas directamente en SQLite porque los timestamps están en UTC y el significado de jornada pertenece a la hora local del establecimiento.

### 4. Usar SSE con instantáneas completas y eventos tipados

El servicio mantendrá un conjunto en memoria de suscriptores. El endpoint autenticado `/api/cocina/eventos` enviará encabezados SSE, una instantánea inmediata al conectar y comentarios de mantenimiento periódicos; retirará el suscriptor cuando se cierre la respuesta.

Después de una confirmación nueva se emitirá `pedido_nuevo`; después de iniciar, servir o cancelar se emitirá `pedidos_actualizados`. Ambos eventos transportarán la instantánea vigente completa y el número afectado. Al reconectar, la primera emisión será siempre `snapshot`. El cliente reemplazará y ordenará sus colecciones por número, por lo que la repetición de una instantánea es idempotente y corrige cualquier evento perdido. La pantalla hará además una consulta HTTP inicial: permite distinguir un `401` y mostrar el acceso antes de abrir `EventSource`; la instantánea inicial del stream cierra la posible carrera entre esa consulta y la conexión.

El cliente mostrará un aviso visible desde el evento de error o cierre inesperado y no lo retirará al iniciar la reconexión, sino después de reconciliar el siguiente `snapshot`. Mantendrá en memoria los números ya presentados: al reconciliar tras una desconexión, emitirá una vez el tono por cada pedido activo desconocido y no avisará por pedidos ya vistos.

Se descartaron eventos incrementales con `Last-Event-ID` porque exigirían persistir y podar un registro de eventos para resolver huecos. También se descartó volver a consultar la API después de cada señal SSE: transportar la instantánea directamente elimina una segunda solicitud y sigue siendo pequeño para este establecimiento.

### 5. Compartir la sesión sin mezclar el panel con la administración

La pantalla vivirá en `/cocina` y tendrá su propio componente React. Las rutas de datos, mutaciones y SSE usarán `auth.requireAdmin`, de modo que la cookie actual autoriza ambas áreas. Al crear una sesión, autenticación calculará su caducidad en la siguiente medianoche local en vez de sumar ocho horas; la cookie y el registro en memoria compartirán ese vencimiento. El middleware expondrá a la ruta SSE la caducidad validada y el stream se cerrará al vencer; el intento automático de reconexión recibirá `401` y devolverá el panel al acceso. Si la consulta inicial devuelve `401`, el panel mostrará el mismo flujo de contraseña mediante `/api/sesion`; una sesión ya abierta en `/admin` funcionará sin otro acceso.

Se descartó anidar el panel en `/admin` porque cocina necesita una pantalla operativa dedicada, pero no se introduce otra política de autenticación ni otro tipo de cuenta.

### 6. Organizar el panel por columnas y confirmar acciones terminales

React presentará un menú superior con accesos a Recibidos, En preparación, Servidos y Cancelados. Cada destino corresponderá a una columna separada; en una tablet estrecha el menú permitirá llevar la columna elegida al área visible sin perder las demás ni su actualización. Recibidos y En preparación usarán orden ascendente; Servidos y Cancelados, descendente.

Los controles visibles dependerán del estado: iniciar para `recibido`, servir para `en_preparacion` y cancelar sólo para `recibido`; el servidor seguirá siendo la autoridad. Servir y cancelar abrirán una confirmación explícita y no enviarán la solicitud si se rechaza. Ninguna pantalla solicitará motivo de cancelación. Cada tarjeta mostrará recepción y los timestamps aplicables de preparación, servicio o cancelación. React calculará además el tiempo principal desde `creadoEn` y actualizará las etiquetas con un temporizador local, sin red.

### 7. Emitir avisos nuevos o recuperados dentro del navegador

El sonido se generará con la API de audio del navegador para un evento `pedido_nuevo` cuyo número no se haya avisado durante esa sesión de pantalla y para cada activo desconocido encontrado en el primer `snapshot` posterior a una desconexión. La instantánea inicial de una carga nueva establecerá la línea base sin sonar; `pedidos_actualizados` y pedidos ya conocidos tampoco sonarán. Los errores de reproducción se absorberán y nunca impedirán aplicar la instantánea visual.

Se descartó incluir un archivo o biblioteca de audio porque un tono breve generado localmente satisface el aviso simple sin activos ni dependencias nuevas.

### 8. Probar por escenario y en las capas donde se aplica cada regla

Las pruebas de servicio/API cubrirán migración, límites del día, orden, autorización, transiciones, cancelación, conflictos concurrentes y publicación SSE. Las pruebas React cubrirán renderizado de la cola y el histórico, controles, tiempo local, reconciliación, reconexión y sonido bloqueado. Cada prueba conservará en su nombre el escenario correspondiente de la spec; las pruebas SSE cerrarán explícitamente sus conexiones para no dejar la suite pendiente.

## Risks / Trade-offs

- [Reconstruir una tabla con líneas relacionadas puede perder datos si se hace con llaves foráneas activas] → ejecutar la copia en una transacción, verificar conteos y `foreign_key_check`, y abortar sin reemplazar la tabla ante cualquier diferencia.
- [Un proceso reiniciado pierde los suscriptores y eventos en memoria] → `EventSource` reconecta y recibe una instantánea completa desde SQLite; no se depende del historial de eventos.
- [Una segunda instancia de Node.js no compartiría eventos] → mantener el despliegue de una sola instancia fijado por el contexto; documentar que escalar horizontalmente exigiría otro diseño.
- [Una sesión llega a medianoche mientras SSE está conectado] → cerrar el stream exactamente al vencer, dejar que la reconexión reciba `401` y conservar los activos para la siguiente sesión.
- [El navegador puede bloquear audio sin interacción previa] → tratar el sonido como mejora no bloqueante y mantener siempre el cambio visual.
- [La hora local del servidor puede estar mal configurada] → calcular todos los límites en un único helper y documentar que el proceso debe ejecutar con la zona horaria local del establecimiento.
- [Enviar una instantánea completa en cada cambio aumenta el tamaño del evento] → aceptar el costo por la escala de una cafetería; a cambio se simplifican reconexión, idempotencia y consistencia.

## Migration Plan

1. Antes de desplegar, conservar una copia recuperable del único archivo SQLite.
2. Al arrancar, detectar el esquema anterior y reconstruir `pedidos` de forma transaccional con los tres estados y `en_preparacion_en`, `servido_en` y `cancelado_en`, preservando identificadores, `mesa_id`, claves de idempotencia, fechas y líneas.
3. Recrear los índices, reactivar llaves foráneas y ejecutar `foreign_key_check`; si algo falla, abortar el arranque y mantener o restaurar la base previa.
4. Desplegar las rutas y la interfaz sólo después de que la migración termine; los pedidos existentes quedan como `recibido` y no cancelados.
5. Para revertir la aplicación, volver al binario anterior sin ejecutar una migración destructiva: SQLite tolerará las columnas adicionales y el código anterior seguirá creando pedidos `recibido`. Los pedidos ya avanzados se conservan; si la versión anterior resultara incompatible en pruebas de despliegue, restaurar la copia previa.
