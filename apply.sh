#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cp -- "$project_dir/Extensions/wavy-progress.js" /home/diego/.config/spicetify/Extensions/wavy-progress.js
cp -- "$project_dir/Extensions/videoglass.js" /home/diego/.config/spicetify/Extensions/videoglass.js
cp -- "$project_dir/VideoGlass/user.css" /home/diego/.config/spicetify/Themes/VideoGlass/user.css
cp -- "$project_dir/visualizer.py" /home/diego/.local/share/spotify-personalizado/visualizer.py
/home/diego/.local/bin/spicetify apply -n
systemctl --user restart spotify-videoglass.service
printf '%s\n' 'Diseño aplicado. Cierra y abre Spotify para cargar la extensión.'
