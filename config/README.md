# Configuración reproducible

`config-xpui.ini.example` documenta el tema, las rutas y las opciones del proyecto. No contiene la sección `[Backup]`: esa sección pertenece a cada cliente y la administra Spicetify.

El instalador configura las rutas reales del usuario y conserva el estado de respaldo existente. `spotify-videoglass.service` usa `%h` para la carpeta personal. El lanzador de ejemplo corresponde a la copia local estándar; el instalador lo genera con la ruta elegida en `--spotify-path`.

Solo `videoglass.js` debe registrarse como extensión de este proyecto. Los otros dos JS son los componentes fuente originales y ya están incorporados al comienzo del bundle.
