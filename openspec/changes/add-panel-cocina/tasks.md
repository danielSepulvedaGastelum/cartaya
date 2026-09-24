# Tasks

## 1. Persistencia y consultas diarias

- [ ] 1.1 Ampliar el esquema de `pedidos` a `recibido`, `en_preparacion` y `servido`, añadir `en_preparacion_en`, `servido_en` y `cancelado_en`, y crear una migración transaccional que preserve pedidos, `mesa_id`, líneas e índices; verificar con una prueba sobre un archivo SQLite con datos previos, timestamps nulos, conteos iguales y `PRAGMA foreign_key_check` vacío.
- [ ] 1.2 Ampliar la serialización y crear consultas que mantengan todos los activos sin filtro de fecha y separen Servidos y Cancelados por su día local de finalización; verificar con pruebas llamadas `Cocina consulta pedidos activos ordenados`, `Pedido pendiente de otro día permanece en la cola`, `Cocina consulta el histórico del día`, `Pedido anterior termina durante la jornada actual` y `Pedido activo no aparece en el histórico`.

## 2. Reglas de dominio y API protegida

- [ ] 2.1 Implementar las acciones atómicas iniciar y servir mediante actualizaciones condicionadas que registren una sola vez `en_preparacion_en` y `servido_en`, con conflictos `404`/`409`; verificar con pruebas llamadas `Cocina comienza un pedido recibido`, `Cocina sirve un pedido en preparación`, `Cocina intenta una transición inválida` y `Dos pantallas avanzan el mismo pedido`.
- [ ] 2.2 Implementar la cancelación condicionada de pedidos `recibido`, conservando estado y líneas, registrando sólo el primer `cancelado_en` y sin campo de motivo; verificar con pruebas llamadas `Cocina cancela un pedido recibido`, `Cocina intenta cancelar después de iniciar la preparación` y `Cocina intenta cancelar otra vez`.
- [ ] 2.3 Añadir el router `/api/cocina` detrás de la sesión compartida y cambiar la caducidad de esa sesión a la siguiente medianoche local, exponiéndola para cerrar SSE; verificar con pruebas llamadas `Sesión del establecimiento abre el panel`, `Persona sin sesión intenta consultar el panel` y `Sesión cubre la jornada completa` que cubran acceso antes y después de medianoche.

## 3. Actualización mediante SSE

- [ ] 3.1 Incorporar al servicio de pedidos el registro y limpieza de suscriptores y publicar `pedido_nuevo` sólo tras una confirmación no idempotente y `pedidos_actualizados` tras cada mutación confirmada; verificar con pruebas de servicio que un reintento de confirmación no vuelve a notificar y que un conflicto no publica eventos.
- [ ] 3.2 Implementar `/api/cocina/eventos` con encabezados SSE, `snapshot` inicial, instantáneas completas, mantenimiento, cierre al desconectar y cierre al caducar la sesión; verificar que una prueba de stream recibe el formato esperado y termina sin manejadores ni temporizadores pendientes.
- [ ] 3.3 Añadir pruebas de integración llamadas `Pedido confirmado aparece solo`, `Cambio de pedido se refleja en otros paneles` y `Panel se recupera de una desconexión`, verificando las cuatro colecciones ordenadas, ausencia de duplicados e instantánea vigente al reconectar.

## 4. Panel React para tablet

- [ ] 4.1 Crear la pantalla `/cocina`, reutilizar `/api/sesion`, cargar la instantánea antes de abrir `EventSource` y volver al acceso ante `401` o vencimiento de medianoche; verificar que una sesión administrativa existente entra directamente, una visita sin sesión muestra el formulario y los pedidos activos siguen presentes tras iniciar la nueva jornada.
- [ ] 4.2 Renderizar un menú superior y columnas separadas Recibidos, En preparación, Servidos y Cancelados con número, mesa, líneas, notas, horas aplicables y acciones, además de estilos táctiles accesibles; verificar con pruebas llamadas `Panel utilizable en tablet`, `Cocina navega entre todos los estados operativos`, `Bebidas y alimentos avanzan juntos`, `Cocina consulta pedidos activos ordenados` y `Cocina consulta el histórico del día`.
- [ ] 4.3 Calcular localmente el tiempo desde la confirmación y exigir confirmación antes de enviar servir o cancelar, sin solicitar motivo; verificar con temporizadores y pruebas llamadas `Tiempo transcurrido avanza sin polling`, `Cocina no confirma que el pedido fue servido` y `Cocina no confirma la cancelación` que rechazar el diálogo no realiza solicitudes.
- [ ] 4.4 Integrar `snapshot`, `pedido_nuevo` y `pedidos_actualizados`, reconciliar las cuatro colecciones por número y mostrar un aviso desde la desconexión hasta recibir una instantánea vigente; verificar con pruebas llamadas `Pedido confirmado aparece solo`, `Cambio de pedido se refleja en otros paneles`, `Panel avisa mientras está desconectado` y `Panel se recupera de una desconexión`.
- [ ] 4.5 Generar un tono breve para `pedido_nuevo` y para cada activo desconocido recuperado tras desconexión, recordar números ya presentados y absorber bloqueos de audio; verificar con pruebas llamadas `Llega un pedido después de abrir el panel`, `Reconexión recupera un pedido no visto` y `El navegador bloquea el aviso sonoro` que la carga inicial, pedidos conocidos y cambios de estado no suenan.

## 5. Verificación integral

- [ ] 5.1 Revisar la trazabilidad y confirmar que cada escenario de `specs/panel-cocina/spec.md` tiene una prueba automatizada con el mismo nombre; verificar ejecutando la selección de pruebas de base de datos, API, SSE y cliente sin omisiones ni conexiones abiertas.
- [ ] 5.2 Ejecutar `npm test` y `openspec validate add-panel-cocina --strict`, corregir cualquier regresión o incumplimiento y verificar que ambas órdenes finalizan correctamente sin añadir dependencias de producción.
