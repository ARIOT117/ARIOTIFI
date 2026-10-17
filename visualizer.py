#!/usr/bin/python3
"""Local output-audio spectrum and cached public lyrics for VideoGlass."""
import json, os, time, threading, urllib.parse, urllib.request, re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib, Gio

Gst.init(None)
PORT = 43891
state = {'bands': [0.0] * 64, 'active': False, 'error': ''}
last_request = 0.0
pipeline = None
cache = Path.home() / '.cache/spotify-videoglass/lyrics'
cache.mkdir(parents=True, exist_ok=True)
bus_connection = Gio.bus_get_sync(Gio.BusType.SESSION, None)
PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player'
ALLOWED_ORIGINS = ('https://xpui.app.spotify.com', 'https://xpui.spotify.com')

def dbus_call(interface, method, parameters, result_type=None):
    return bus_connection.call_sync('org.mpris.MediaPlayer2.spotify', '/org/mpris/MediaPlayer2',
        interface, method, parameters, result_type, Gio.DBusCallFlags.NO_AUTO_START, 1500, None)

def player_state():
    props = dbus_call('org.freedesktop.DBus.Properties', 'GetAll',
        GLib.Variant('(s)', (PLAYER_IFACE,))).unpack()[0]
    metadata = props.get('Metadata', {})
    duration = max(0, int(metadata.get('mpris:length', 0)) // 1000)
    position = max(0, int(props.get('Position', 0)) // 1000)
    artists = metadata.get('xesam:artist', [])
    uri = str(metadata.get('xesam:url', ''))
    parsed = urllib.parse.urlparse(uri)
    parts = parsed.path.strip('/').split('/')
    if parsed.hostname == 'open.spotify.com' and len(parts) >= 2 and parts[-2] in ('track', 'episode'):
        uri = 'spotify:' + ':'.join(parts[-2:])
    return {'playing': props.get('PlaybackStatus') == 'Playing', 'duration': duration,
        'position': position, 'volume': float(props.get('Volume', 0)),
        'shuffle': bool(props.get('Shuffle', False)),
        'repeat': {'None': 0, 'Playlist': 1, 'Track': 2}.get(props.get('LoopStatus'), 0),
        'track_id': str(metadata.get('mpris:trackid', '/')),
        'item': {'uri': uri, 'metadata': {
            'title': str(metadata.get('xesam:title', '')),
            'artist_name': ', '.join(artists), 'album_title': str(metadata.get('xesam:album', '')),
            'image_xlarge_url': str(metadata.get('mpris:artUrl', ''))}}}

def control(action, value):
    if action == 'spectrum-stop':
        GLib.idle_add(stop_capture)
        return
    methods = {'play': 'Play', 'pause': 'Pause', 'toggle': 'PlayPause', 'next': 'Next', 'back': 'Previous'}
    if action in methods:
        dbus_call(PLAYER_IFACE, methods[action], None)
    elif action == 'seek':
        current = player_state()
        target = max(0, min(int(value), current['duration']))
        dbus_call(PLAYER_IFACE, 'SetPosition', GLib.Variant('(ox)', (current['track_id'], target * 1000)))
    elif action in ('volume', 'shuffle', 'repeat'):
        if action == 'volume':
            name, variant = 'Volume', GLib.Variant('d', max(0.0, min(1.0, float(value))))
        elif action == 'shuffle':
            name, variant = 'Shuffle', GLib.Variant('b', bool(value))
        else:
            name, variant = 'LoopStatus', GLib.Variant('s', ('None', 'Playlist', 'Track')[int(value) % 3])
        dbus_call('org.freedesktop.DBus.Properties', 'Set', GLib.Variant('(ssv)', (PLAYER_IFACE, name, variant)))
    else:
        raise ValueError('Acción desconocida')

def on_message(bus, msg):
    if msg.type == Gst.MessageType.ELEMENT:
        s = msg.get_structure()
        if s and s.get_name() == 'spectrum':
            # Ubuntu's GI package may not ship Gst.ValueList overrides.
            raw = re.search(r'magnitude=\(float\)\{([^}]+)\}', s.to_string())
            if not raw:
                return
            values = [float(v) for v in raw.group(1).split(',')]
            state['bands'] = [round(max(0, min(1, (float(v) + 75) / 65)), 3) for v in values]
            state['active'] = True
    elif msg.type == Gst.MessageType.ERROR:
        err, _ = msg.parse_error()
        state['error'] = str(err)
        state['active'] = False

def stop_capture():
    """Release the audio monitor immediately on close, pause or visibility loss."""
    global pipeline, last_request
    last_request = 0.0
    if pipeline is not None:
        pipeline.set_state(Gst.State.NULL)
        pipeline.get_bus().remove_signal_watch()
        pipeline = None
    state.update(bands=[0.0] * 64, active=False)
    return False

def tick():
    global pipeline
    wanted = time.monotonic() - last_request < 6
    if wanted and pipeline is None:
        # Explicit monitor source: never select the microphone.
        pipeline = Gst.parse_launch('pulsesrc device="@DEFAULT_MONITOR@" ! audioconvert ! spectrum bands=64 interval=80000000 threshold=-75 ! fakesink sync=false')
        bus = pipeline.get_bus()
        bus.add_signal_watch()
        bus.connect('message', on_message)
        state['error'] = ''
        pipeline.set_state(Gst.State.PLAYING)
    elif not wanted and pipeline is not None:
        pipeline.set_state(Gst.State.NULL)
        pipeline.get_bus().remove_signal_watch()
        pipeline = None
        state.update(bands=[0.0]*64, active=False)
    return True

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, value, status=200):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        origin = self.headers.get('Origin', '')
        if origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Methods', 'GET, POST')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.reply({})

    def do_POST(self):
        if self.path != '/control' or self.headers.get('Origin') not in ALLOWED_ORIGINS:
            return self.reply({'error': 'Forbidden'}, 403)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length < 1024:
                return self.reply({'error': 'Invalid request'}, 400)
            data = json.loads(self.rfile.read(length))
            control(data['action'], data.get('value'))
            self.reply({'ok': True})
        except Exception:
            self.reply({'error': 'Spotify no pudo realizar esta acción'}, 400)

    def do_GET(self):
        global last_request
        u = urllib.parse.urlparse(self.path)
        if u.path == '/player':
            try:
                self.reply(player_state())
            except Exception:
                self.reply({'error': 'Spotify no está disponible'}, 503)
        elif u.path == '/spectrum':
            last_request = time.monotonic()
            self.reply(dict(state))
        elif u.path == '/health':
            self.reply({'ok': True, 'audio': 'output monitor', 'active': state['active']})
        elif u.path == '/lyrics':
            import hashlib
            q = urllib.parse.parse_qs(u.query)
            params = {k: q[k][0][:300] for k in ('track_name','artist_name','album_name','duration') if k in q}
            if not params.get('track_name') or not params.get('artist_name'):
                return self.reply({'error':'Faltan título o artista'}, 400)
            key = hashlib.sha256(json.dumps(params,sort_keys=True).encode()).hexdigest()
            f = cache / (key+'.json')
            try:
                if f.exists():
                    return self.reply(json.loads(f.read_text()))
                request = urllib.request.Request('https://lrclib.net/api/get?'+urllib.parse.urlencode(params), headers={'User-Agent':'VideoGlass/1.0 (Spotify desktop lyrics)'})
                with urllib.request.urlopen(request, timeout=12) as res:
                    data = json.load(res)
                f.write_text(json.dumps(data,ensure_ascii=False))
                self.reply(data)
            except Exception:
                self.reply({'syncedLyrics':None,'plainLyrics':None,'error':'No hay letras disponibles para esta canción'})
        else:
            self.reply({'error':'Not found'},404)

def main():
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    GLib.timeout_add(300, tick)
    GLib.MainLoop().run()

if __name__ == '__main__':
    main()
