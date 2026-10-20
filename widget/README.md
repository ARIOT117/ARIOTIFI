# Flower Music: el widget del panel de GNOME

Esta es la configuración y la implementación del widget de la captura: una píldora en el panel y un desplegable compacto con portada, artista, progreso ondulado y controles florales. Es independiente del tema VideoGlass de Spotify.

![Widget de la captura aportada](../docs/capturas/widget/captura-aportada.png)

El repositorio original de ARIOTIFI aún no incluía esta extensión. Esta entrega añade la copia del directorio instalado `flower-music@ariot117`, incluidos los ajustes locales pendientes de commit. No sustituye el tema de Spotify ni requiere Spicetify para funcionar: controla reproductores MPRIS, con prioridad para Spotify.

## Requisitos y configuración

- GNOME Shell **50**, según `metadata.json`. No se afirma compatibilidad con otros GNOME, KDE o Windows.
- GJS/St/Cairo, Gio/GLib, Soup y GdkPixbuf de la sesión GNOME.
- Un reproductor que publique MPRIS en D-Bus.
- No tiene schema ni preferencias dconf propias. La geometría y el diseño están en `ui/indicator.js`, `ui/paint.js` y `stylesheet.css`.
- La activación se administra con `gnome-extensions`. Media Controls es la alternativa anterior y se desactiva para evitar dos controles simultáneos; no se modifican sus archivos.
- Respeta el ajuste general de GNOME `org.gnome.desktop.interface enable-animations`.
- Caché de portadas comprimidas: hasta 10 entradas en memoria y 10 JPEG de hasta 256 px en disco. No se incluye la caché personal en Git.

## Instalación opcional

Desde la raíz de ARIOTIFI:

```bash
./widget/install.sh --check
./widget/install.sh
```

El script usa tu usuario, conserva un respaldo de la extensión anterior y registra el estado de Flower Music y Media Controls. En Wayland, **cierra y vuelve a iniciar sesión** para que GNOME detecte una extensión nueva o recargue sus módulos. Después, si es necesario:

```bash
gnome-extensions enable flower-music@ariot117
gnome-extensions disable mediacontrols@cliffniff.github.com
```

El segundo comando solo corresponde si tienes Media Controls instalado. No actives ambos si quieres una sola píldora. La instalación principal `./install.sh` configura Spotify; este paso del widget se ejecuta por separado porque necesita GNOME 50.

Para instalar a mano, respalda primero cualquier carpeta del mismo UUID y copia el contenido:

```bash
mkdir -p "$HOME/.local/share/gnome-shell/extensions/flower-music@ariot117"
cp -a widget/flower-music@ariot117/. "$HOME/.local/share/gnome-shell/extensions/flower-music@ariot117/"
```

Cierra sesión, vuelve a entrar y activa la extensión con los comandos anteriores. Pulsa la píldora para abrir el desplegable. Sus controles usan el reproductor MPRIS disponible; no inicia sesión en Spotify ni almacena sus credenciales.

Para restaurar una instalación por script:

```bash
./widget/restore.sh "$HOME/.local/state/ariotifi/widget-backups/FECHA"
```

Para desactivar solamente el widget: `gnome-extensions disable flower-music@ariot117`. Si quieres volver a Media Controls y lo tienes instalado: `gnome-extensions enable mediacontrols@cliffniff.github.com`.

## Diseño y consumo

El desplegable nominal es 400 × 172 px; la portada principal, 128 px. La píldora gira la portada en 24 s mientras reproduce. Con el menú cerrado no mantiene activo el timeline del compositor; abierto comparte un único timeline de unos 30 fps. En pausa se detiene después de la transición. El contenido grande se destruye al cerrar y se cancelan señales y temporizadores al desactivar.

[Prueba actual con Pulso, datos y capturas](../docs/RENDIMIENTO.md). El consumo de la extensión forma parte de **gnome-shell**, no aparece como proceso separado. Una captura de Spotify por sí sola no mide el coste del widget.

`sha256.json` registra los archivos copiados. Los informes `flower-music@ariot117/README.md` y `REPORT.md` son históricos; sus capturas y herramientas referenciadas pertenecen al directorio original de desarrollo. La instalación y las instrucciones vigentes son las de esta página.
