# Spec Delta

## Purpose

Permitir que cualquier cliente consulte la carta vigente de La Estación desde el QR único de su mesa, sin instalar una aplicación ni identificarse.

## ADDED Requirements

### Requirement: Consulta pública identificada por mesa
El sistema MUST permitir consultar la carta sin iniciar sesión, crear una cuenta ni proporcionar datos personales. Cada QR de mesa MUST abrir una URL pública con un identificador único de mesa. La consulta MUST conservar ese identificador para el futuro flujo de pedidos, sin crear pedidos ni almacenar datos personales en este cambio.

#### Scenario: Cliente consulta la carta desde el QR de su mesa
- **WHEN** un cliente abre el QR único de una mesa
- **THEN** el sistema muestra la carta sin solicitar autenticación ni datos personales y conserva el identificador de esa mesa en la URL

### Requirement: Publicación y orden del catálogo
La carta MUST mostrar únicamente las categorías no archivadas que tengan platos activos y, dentro de cada una, todos sus platos activos, respetando el orden manual configurado por el dueño para categorías y platos. Una categoría archivada MUST archivar y retirar de la carta pública todos sus platos. Una categoría vacía MUST no mostrarse.

#### Scenario: Plato archivado no se publica
- **WHEN** el dueño ha archivado un plato
- **THEN** el sistema no muestra ese plato en ninguna categoría de la carta pública

#### Scenario: Categoría archivada no se publica
- **WHEN** el dueño ha archivado una categoría con platos
- **THEN** el sistema no muestra la categoría ni ninguno de sus platos en la carta pública

#### Scenario: Categoría vacía no se publica
- **WHEN** una categoría no archivada no tiene platos activos
- **THEN** el sistema no muestra esa categoría en la carta pública

### Requirement: Información de cada plato
El sistema MUST mostrar para cada plato activo su nombre, precio en pesos mexicanos con dos decimales, descripción breve y foto cuando exista. El sistema MUST mostrar de forma visible sólo los alérgenos declarados para el plato, seleccionados del catálogo fijo de 14: cereales con gluten, crustáceos, huevo, pescado, cacahuates, soya, leche, frutos de cáscara, apio, mostaza, ajonjolí, dióxido de azufre y sulfitos, altramuces y moluscos. Cuando un plato no tenga alérgenos declarados, el sistema MUST no mostrar una leyenda ni sección de alérgenos.

#### Scenario: Plato con alérgenos declarados
- **WHEN** un cliente visualiza un plato que tiene huevo y leche declarados
- **THEN** el sistema muestra ambos alérgenos de forma visible junto con la información del plato

#### Scenario: Plato sin alérgenos declarados
- **WHEN** un cliente visualiza un plato sin alérgenos declarados
- **THEN** el sistema no muestra una leyenda ni sección de alérgenos para ese plato

#### Scenario: Precio con centavos
- **WHEN** un cliente visualiza un plato con precio de 85 pesos
- **THEN** el sistema muestra el precio con dos decimales y sin una leyenda sobre IVA

### Requirement: Carga progresiva y accesible en móvil
El sistema MUST ofrecer la carta pública con texto legible, contraste alto y controles táctiles de tamaño adecuado en móvil. El sistema MUST presentar desde la carga inicial las categorías y datos textuales de todos los platos publicables. Las fotografías que estén fuera del área visible inicial MUST cargarse de forma diferida cuando el cliente se desplace hacia ellas. Bajo una conexión 4G y un celular de gama media, MUST cargar en menos de dos segundos el contenido útil de la parte superior de la carta.

#### Scenario: Fotografía diferida al desplazarse
- **WHEN** un cliente se desplaza hasta un plato cuya fotografía estaba fuera del área visible inicial
- **THEN** el sistema carga y muestra la fotografía de ese plato

#### Scenario: Consulta móvil con condiciones objetivo
- **WHEN** un cliente abre una carta publicada desde un celular de gama media con conexión 4G
- **THEN** el contenido útil de la parte superior de la carta queda disponible en menos de dos segundos

