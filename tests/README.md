# Validación

Pruebas de empaquetado, sin tocar la sesión de Spotify:

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/verify.py
```

El resto de archivos se conserva del desarrollo original. Varias pruebas usan CDP en `127.0.0.1:9222`, cambian canciones, tamaños de ventana o archivos instalados. Algunas dependen de `/home/diego`, de respaldos anteriores y de una revisión concreta de VideoGlass. No se ejecutan durante la instalación ni forman una suite portable.

`geometry.js` también es histórico: extrae funciones de una revisión antigua. Puede necesitar adaptar su extracción al código actual. Los resultados originales de 447 comprobaciones pertenecen a la revisión indicada en la documentación histórica.

Los JSON ya versionados de `measurements/` son evidencia de sesiones anteriores. Los perfiles y snapshots grandes no se incluyen en esta entrega. La [auditoría](../AUDITORIA-FINAL.md) explica sus límites de RAM y CPU.

Para repetir la prueba actual con Pulso utiliza `scripts/benchmark-pulso.py`, siguiendo [la metodología](../docs/RENDIMIENTO.md). Alterna el widget de la sesión y toma capturas reales; es una operación interactiva explícita, no parte de la suite de empaquetado.
