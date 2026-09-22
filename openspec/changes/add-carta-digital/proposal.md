# Proposal

## Why

La Estación depende de cartas plastificadas que se desactualizan y obligan al cliente a consultar información incompleta. Se necesita una carta web pública, rápida y accesible que el dueño pueda mantener desde su celular sin recopilar datos de los clientes.

## What Changes

- Incorporar una carta digital pública, accesible mediante un QR único por mesa y sin autenticación, que presente categorías y platos en el orden definido por el dueño.
- Mostrar en cada plato nombre, precio en pesos mexicanos con centavos, descripción breve, foto opcional y, sólo cuando existan, sus alérgenos declarados del catálogo obligatorio de 14.
- Incorporar una administración protegida por la sesión del establecimiento para crear, editar, ordenar, archivar y restaurar categorías y platos, así como cargar fotografías con validación de tamaño.
- Archivar una categoría junto con todos sus platos, sin borrarlos definitivamente, y conservar las fotografías de los platos archivados para que se puedan restaurar y para futuras referencias históricas.
- Cargar de inmediato el contenido completo de texto de la carta y diferir las fotografías fuera del área visible hasta que el cliente se desplace hacia ellas.
- Excluir cuentas o registros de clientes finales, panel de cocina, creación de pedidos, idiomas adicionales y precios por horarios.

### Decisiones de negocio — 22 de septiembre de 2026

- Archivar una categoría archiva también todos sus platos; restaurarla restaura la categoría y esos platos. No existe eliminación definitiva de categorías, platos ni sus fotografías.
- Las categorías vacías no se muestran en la carta pública.
- Cada mesa tendrá un QR con un identificador único de mesa. Este cambio conserva dicho identificador en la consulta de carta para el futuro flujo de pedidos, pero no crea pedidos ni recopila datos del cliente.
- La carga de foto se limita a 5 MB por archivo y la fotografía se conserva al archivar su plato.
- Si un plato tiene alérgenos declarados, se muestran de forma visible; si no tiene alérgenos declarados, no se muestra ninguna leyenda de alérgenos.
- La carta muestra todos los platos y sus datos desde el inicio; las fotografías fuera de la parte superior visible se cargan de forma diferida al desplazarse el cliente.
- Los precios se muestran en pesos mexicanos con dos decimales y no incluyen una leyenda sobre IVA.
- El dueño define desde la administración el orden de categorías y de platos dentro de cada categoría.

## Capabilities

### New Capabilities

- `carta-digital-publica`: consulta anónima, accesible y rápida de la carta desde un QR de mesa, con orden administrado, precios con centavos, alérgenos declarados y fotografías de carga diferida.
- `administracion-catalogo`: gestión protegida desde móvil de categorías, platos, orden manual, archivado/restauración y fotografías del establecimiento.

### Modified Capabilities

- Ninguna.

## Impact

- Nuevo frontend React público y vistas administrativas optimizadas para móvil.
- Nuevos endpoints Express públicos y protegidos por la sesión existente del establecimiento.
- Persistencia SQLite de categorías, platos, alérgenos, orden, estado de archivado y metadatos de fotos; los platos archivados y sus imágenes se deben poder restaurar.
- Generación local de QR únicos para mesas, sin servicios externos ni creación de pedidos en este cambio.
- Suite automatizada con cobertura trazable de los escenarios definidos en las especificaciones.
