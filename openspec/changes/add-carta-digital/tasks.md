# Tasks

## 1. Base de la aplicación y configuración segura

- [x] 1.1 Crear la estructura del proyecto Node.js 22 con Express, React 19 y Vite, incluyendo scripts de desarrollo, compilación y pruebas; verificar que `npm run build` complete correctamente y que Express sirva los estáticos generados.
- [x] 1.2 Configurar archivo de entorno documentado para la contraseña del establecimiento, base SQLite, directorio local de medios y lista de mesas; verificar que ningún secreto se exponga en el cliente ni se incluya en control de versiones.
- [x] 1.3 Agregar y configurar `multer`, `sharp` y `qrcode` para carga de imágenes, optimización y generación local de QR; verificar que la instalación y las pruebas de arranque funcionen con Node.js 22.

## 2. Persistencia y QR de mesa

- [x] 2.1 Implementar el esquema SQLite para categorías, platos, alérgenos y relación plato-alérgeno, con precio en centavos, orden manual y archivado reversible; verificar con pruebas de repositorio que se siembren exactamente los 14 alérgenos obligatorios.
- [x] 2.2 Implementar transacciones de archivado y restauración: archivar una categoría debe archivar sus platos y restaurarla debe restaurar esos platos, sin borrar fotografías; verificar los escenarios «Categoría archivada no se publica», «Dueño archiva una categoría», «Dueño restaura una categoría» y «Dueño archiva y restaura un plato».
- [x] 2.3 Implementar la utilidad local que genere un QR único por mesa desde la lista configurada, con URL que contenga su identificador opaco; verificar que cada QR generado tenga una URL distinta y no use servicios externos.

## 3. API pública y administración protegida

- [x] 3.1 Implementar inicio y cierre de sesión de establecimiento con cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción, además del middleware de autorización administrativa; verificar los escenarios «Dueño autenticado administra el catálogo» y «Cliente sin sesión intenta administrar».
- [x] 3.2 Implementar la ruta pública de carta que acepte y conserve el identificador de mesa, devuelva categorías no vacías y platos publicables en orden, y no cree pedidos ni almacene datos personales; verificar los escenarios «Cliente consulta la carta desde el QR de su mesa», «Plato archivado no se publica» y «Categoría vacía no se publica».
- [x] 3.3 Implementar rutas administrativas para crear, editar, reordenar, archivar y restaurar categorías; verificar el escenario «Dueño reordena categorías» y la restauración conjunta de sus platos.
- [x] 3.4 Implementar rutas administrativas para crear, editar, reordenar, archivar y restaurar platos con validación de campos, precio con centavos y selección opcional de alérgenos; verificar los escenarios «Dueño crea un plato sin alérgenos declarados» y «Dueño reordena platos de una categoría».
- [x] 3.5 Implementar carga de fotografías JPEG, PNG y WebP de hasta 5 MB, validación de tipo y tamaño, conversión a WebP optimizado y conservación de la fotografía al archivar/restaurar; verificar los escenarios de fotografía válida y demasiado grande.

## 4. Experiencia móvil

- [x] 4.1 Implementar la vista pública de carta con categorías y platos en orden, precio en pesos mexicanos con dos decimales, fotos opcionales y alérgenos visibles sólo cuando estén declarados; verificar los escenarios «Plato con alérgenos declarados», «Plato sin alérgenos declarados» y «Precio con centavos» mediante pruebas de interfaz.
- [x] 4.2 Entregar desde el inicio todos los datos textuales de la carta y aplicar carga diferida a fotografías fuera del área visible inicial; verificar el escenario «Fotografía diferida al desplazarse» y que no se soliciten esas imágenes antes del desplazamiento.
- [x] 4.3 Implementar la vista de administración responsive para teléfono, con formularios, selección opcional de alérgenos, carga de fotografía y controles de orden/archivado/restauración; verificar en viewport móvil que las acciones actualicen la carta pública.
- [ ] 4.4 Aplicar estilos de alto contraste, tipografía legible y objetivos táctiles adecuados a la carta pública; verificar con pruebas de accesibilidad automatizadas y revisión manual en viewport móvil.

## 5. Verificación integral

- [x] 5.1 Nombrar y ejecutar una prueba trazable por cada escenario de `carta-digital-publica` y `administracion-catalogo`; verificar que `npm test` pase sin escenarios sin cobertura.
- [x] 5.2 Añadir una prueba de presupuesto de rendimiento móvil que simule 4G y un celular de gama media; verificar que el contenido útil de la parte superior de la carta cargue en menos de dos segundos con imágenes fuera de viewport diferidas.
- [x] 5.3 Ejecutar la validación estricta de OpenSpec y las comprobaciones de compilación y pruebas; verificar con `openspec validate add-carta-digital --strict`, `npm run build` y `npm test`.
