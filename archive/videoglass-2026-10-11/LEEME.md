# Fuentes del resultado final · 11 de octubre de 2026

Copia del tema, extensión, servicio de audio y letras, configuración y lanzadores del resultado documentado. La configuración omite la sección `[Backup]`: Spicetify debe generarla al preparar cada copia del cliente.

El procedimiento completo está en [el README principal](../../readmi%20personalizacion%20spoty.md#13-procedimiento-completo-para-reproducir-el-resultado-final).

Spotify probado: **1.2.95.453.g0eeebbed**, Snap **99**. Spicetify probado: **2.45.3**. Las rutas de los archivos de configuración y los lanzadores corresponden a `/home/diego`.

`manifest.json` registra los archivos originales y sus hashes. Para comprobar esta copia desde esta carpeta:

```bash
sha256sum -c SHA256SUMS
```

Las fuentes contienen la implementación; el cliente de Spotify y las preferencias de la cuenta se obtienen mediante los pasos del README. El acceso de escritorio se recrea a partir de `spotify_spotify.desktop` si se desea.
