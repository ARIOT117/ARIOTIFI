# Procedencia de ARIOTIFI

Entrega preparada el 19 de octubre de 2026. La rama principal se creó a partir del repositorio local de Spotify-personalizado/premium, revisión `7725d39`, conservando el historial anterior. Se compararon los seis archivos de producción con la instalación activa y coincidían byte por byte. Estos archivos se trasladaron sin modificar; las novedades de esta entrega son el empaquetado, los scripts portables y la documentación.

Los hashes se guardan en [config/production-sha256.json](../config/production-sha256.json) y se comprueban con `python3 scripts/verify.py`.

| Archivo de producción | SHA-256 |
| --- | --- |
| `Extensions/videoglass.js` | `cd30f2815897b107b277df1e54a00977774c3871777abd64193829f08f89111d` |
| `Extensions/flower-button.js` | `81daceb416db5c036c2f80888bbe65111979be36f1a5d8539f4852e6d379bacb` |
| `Extensions/wavy-progress.js` | `539b4c92954d9e2d3404303de2b6a7852fc7addcc82a49c9997372397e8e30ca` |
| `VideoGlass/user.css` | `b334495c949ea5ff1ed11f6c580dcbac76cfb4cd442c6741ef7daa74e00a61af` |
| `VideoGlass/color.ini` | `2a4a4740a2729ddda7aad4450d5887fb576826772805a416cdfe4a0548b8b2a3` |
| `visualizer.py` | `3d1a1f6575cf11339dd64c3edf296cb32ac3501548293b10ce133f4a49218c8f` |

Las capturas son las que ya se habían guardado durante el desarrollo, no imágenes generadas. La galería identifica sus etapas. Los cambios de portada y seguimiento de letras posteriores a las capturas permanecen en el código principal.

Se conservan fuentes, CSS, paletas, código de validación y documentación de etapas anteriores en `archive/` y `docs/historial/`. Sus rutas absolutas son históricas. No se trasladan preferencias de cuenta, directorios de configuración completos, cachés, registros temporales, snapshots de memoria grandes ni el binario propietario de Spotify. Los datos compactos de auditoría que ya estaban en Git se conservan como evidencia histórica.

La instalación y su restauración se verifican con un usuario temporal y comandos externos simulados. La comprobación estática no reinstala el tema ni cambia la reproducción del equipo original. La compatibilidad con otra máquina requiere ejecutar el diagnóstico y probar la interfaz allí.

## Ampliación: widget Flower Music y medición con Pulso

Se añadió la extensión instalada `flower-music@ariot117`, incluidos los cambios locales de `ui/indicator.js` y `ui/paint.js` que estaban pendientes de commit en su directorio original. No se modificaron sus archivos de producción al copiarlos. Los hashes de esta copia están en [widget/sha256.json](../widget/sha256.json).

Las pruebas actuales de rendimiento y sus capturas se documentan en [RENDIMIENTO.md](RENDIMIENTO.md). Usan el recolector y la interfaz real de Pulso; se conservan todas las muestras y la tentativa incompleta. La captura del widget aportada por el usuario se incluye como referencia visual. Los scripts de instalación del widget y las herramientas del benchmark son nuevos y no se cargan con la extensión.
