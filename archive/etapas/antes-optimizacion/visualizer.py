#!/usr/bin/python3
"""Local output-audio spectrum and cached public lyrics for VideoGlass."""
import json, os, time, threading, urllib.parse, urllib.request, re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

Gst.init(None)
PORT = 43891
state = {'bands': [0.0] * 64, 'active': False, 'error': ''}
last_request = 0.0
pipeline = None
cache = Path.home() / '.cache/spotify-videoglass/lyrics'
cache.mkdir(parents=True, exist_ok=True)

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

def tick():
    global pipeline
    wanted = time.monotonic() - last_request < 6
    if wanted and pipeline is None:
        # Explicit monitor source: never select the microphone.
        pipeline = Gst.parse_launch('pulsesrc device="@DEFAULT_MONITOR@" ! audioconvert ! spectrum bands=64 interval=40000000 threshold=-75 ! fakesink sync=false')
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
        if origin in ('https://xpui.app.spotify.com', 'https://xpui.spotify.com'):
            self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.reply({})

    def do_GET(self):
        global last_request
        u = urllib.parse.urlparse(self.path)
        if u.path == '/spectrum':
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
