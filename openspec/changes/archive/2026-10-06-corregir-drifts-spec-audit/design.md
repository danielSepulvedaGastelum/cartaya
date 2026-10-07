# Design

## Context

Véase [proposal.md](proposal.md) para los once hallazgos y las decisiones propuestas. El proyecto ya contiene las cinco capacidades vivas y no tenía cambios activos al iniciar esta propuesta.

La revisión y las reproducciones previas localizaron estos puntos concretos:

- `CartaPublica.jsx` conserva solo una clave en `intento`, la borra ante cualquier excepción y no consume `error.body`, aunque `api.js` ya lo expone. El resumen depende de `!confirmado`, no existe una transición para otro pedido y las notas del resumen dependen de `especial`.
- `pedidos.js` calcula las líneas vigentes pero prioriza la respuesta de no disponibilidad sobre los cambios de precio; busca reintentos por `mesa` textual. `database.js` impone `UNIQUE(mesa, clave_idempotencia)` y `mesas.js` añade y rellena `mesa_id` después de crear la base.
- `auth.js` guarda sesiones en memoria. El cierre borra el token, mientras `cocina.js` conserva suscriptores y temporizadores hasta desconexión o medianoche.
- Las acciones de disponibilidad existen en catálogo, API y Productos; la omisión es su contrato administrativo. Hay literales dañados en administración y mensajes de errores.
- Los 89 tests pasan; solo tres prueban el cliente de pedidos. La medición actual de rendimiento corre en jsdom con `fetch` simulado, por lo que no demuestra el presupuesto de la carta compilada.

## Goals / Non-Goals

**Goals:**

- Resolver los defectos en sus capas correspondientes, manteniendo contratos compatibles y operaciones atómicas.
- Conservar identidad de líneas, mesas y pedidos durante reconciliación y migración.
- Convertir cada hallazgo en evidencia verificable: regresiones de API, interfaz, persistencia y navegador.

**Non-Goals:**

- Persistir carritos o intentos entre recargas, implementar seguimiento público de pedidos o introducir cuentas.
- Reescribir arquitectura, agregar polling o ampliar las funciones de cocina.
- Reparar automáticamente pedidos históricos ya duplicados, modificar contenido capturado por el dueño o reescribir el historial archivado de OpenSpec.
- Desplegar o migrar una base real durante la implementación local.

## Decisions

### 1. Representar explícitamente el ciclo del pedido en el cliente — H1, H2, H4

Mantener estados de edición, envío, resultado incierto y confirmación. El intento guarda clave y una copia inmutable del payload enviado, además del bloqueo inmediato que evita dos envíos antes del siguiente render. Todos los controles que mutan líneas, incluido un panel abierto, quedan bloqueados durante envío y resultado incierto. El reintento es manual, reutiliza exactamente el payload y no genera otra clave.

Un error de transporte, una respuesta 5xx sin garantía de no escritura o una respuesta exitosa incompleta se considera incierta. `api.js` debe distinguir la imposibilidad de leer una respuesta de un rechazo válido y el cliente debe validar que una confirmación contiene los datos necesarios antes de vaciar el carrito. Solo una respuesta de éxito o un rechazo conocido que garantice ausencia de registro termina el intento. Un conflicto de reutilización de clave no debe tratarse como permiso para crear otra confirmación silenciosamente. No habrá reintentos automáticos ilimitados.

Para `no_disponible` y `precio_modificado`, reconciliar por `lineaId`, conservar identidad, cantidad, nota y naturaleza independiente, retirar todas las líneas de platos no disponibles y tomar del servidor los precios vigentes. Extender de forma compatible la respuesta de no disponibilidad para incluir también los precios modificados de las líneas conservadas. Recalcular el total desde esas líneas, actualizar precios y retirar platos en la carta local, cerrar o invalidar un panel que apunte a un plato retirado y anunciar nombres, causas e importes modificados mediante un mensaje accesible. Si una categoría queda vacía, ocultarla. No reenviar hasta otra confirmación explícita; si no quedan líneas, mostrar cero e impedir el envío.

Tras éxito, ocultar o bloquear los selectores y mostrar «Hacer otro pedido». Esa acción vuelve a consultar la carta para obtener catálogo y estado de mesa vigentes antes de abrir un carrito vacío con un intento nuevo. Si la consulta falla, conservar la confirmación y permitir reintentar la consulta; si la mesa está inactiva, pasar a consulta sin controles.

Se descarta borrar siempre la clave porque duplica pedidos tras respuestas perdidas. Se descarta permitir editar mientras el resultado es incierto porque un mismo identificador ya podría representar otro contenido registrado. Se descarta reenviar automáticamente cambios de precio porque el cliente debe aceptar el nuevo total.

### 2. Idempotencia por `mesa_id` y migración conservadora — H3

La clave operativa será `(mesa_id, clave_idempotencia)`; `mesa` seguirá siendo la instantánea del nombre mostrado al confirmar. La resolución del QR identifica la mesa aunque esté inactiva. Después de validar la forma del payload, buscar el intento existente por identidad y comparar el hash: devolverlo si coincide, rechazar si difiere. Solo para un intento no existente, exigir mesa activa y validar disponibilidad y precios antes de insertar. Así, desactivar una mesa bloquea pedidos nuevos pero no impide recuperar la confirmación de uno registrado.

La migración debe detectar el esquema de unicidad independientemente de `cancelado_en`; la migración de cocina existente no cubre este cambio. Ordenar explícitamente el arranque: crear/actualizar esquema base y cocina, preparar mesas y asociación heredada, migrar la unicidad, y finalmente crear servicios que atienden peticiones. El relleno heredado debe ejecutarse una sola vez como migración identificada, no reasignar en cada arranque registros por nombres que pudieron reutilizarse.

Reconstruir `pedidos` para retirar la restricción anterior, conservando columnas conocidas, identificadores, marcas horarias, claves, hashes, referencias, índices pertinentes y el máximo histórico de `sqlite_sequence`. Crear un índice único parcial de `(mesa_id, clave_idempotencia)` para filas con mesa asociada. Para registros heredados sin asociación comprobable, preservar `mesa_id` nulo y su información, con unicidad heredada por nombre e intento limitada a esas filas; no adivinar su identidad ni devolverlos a otra mesa por coincidencia de nombre. Registrar esta limitación de datos heredados para revisión explícita.

Antes de reconstruir, detectar duplicados de la nueva clave y referencias inválidas. Si existen, abortar con identificadores de los registros en conflicto y conservar los datos: ni fusionar ni borrar pedidos, incluso si comparten hash. Hacer copia y cambio de tabla en una transacción, controlar llaves foráneas fuera de ella cuando SQLite lo requiera, comprobar conteos, contenido e integridad antes de confirmar y restaurar siempre la verificación de llaves. Probar reapertura e idempotencia de la migración tanto desde el esquema anterior a cocina como desde el actual.

Se descarta actualizar el nombre histórico para mantener unicidad porque alteraría el historial. Se descarta conservar simultáneamente la restricción global antigua porque dos mesas distintas pueden reutilizar un nombre en fechas distintas y quedar acopladas incorrectamente.

### 3. Editar notas sin confundir el selector normal — H6, H7

Mostrar edición de indicaciones para cualquier línea y mantener la advertencia visible asociada al resumen, además del panel. Los límites se validan tanto al capturar como al enviar y los controles anuncian el límite de cantidad cuando corresponda.

Cuando una línea normal adquiere una nota no vacía, conservar su `id`, cantidad y precio y convertirla en independiente (`especial`). El selector normal queda en cero aunque el contador total de la tarjeta siga sumando esa línea; el siguiente incremento crea una nueva línea normal. Una independiente con nota vacía sigue siendo independiente y conserva sus controles. Esta transición se hace atómicamente en el estado de React y no combina notas iguales.

Se descarta dejar una línea con nota como normal porque el selector de tarjeta tiene el contrato de modificar únicamente la línea sin indicaciones. Tampoco se fusionarán líneas, pues cada captura representa una selección independiente.

### 4. Asociar suscripciones SSE a la sesión — H5

Agregar al servicio de autenticación un registro de callbacks de revocación por token, con alta y baja explícitas y sin exponer el token en respuestas. El middleware entrega a la ruta autenticada una referencia o función para registrar la conexión. Al revocar, invalidar primero la sesión y cerrar sus conexiones antes de responder al logout; ejecutar todos los callbacks aunque alguno falle. Registrar una conexión en una sesión ya revocada debe cerrarla inmediatamente.

El cierre de una respuesta SSE elimina el suscriptor de pedidos, callback de sesión y temporizadores una sola vez. Mantener el cierre a medianoche. El panel reutiliza la comprobación de sesión al interrumpirse el stream; ante 401 cierra EventSource, limpia la vista y vuelve al acceso. Los demás tokens no se revocan. Probar dos conexiones con una sesión y una tercera con otra.

Se descarta comprobar la sesión mediante polling porque el servidor conoce el instante de revocación. Se descarta una desconexión global porque otras sesiones continúan siendo válidas.

### 5. Documentar disponibilidad y corregir textos propios — H8, H9

La delta de `administracion-catalogo` formaliza los controles actuales sin cambiar su modelo: disponibilidad y archivado son independientes. Verificar que marcar disponible no restaura categorías ni platos y que archivar/restaurar conserva el indicador temporal. La ocultación pública se comprueba en una nueva consulta y la validación del pedido protege una carta ya abierta; no se añade un canal SSE para catálogo.

Corregir los literales propios dañados en `Admin.jsx`, `app.js`, `pedidos.js` y fixtures afectados, usando UTF-8. Las aserciones deben esperar textos legibles como «Administración», «Contraseña», «Alérgenos» y mensajes de revisión, no normalizar una salida dañada para hacerla pasar. No aplicar una recodificación masiva a datos de SQLite ni a contenido ingresado por usuarios.

Los títulos dañados que ya existen en specs vivas se registran como alias en la matriz de trazabilidad junto al título legible. Las deltas MODIFIED conservan los encabezados exactos necesarios para el emparejamiento; este cambio no renombra masivamente requisitos ni altera documentos archivados. La corrección editorial de un título deberá realizarse explícitamente al sincronizar si se necesita, conservando la correspondencia y sin cambiar su significado.

### 6. Cobertura por comportamiento y capa — H10

Crear `docs/trazabilidad-specs.md` durante implementación: capacidad, requisito, escenario vigente o de la delta, prueba y capa, evidencia observable y limitación conocida. Cubrir las cinco capacidades, incluidos los 82 escenarios originales y los añadidos; las pruebas deben conservar el nombre de escenario o su correspondencia exacta documentada cuando exista codificación dañada. Una prueba puede cubrir varias condiciones, pero no basta un título para afirmar que prueba una interfaz.

En `tests/pedidos-client.test.jsx`, cubrir confirmación, retiro, precio, combinación de conflictos, vacío, límites, nota y privacidad, doble toque, resultado incierto, reintento del payload y segundo pedido. En API, comprobar persistencia e idempotencia después de renombrar, desactivar, reabrir una base y reutilizar nombres entre mesas. En cocina, comprobar revocación real del stream y cierre de recursos además del regreso al acceso en React. Completar administración de mesas: navegación, confirmación de desactivación, reactivación, historial, estabilidad y descarga de QR, y vista inactiva.

Agregar recorridos de navegador contra servidor real y SQLite temporal para los fallos de pedidos, incluidos respuesta perdida después del commit y dos pedidos consecutivos. Nunca usar la base configurada para operación real. No reducir los contratos de las specs para acomodarlos a los tests existentes. La matriz debe distinguir «cubierto», «parcial» y «pendiente de validación física» cuando corresponda.

Se conserva Vitest por su rapidez en reglas y componentes. Las pruebas completas de navegador complementan la cobertura donde intervienen red y renderizado; no sustituyen las aserciones de persistencia.

### 7. Medir el build real en navegador — H11

Agregar `@playwright/test` únicamente como dependencia de desarrollo, con versión compatible con Node 22 fijada por el lockfile, y usar su Chromium para automatizar navegador y condiciones de red/CPU. La justificación es ejecutar el build servido por Express, observar solicitudes de recursos y medir pintura y recorrido completos; jsdom no descarga ni renderiza como un navegador. No se agrega una dependencia al producto ni se usa Vite dev como medición de producción.

Definir un perfil reproducible de aceptación en `docs/rendimiento-carta.md`: viewport de 390 × 844, caché fría, descarga de 4 Mbps, subida de 1 Mbps, latencia configurada de 150 ms, CPU ralentizada 4 veces y sin otros tests en paralelo. Sembrar un fixture fijo de 6 categorías y 30 platos, con precios, descripciones y alérgenos representativos; usar imágenes WebP locales de dimensiones y bytes registrados y al menos dos fotos fuera del área visible y de su margen de precarga. Guardar versión de navegador, sistema, CPU del equipo, fixture, bytes transferidos y configuración exacta junto con resultados.

Medir desde el inicio de navegación hasta que el texto útil superior de carta (categoría y nombre, descripción y precio del primer plato) esté renderizado y listo para verse, corroborado con traza o captura; no usar únicamente una respuesta de API ni un selector oculto. Incluir todos los recursos reales HTML, CSS, JavaScript, API y fotos pertinentes. Ejecutar cinco cargas frías independientes y exigir menos de 2000 ms en cada una bajo ese perfil; conservar los valores individuales. Verificar que las fotos claramente fuera del área inicial no se solicitan antes de acercarse a ellas y sí aparecen al desplazarse.

Este perfil aproxima condiciones móviles y no certifica cualquier teléfono. Añadir una comprobación en celular de gama media con 4G, registrando modelo, navegador, condiciones y tiempos; si no se dispone del equipo, dejar esa evidencia pendiente y no declarar cumplido el criterio físico. La prueba actual de jsdom puede conservarse como prueba funcional de carga progresiva con nombre que refleje su alcance, sin presentarla como medición de 4G.

Se descarta una espera simulada como indicador de rendimiento. Se descarta reducir arbitrariamente el fixture o elevar el umbral para aprobar: si falla, localizar el cuello de botella y corregirlo conservando el contrato.

## Risks / Trade-offs

- [Duplicados heredados o identidad desconocida] → Diagnóstico previo, abortar colisiones de identidad estable, preservar huérfanos sin asignarlos por suposiciones y no borrar datos automáticamente.
- [Migración de tabla rompe relaciones o numeración] → Transacción, copia verificada, preservación de secuencia, revisión de llaves e índices y pruebas desde dos esquemas históricos.
- [Resultado incierto mantiene el carrito bloqueado] → Mensaje claro y reintento manual del mismo envío; mantener el alcance efímero y advertir que recargar pierde ese contexto, sin prometer recuperación persistente.
- [Recursos SSE quedan vivos o se afecta otra sesión] → Limpieza idempotente, revocación por token y pruebas de aislamiento y ausencia de eventos posteriores.
- [Resultados de rendimiento dependen del equipo] → Perfil y fixture fijos, ejecuciones aisladas, evidencia por corrida y distinción expresa entre emulación y dispositivo físico.
- [Pruebas o nombres dañados ocultan problemas de texto] → Aserciones de salida legible y trazabilidad con alias explícitos; no normalizar silenciosamente resultados del producto.

## Migration Plan

1. En implementación local, reproducir los fallos en fixtures y agregar regresiones; implementar y validar la migración en copias temporales de los esquemas previos.
2. Preparar respaldo consistente de SQLite antes de cualquier despliegue posterior y ejecutar el diagnóstico de duplicados e identidad heredada sobre una copia. Resolver conflictos de datos por decisión explícita antes de migrar una base real.
3. Desplegar servidor y cliente compatibles en una ventana controlada; la migración de unicidad se ejecuta antes de aceptar pedidos y aborta sin aplicar cambios parciales si falla. Documentar que reiniciar el servidor pierde las sesiones en memoria, como actualmente.
4. Verificar historial, QR, reintentos, pedido adicional y revocación SSE, y repetir la auditoría contra specs vigentes más deltas. Sincronizar y archivar únicamente en sus workflows, después de completar las tareas y validar el resultado.
5. Si falla antes de nuevas escrituras, restaurar la copia consistente y el binario anterior. Si ya existen pedidos nuevos, conservar base y registros y preferir corrección hacia adelante; no restaurar un respaldo antiguo ni reintroducir la unicidad por nombre perdiendo pedidos. Preparar cualquier reversión de datos como operación separada y revisable.
