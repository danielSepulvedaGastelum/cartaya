# Design

## Context

El repositorio sólo contiene la configuración de OpenSpec; todavía no hay aplicación ni especificaciones vivas. Véanse la propuesta y especificaciones de este cambio para el contrato de comportamiento. La implementación debe usar Node.js 22, Express, SQLite mediante better-sqlite3 y React 19 con Vite; debe servirse desde el mismo proceso Express y funcionar cómodamente desde celular.

## Goals / Non-Goals

**Goals:**

- Publicar una carta anónima rápida, accesible y coherente con el catálogo administrado.
- Conservar categorías, platos y fotografías archivados para poder restaurarlos y preservar futuros historiales.
- Mantener el identificador único de mesa del QR disponible para el futuro pedido, sin crear pedidos ahora.
- Cargar el contenido textual completo de la carta con prioridad y diferir fotografías fuera de la parte superior visible.

**Non-Goals:**

- No se crearán pedidos, mesas administrables, panel de cocina ni asociaciones de un cliente con una persona.
- No se implementarán cuentas de clientes, idiomas, precios por horario, multiestablecimiento ni control de inventario.
- No se incluirá un servicio externo de imágenes, QR ni almacenamiento en la nube.

## Decisions

### Modelo relacional y archivado reversible

Se crearán tablas `categorias`, `platos`, `alergenos` y `plato_alergenos`. Categorías y platos tendrán orden manual y estado de archivado; los platos conservarán su categoría y los metadatos de su fotografía. Al archivar una categoría, una transacción archivará también todos sus platos; al restaurarla, restaurará los platos archivados en esa misma operación. No habrá borrado físico de categorías, platos ni fotografías.

El precio se almacenará como entero en centavos y se formateará con dos decimales. El catálogo de alérgenos conservará los 14 valores establecidos; una relación vacía significa que no se mostrará información de alérgenos al cliente, no una afirmación de ausencia de riesgo.

Se prefiere el archivado reversible al borrado porque preserva datos e imágenes para futuras referencias históricas. Una categoría sin platos activos no se incluirá en la consulta pública.

### QR único por mesa sin flujo de pedido

Cada QR se generará localmente con una URL de carta que incluye un identificador opaco de mesa. La carta conservará ese identificador en la URL, pero no realizará pedidos, seguimiento ni persistencia de actividad del cliente. Un archivo de configuración de mesas alimentará una utilidad local que genere los QR imprimibles.

Se añadirá la dependencia `qrcode`, justificada para generar QR locales sin exponer las URL a un servicio externo ni incorporar una plataforma de terceros. La gestión de mesas y el consumo del identificador al crear un pedido se posponen al cambio de pedidos.

### Rutas y protección de sesión

Express expondrá rutas de lectura pública separadas de rutas administrativas. Las rutas administrativas requerirán una sesión basada en una única contraseña de establecimiento, configurada fuera de datos accesibles al cliente, y la cookie de sesión será `HttpOnly`, `SameSite=Lax` y `Secure` en producción. React tendrá vistas públicas y administrativas responsive, servidas como archivos estáticos por Express.

### Fotografías locales y carga diferida

Las fotografías se recibirán en rutas administrativas, validando tipo y tamaño antes de conservarlas en almacenamiento local; SQLite guardará metadatos y ruta pública. Se generará una versión WebP de dimensiones acotadas, sin eliminarla al archivar el plato. Se usarán `multer` para carga multipart y `sharp` para validar y transformar imágenes, dependencias necesarias para procesar de forma segura los archivos y cumplir el presupuesto de carga.

La consulta pública entregará desde el inicio categorías, platos y datos textuales completos. Las imágenes fuera del área visible inicial usarán carga diferida y sólo se solicitarán al acercarse al viewport. Así se preserva la carta completa mientras se prioriza la parte superior en 4G.

## Risks / Trade-offs

- [Restaurar una categoría puede reactivar varios platos] → La administración mostrará cuántos platos se restaurarán antes de confirmar.
- [Las fotografías pueden crecer el almacenamiento local] → Se limitarán a 5 MB, se transformarán a WebP y se conservarán para archivado/restauración con rutina de respaldo documentada.
- [El identificador de mesa puede anticipar el futuro flujo de pedidos] → Sólo viaja en la URL; no se registra ni activa operaciones de pedido en este cambio.
- [El objetivo de dos segundos depende de red y dispositivo] → La carga inicial priorizará texto y fotos visibles, y las demás imágenes se diferirán con un presupuesto reproducible.

## Migration Plan

1. Crear el esquema SQLite, sembrar el catálogo canónico de 14 alérgenos y configurar archivado reversible.
2. Configurar almacenamiento de medios, contraseña de establecimiento y lista de mesas para generar QR únicos.
3. Generar e imprimir los QR antes de publicarlos en las mesas.
4. Cargar y revisar el catálogo inicial desde administración, incluidos los alérgenos declarados y el orden elegido por el dueño.
5. Si se requiere reversión, retirar rutas y vistas públicas; conservar SQLite, QR y directorio de medios para no perder información archivada.
