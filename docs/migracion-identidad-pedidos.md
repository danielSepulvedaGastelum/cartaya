# Migración de identidad de pedidos

Antes de actualizar una instalación, detener escrituras y crear un respaldo consistente de SQLite (API de backup de SQLite o `VACUUM INTO` sobre una copia abierta). Conservar también los archivos WAL/SHM hasta verificar el respaldo; no copiar solo el archivo principal mientras hay escrituras.

El arranque prepara esquema base y cocina, crea mesas, asocia una vez los pedidos heredados cuyo nombre de mesa coincide con una mesa inicial, diagnostica referencias y colisiones, y reconstruye `pedidos` dentro de una transacción. Los índices parciales identifican la migración terminada. La llave foránea se deshabilita antes de la transacción y se restaura en `finally`; `foreign_key_check` y comparacion por columna verifican la copia antes de confirmar.

Si dos filas se asocian al mismo `(mesa_id, clave_idempotencia)`, o hay una referencia de mesa invalida, el arranque aborta con los IDs implicados. No fusionar, borrar ni reasignar pedidos automáticamente. Resolver esos casos sobre una copia y con decisión explícita sobre la identidad real. Los pedidos sin mesa comprobable conservan `mesa_id` nulo y el nombre histórico; reutilizar ese nombre no los asocia a la mesa nueva.

Ensayo local: restaurar el respaldo en una ruta temporal, iniciar el servidor contra esa copia, revisar `PRAGMA foreign_key_check`, recuentos de `pedidos` y `pedido_lineas`, secuencia, índices, historial y reintentos tras renombrar o desactivar; reiniciar contra la misma copia para comprobar que no hay una segunda migración. Los fixtures de `tests/drift-api.test.js`, `tests/cocina-migracion.test.js` y `tests/migracion-backup.test.js` ejercitan colision, rollback, filas huerfanas, índices, secuencia y reapertura sin tocar datos reales.

Si la migración falla antes de nuevas escrituras, mantener el binario anterior y restaurar el respaldo consistente. Si ya se registraron pedidos con el esquema nuevo, conservar esa base y avanzar con una correccion; restaurar una copia anterior perdería pedidos. Cualquier reversión de datos requiere un procedimiento separado y revisable.
