# Medicion reproducible de la carta publica

La prueba de jsdom `tests/performance.test.jsx` solo comprueba carga progresiva funcional. No mide renderizado real ni simula 4G. La medicion de navegador se ejecuta sobre el build de Vite servido por Express con una base SQLite temporal; no se utiliza la base de operación.

## Perfil

- Chromium instalado con `npx playwright install chromium`; ejecutar `npm run test:browser` para recorridos y `npm run test:performance` para la medicion.
- Viewport 390 x 844, caché fría en cada carga, descarga 4 Mbps, subida 1 Mbps, latencia 150 ms y CPU ralentizada cuatro veces mediante CDP.
- Fixture fijo: seis categorías, treinta platos (cinco por categoría), precios y descripciones representativos, alérgenos y fotos WebP locales. Registrar dimensiones y bytes concretos de cada foto en el resultado.
- Cinco cargas independientes sin otras pruebas en paralelo. Medir desde inicio de navegación hasta que categoría, nombre, descripción y precio del primer plato son visibles. Guardar captura y traza de recursos HTML, CSS, JS, API y fotos.
- Cada carga debe ser menor que 2000 ms. Fotos claramente fuera del área inicial y del margen de precarga de 180 px no deben solicitarse antes del desplazamiento; después deben mostrarse.

Registrar en el informe el sistema, modelo de CPU, versión exacta de Chromium, fixture, bytes transferidos, configuración de red/CPU y los cinco tiempos individuales. Un resultado emulado no certifica el requisito físico: repetir en un celular de gama media con 4G, indicando modelo, navegador, red y tiempos. El usuario confirma que realizó esa prueba física, pero no conservó sus datos de medición.

## Resultado local de emulación

Chromium 151.0.7922.34 en Windows, Intel Core i5-12500, con tres fotos WebP de 640 x 420 y 83 674 bytes cada una: cargas 1?5 de 1725, 1469, 1421, 1418 y 1414 ms. Todas quedaron por debajo de 2000 ms; las dos fotos lejanas se solicitaron tras el desplazamiento. Las trazas y capturas estan en `test-results/` (ignorado por Git), junto al JSON con sistema, CPU, version del navegador, recursos y bytes. La prueba en celular físico con 4G fue reportada por el usuario. No se conservan modelo, navegador, condiciones detalladas, tiempos ni capturas; no es posible verificar el umbral de dos segundos con esta declaración.
