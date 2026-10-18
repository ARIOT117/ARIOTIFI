#!/usr/bin/env bash
set -euo pipefail
backup_dir=/home/diego/Backups/spotify-personalizado/premium-2026-10-17
cp -- "$backup_dir/spicetify/Extensions/videoglass.js" /home/diego/.config/spicetify/Extensions/videoglass.js
cp -- "$backup_dir/spicetify/Themes/VideoGlass/user.css" /home/diego/.config/spicetify/Themes/VideoGlass/user.css
cp -- "$backup_dir/visualizer.py" /home/diego/.local/share/spotify-personalizado/visualizer.py
/home/diego/.local/bin/spicetify apply -n
systemctl --user restart spotify-videoglass.service
printf '%s\n' 'Versión anterior restaurada. Cierra y abre Spotify para cargarla.'
