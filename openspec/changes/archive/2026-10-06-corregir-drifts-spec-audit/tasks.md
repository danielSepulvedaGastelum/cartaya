# Tasks

## 1. Regresiones y trazabilidad inicial

- [x] 1.1 Crear `docs/trazabilidad-specs.md` para las cinco capacidades, los 82 escenarios vigentes y los añadidos por estas deltas; verificar que cada fila identifica escenario, prueba/capa, comportamiento comprobado y limitaciones, con alias explícitos para títulos dañados (H10).
- [x] 1.2 Añadir reproducciones de H1, H2 y H4 en `tests/pedidos-client.test.jsx`; verificar que detectan total obsoleto tras 409, clave diferente tras respuesta perdida y ausencia de confirmación del segundo pedido antes de corregir el cliente.
- [x] 1.3 Añadir regresiones de H3 y H5 en API y SSE; verificar que reproducen un pedido duplicado tras renombrar y entrega de eventos después de logout, usando solo bases y servidores de prueba.

## 2. Identidad de mesa y migración de idempotencia

- [x] 2.1 Implementar el diagnóstico de colisiones `(mesa_id, clave_idempotencia)` y referencias heredadas; verificar con fixtures que reporta los registros implicados sin borrar, fusionar ni reasignar pedidos por suposición (H3).
- [x] 2.2 Ordenar inicialización de mesas y migración de unicidad en `database.js`, `mesas.js` y `app.js`, con identificación persistente de la migración; verificar instalación nueva, actualización desde antes de cocina y actualización desde el esquema actual.
- [x] 2.3 Sustituir la unicidad por nombre mediante reconstrucción transaccional e índices parciales según diseño; verificar preservación de pedidos, líneas, índices, claves, hashes, estados, fechas, nombres históricos, secuencia y llaves foráneas, además de reapertura sin cambios (H3).
- [x] 2.4 Probar fallo de migración con colisiones y conservación de filas sin mesa comprobable; verificar rollback íntegro, restauración de llaves foráneas y ausencia de asociaciones nuevas al reiniciar o reutilizar un nombre.
- [x] 2.5 Buscar reintentos por identidad estable antes de exigir mesa activa para un pedido nuevo; verificar mismo número tras renombrar/desactivar, rechazo de contenido diferente, aislamiento entre mesas y ausencia de nuevos pedidos para mesas inactivas (H3).

## 3. Reconciliación y ciclo del intento

- [x] 3.1 Completar en `pedidos.js` las respuestas que combinan retiros y precios modificados conservando `lineaId`; verificar que el conflicto no escribe pedidos y devuelve todas las líneas restantes, causas e importes vigentes (H1).
- [x] 3.2 Distinguir en `api.js` respuestas válidas de fallos de transporte, JSON incompleto o resultados inciertos; verificar que una confirmación incompleta y un 5xx no hacen que el cliente descarte un intento pendiente (H2).
- [x] 3.3 Modelar en `CartaPublica.jsx` edición, envío, resultado incierto y confirmación, conservando clave y payload inmutable; verificar doble toque, bloqueo de todos los controles y reintento manual idéntico sin nuevas claves ni bucles automáticos (H2).
- [x] 3.4 Reconciliar conflictos por identidad de línea y actualizar catálogo local, panel abierto, contadores, subtotales, total y mensajes; verificar precio, archivado, agotado, conflicto combinado, líneas repetidas y pedido vacío, sin reenviar antes de otra acción explícita (H1).
- [x] 3.5 Agregar «Hacer otro pedido» y recargar carta/estado de mesa antes de habilitar un carrito vacío; verificar dos pedidos independientes desde la misma página, conservación del anterior y retorno a consulta si la mesa está inactiva (H4).
- [x] 3.6 Probar errores al consultar la carta para el segundo pedido y rechazos definitivos del envío; verificar que se conserva la confirmación o el carrito correspondiente y se ofrece una recuperación que no duplica registros.

## 4. Indicaciones y privacidad

- [x] 4.1 Permitir editar notas de todas las líneas y mantener visible la advertencia en el resumen; verificar edición con el panel cerrado, nota vacía, 140 caracteres aceptados y rechazo informado de 141, sin filtrar datos escritos por el cliente (H6–H7).
- [x] 4.2 Convertir una línea normal con nota en independiente conservando su identidad y cantidad; verificar que el siguiente incremento crea una línea sin indicaciones y que vaciar o repetir notas no fusiona líneas ni cambia importes (H7).
- [x] 4.3 Verificar selectores, eliminación, límites 0/1/20/21 y estados del envío con pruebas de componente; comprobar contadores agregados correctos, mensajes de límites y ausencia de edición durante envío o resultado incierto (H7, H10).

## 5. Revocación de sesiones SSE

- [x] 5.1 Registrar y desregistrar callbacks de revocación por sesión en `auth.js` y asociarlos a los streams de `cocina.js`; verificar que logout invalida la sesión y cierra sus canales antes de responder, incluso si un callback falla (H5).
- [x] 5.2 Hacer idempotente la limpieza de suscriptores y temporizadores al desconectar, vencer o revocar; verificar dos canales de una sesión, un tercero de otra y ausencia de eventos y recursos residuales después del cierre (H5).
- [x] 5.3 Verificar en `Cocina.jsx` el retorno al acceso después del cierre de canal y un 401, ajustarlo si hace falta; comprobar que desaparecen los pedidos, se detiene la reconexión y un nuevo login vuelve a recibir una instantánea (H5).

## 6. Catálogo, textos y cobertura vigente

- [x] 6.1 Cubrir los cinco escenarios de agotamiento administrativo de la delta mediante API y Productos; verificar acceso protegido, ocultación pública, reactivación y conservación independiente del archivado, datos y pedidos históricos (H8).
- [x] 6.2 Corregir los textos propios dañados en administración, respuestas de API y fixtures afectados; verificar etiquetas y mensajes legibles en español de México mediante aserciones sobre la salida real, sin recodificar datos del establecimiento (H9).
- [x] 6.3 Completar escenarios de mesas y navegación administrativa actualmente sin cobertura suficiente; verificar cambio de sección, renombrado, confirmación/cancelación de desactivación, reactivación, historial, descarga y estabilidad de QR, y vista inactiva (H10).
- [x] 6.4 Completar los restantes huecos de los escenarios vigentes en la matriz, incluidos consulta sin mesa, eliminación de líneas y alcance público; verificar que ninguna fila se marca cubierta únicamente por el nombre de un test y que las aserciones corresponden a la capa requerida (H10).

## 7. Navegador y rendimiento reproducible

- [x] 7.1 Agregar `@playwright/test` como dependencia de desarrollo con su configuración y comandos de ejecución documentados; verificar instalación compatible con Node 22, build servido por Express, base temporal y separación de los archivos de navegador respecto a Vitest (H10–H11).
- [x] 7.2 Crear recorridos completos de pedido con servidor real para precio cambiado, plato retirado, segundo pedido y pérdida de respuesta después de registrar; verificar importes visibles, nueva confirmación explícita y conteos reales de pedidos sin duplicados (H1–H4, H10).
- [x] 7.3 Crear fixture y perfil de rendimiento descritos en `design.md`, con métricas desde navegación y trazas de recursos; verificar cinco cargas frías con contenido útil renderizado en menos de 2000 ms cada una y fotos fuera del área inicial diferidas hasta el desplazamiento (H11).
- [x] 7.4 Renombrar o ajustar el test de jsdom para expresar su alcance funcional y documentar el protocolo en `docs/rendimiento-carta.md`; verificar que se registran equipo, navegador, fixture, red/CPU, tiempos y evidencia, diferenciando emulación de dispositivo físico (H11).
- [x] 7.5 Validar el criterio original en un celular de gama media con 4G y registrar modelo, navegador, condiciones y tiempos; mantener esta tarea pendiente si no hay dispositivo y no sustituir esa evidencia por jsdom o emulación (H11).

Nota de cierre (2026-10-06): el usuario confirma que realizó la prueba física con 4G y ordenó marcar esta tarea como terminada. No se conservaron modelo, navegador, condiciones detalladas, tiempos ni capturas; por ello no hay evidencia verificable del umbral de dos segundos.

## 8. Verificación integral y preparación de entrega

- [x] 8.1 Ejecutar build y suite completa con `npm test` (o `npm.cmd test` en PowerShell), además de los comandos de navegador y rendimiento definidos; verificar resultados sin omitir fallos y registrar por separado las limitaciones físicas pendientes.
- [x] 8.2 Documentar diagnóstico, respaldo consistente, orden de migración, casos que abortan y reversión antes/después de nuevas escrituras; verificar el procedimiento con una copia temporal y conservar todos los pedidos durante el ensayo (H3).
- [x] 8.3 Actualizar la matriz con evidencia final y repetir la verificación de implementación contra specs vigentes más deltas; verificar cierre de H1–H11 o señalar exactamente cualquier validación pendiente, sin sincronizar ni archivar automáticamente el cambio.
