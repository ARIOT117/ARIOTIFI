#!/usr/bin/env python3
"""Observe widget states using Pulso's own collector and real GNOME screenshots.

Run explicitly from the graphical session. This temporarily toggles Flower Music,
opens Pulso, and restores the extension state. It does not change Spotify tracks.
"""
import argparse
import datetime
import json
from pathlib import Path
import statistics
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pulso-source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--samples', type=int, default=15)
    parser.add_argument('--interval', type=float, default=2)
    parser.add_argument('--capture-only', action='store_true', help='Capture Pulso without replacing measurement results.')
    args = parser.parse_args()
    if args.samples < 2 or args.interval < 1:
        parser.error('Use at least two samples and an interval >= 1 second.')
    pulso = args.pulso_source.expanduser().resolve()
    sys.path.insert(0, str(pulso))
    from pulso.collector.sampler import Collector
    from pulso.collector import procfs
    from gi.repository import Gio, GLib
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    session = Path(tempfile.mkdtemp(prefix='ariotifi-pulso-'))
    print('Session files: ' + str(session), flush=True)

    def request(action, **kwargs):
        key = str(uuid.uuid4())
        tmp = session / 'command.tmp'
        tmp.write_text(json.dumps({'id':key, 'action':action, **kwargs}))
        tmp.replace(session / 'command.json')
        start = time.monotonic()
        while time.monotonic() - start < 15:
            try:
                value = json.loads((session / 'response.json').read_text())
                if value.get('id') == key:
                    if not value.get('ok'):
                        raise RuntimeError(value.get('error'))
                    return value
            except (FileNotFoundError, json.JSONDecodeError):
                pass
            time.sleep(.1)
        raise TimeoutError('GNOME did not respond to ' + action)

    # Start or present the actual, unmodified Pulso UI.
    with (session / 'pulso.log').open('w') as log:
        subprocess.Popen(['/usr/bin/python3','-m','pulso'], cwd=pulso, stdout=log, stderr=log,
                         start_new_session=True)
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    dest = 'org.gnome.Mutter.RemoteDesktop'
    path = bus.call_sync(dest, '/org/gnome/Mutter/RemoteDesktop', dest, 'CreateSession',
                         None, None, Gio.DBusCallFlags.NONE, 3000, None).unpack()[0]
    def call(method, parameters=None):
        return bus.call_sync(dest, path, dest+'.Session', method, parameters, None,
                             Gio.DBusCallFlags.NONE, 3000, None)
    def key(symbol, pressed):
        call('NotifyKeyboardKeysym', GLib.Variant('(ub)', (symbol, pressed)))
    def tap(symbol):
        key(symbol,True); key(symbol,False)
    def type_text(value):
        for char in value:
            tap(ord(char)); time.sleep(.01)
    try:
        call('Start')
        key(0xffe9,True);tap(0xffbf);key(0xffe9,False)
        time.sleep(.6);type_text('lg');tap(0xff0d);time.sleep(2)
        key(0xffe3,True);tap(ord('a'));key(0xffe3,False)
        import shutil
        shutil.copy2(ROOT/'scripts/gnome-benchmark-session.js', session/'gnome-benchmark-session.js')
        module = (session/'gnome-benchmark-session.js').as_uri()
        type_text('(await import('+json.dumps(module)+')).run('+json.dumps(str(session))+')')
        tap(0xff0d)
    finally:
        call('Stop')
    start = time.monotonic()
    while time.monotonic()-start < 20:
        if (session/'response.json').exists():
            break
        time.sleep(.2)
    else:
        raise TimeoutError('Looking Glass module did not start; inspect the graphical session.')
    initial = json.loads((session/'response.json').read_text())
    collector = Collector()
    collector.collect()
    rows = []
    original = initial.get('original', {})
    report = {'created':datetime.datetime.now().astimezone().isoformat(),
              'method':'Pulso Collector; CPU % of all logical CPUs; PSS bytes; no forced GC',
              'pulso_commit':subprocess.check_output(['git','-C',str(pulso),'rev-parse','HEAD'],text=True).strip(),
              'samples_per_phase':args.samples, 'interval_seconds':args.interval,
              'scope':'Widget toggled in a live session; causal attribution requires stable playback and desktop load.',
              'initial_widget':initial.get('state'), 'phases':rows}
    def save():
        name = 'pulso-capturas.json' if args.capture_only else 'pulso-resultados.json'
        (output/name).write_text(json.dumps(report,indent=2)+'\n')
    def player():
        try:
            with urllib.request.urlopen('http://127.0.0.1:43891/player',timeout=2) as response:
                value=json.load(response)
                return {'playing':value.get('playing'),'uri':value.get('item',{}).get('uri')}
        except Exception:
            return {'available':False}
    def group_snapshot(snap):
        groups = {name:{'cpu_total_pct':0.0,'pss_bytes':0,'pss_unknown':0,'pids':[]}
                  for name in ['gnome-shell','spotify','bridge']}
        for app in snap.apps:
            for proc in app.procs:
                exe = procfs.read_exe(proc.pid) or ''
                group = 'gnome-shell' if proc.name == 'gnome-shell' else 'spotify' if exe.endswith('/spotify') else None
                if group is None and any(b'spotify-personalizado/visualizer.py' in item for item in procfs.read_cmdline(proc.pid)):
                    group='bridge'
                if group:
                    target=groups[group]
                    target['cpu_total_pct'] += proc.cpu/snap.ncpu*100
                    if proc.pss is None:target['pss_unknown']+=1
                    else:target['pss_bytes']+=proc.pss
                    target['pids'].append(proc.pid)
        return {'monotonic':snap.time,'ncpu':snap.ncpu,'system_cpu_pct':snap.system.cpu,
                'groups':groups,'player':player()}
    try:
        request('focus')
        for phase,action in [('sin-widget-antes','off'),('widget-cerrado','closed'),
                             ('widget-abierto','open'),('widget-cerrado-despues','closed'),
                             ('sin-widget-despues','off')]:
            if args.capture_only and phase.endswith('despues'):
                continue
            print('Phase: '+phase,flush=True)
            request(action)
            time.sleep(5)
            before=request('status')['state']
            if args.capture_only:
                name='pulso-'+phase+'.png'
                request('screenshot',name=name)
                import shutil
                shutil.copy2(session/name,output/name)
                rows.append({'phase':phase, 'state':before, 'screenshot':name})
                save()
                continue
            collector.collect()
            samples=[]
            for _ in range(args.samples):
                time.sleep(args.interval)
                samples.append(group_snapshot(collector.collect()))
            after=request('status')['state']
            expected = action != 'off'
            if before['enabled'] != expected or after['enabled'] != expected:
                raise RuntimeError('Widget state changed during phase '+phase)
            if action=='open' and not (before['popupOpen'] and after['popupOpen']):
                raise RuntimeError('Widget did not stay open during sample')
            summary={}
            for name in ['gnome-shell','spotify','bridge']:
                cpu=[s['groups'][name]['cpu_total_pct'] for s in samples]
                mem=[s['groups'][name]['pss_bytes']/1024**2 for s in samples]
                summary[name]={'cpu_total_mean_pct':statistics.mean(cpu),'cpu_total_max_pct':max(cpu),
                               'pss_mean_mib':statistics.mean(mem),'pss_min_mib':min(mem),'pss_max_mib':max(mem),
                               'unknown_samples':sum(s['groups'][name]['pss_unknown']>0 for s in samples)}
            row={'phase':phase,'start_state':before,'end_state':after,'summary':summary,'samples':samples}
            rows.append(row);save()
            if phase in ('sin-widget-antes','widget-cerrado','widget-abierto'):
                name='pulso-'+phase+'.png'
                request('screenshot',name=name)
                import shutil
                shutil.copy2(session/name,output/name)
        report['completed']=True
    finally:
        try:
            report['restored_widget']=request('finish')['state']
            report['restored_enabled_state'] = report['restored_widget']['enabled'] == initial['state']['enabled']
        finally:
            save()
    print(json.dumps({r['phase']:r.get('summary', r.get('state')) for r in rows},indent=2),flush=True)
    print('Results: '+str(output),flush=True)

if __name__=='__main__':
    main()
