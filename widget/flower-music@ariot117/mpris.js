import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const PATH = '/org/mpris/MediaPlayer2';
const PLAYER = 'org.mpris.MediaPlayer2.Player';
const PROPS = 'org.freedesktop.DBus.Properties';
const now = () => GLib.get_monotonic_time() / 1e6;
const unpack = value => value instanceof GLib.Variant ? unpack(value.deep_unpack()) :
    Array.isArray(value) ? value.map(unpack) : value && typeof value === 'object' ?
        Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unpack(v)])) : value;

/** One bus connection; every subscription/call is owned by this object. */
export class Mpris {
    constructor(changed) {
        this.changed = changed;
        this.players = new Map();
        this.active = null;
        this.dead = false;
        this.open = false;
        this.pollId = 0;
        this.cancel = new Gio.Cancellable();
        this.bus = Gio.DBus.session;
        this.signals = [this.bus.signal_subscribe('org.freedesktop.DBus',
            'org.freedesktop.DBus', 'NameOwnerChanged', '/org/freedesktop/DBus', null,
            Gio.DBusSignalFlags.NONE, (_c, _s, _p, _i, _m, args) => {
                const [name, oldOwner, owner] = args.deep_unpack();
                if (!name.startsWith('org.mpris.MediaPlayer2.')) return;
                if (oldOwner) this.remove(name);
                if (owner) this.add(name);
            })];
        this.call('org.freedesktop.DBus', '/org/freedesktop/DBus',
            'org.freedesktop.DBus', 'ListNames', null, '(as)').then(result => {
            for (const name of result?.[0] ?? [])
                if (name.startsWith('org.mpris.MediaPlayer2.')) this.add(name);
        });
    }

    async call(name, path, iface, method, params = null, signature = null) {
        if (this.dead) return null;
        return new Promise(resolve => this.bus.call(name, path, iface, method, params,
            signature ? new GLib.VariantType(signature) : null,
            Gio.DBusCallFlags.NO_AUTO_START, 2000, this.cancel, (bus, result) => {
                try { resolve(unpack(bus.call_finish(result))); }
                catch { resolve(null); }
            }));
    }

    async add(name) {
        if (this.dead || this.players.has(name)) return;
        const state = {name, metadata: {}, status: 'Stopped', position: 0, at: now(),
            duration: 0, shuffle: false, loop: 'None', signals: [], ready: false};
        this.players.set(name, state);
        state.signals.push(this.bus.signal_subscribe(name, PROPS, 'PropertiesChanged',
            PATH, PLAYER, Gio.DBusSignalFlags.NONE, (_c, _s, _p, _i, _m, args) => {
                const [, props, invalidated] = unpack(args);
                this.apply(state, props);
                if (invalidated.length) this.refresh(state);
            }));
        state.signals.push(this.bus.signal_subscribe(name, PLAYER, 'Seeked', PATH,
            null, Gio.DBusSignalFlags.NONE, (_c, _s, _p, _i, _m, args) => {
                state.position = Math.max(0, Number(args.deep_unpack()[0]) / 1e6);
                state.at = now();
                this.notify();
            }));
        await this.refresh(state);
    }

    async refresh(state) {
        const values = await this.call(state.name, PATH, PROPS, 'GetAll',
            new GLib.Variant('(s)', [PLAYER]), '(a{sv})');
        if (!this.dead && this.players.get(state.name) === state && values)
            this.apply(state, values[0]);
    }

    apply(state, props) {
        if (this.dead || this.players.get(state.name) !== state) return;
        const position = this.position(state);
        if (props.Metadata) {
            const id = props.Metadata['mpris:trackid'];
            if (id !== state.metadata['mpris:trackid']) state.position = 0;
            else state.position = position;
            state.metadata = props.Metadata;
            state.duration = Math.max(0, Number(props.Metadata['mpris:length'] ?? 0) / 1e6);
        } else state.position = position;
        if ('PlaybackStatus' in props) state.status = props.PlaybackStatus;
        if ('Position' in props) state.position = Math.max(0, Number(props.Position) / 1e6);
        if ('Shuffle' in props) state.shuffle = props.Shuffle;
        if ('LoopStatus' in props) state.loop = props.LoopStatus;
        for (const key of ['CanSeek', 'CanGoNext', 'CanGoPrevious', 'CanPlay', 'CanPause'])
            if (key in props) state[key] = props[key];
        state.at = now();
        state.ready = true;
        this.select();
    }

    position(state = this.active) {
        if (!state) return 0;
        const p = state.position + (state.status === 'Playing' ? now() - state.at : 0);
        return Math.max(0, state.duration ? Math.min(state.duration, p) : p);
    }

    select() {
        const candidates = [...this.players.values()].filter(s => s.ready);
        candidates.sort((a, b) => Number(b.name.toLowerCase().includes('spotify')) -
            Number(a.name.toLowerCase().includes('spotify')) ||
            Number(b.status === 'Playing') - Number(a.status === 'Playing') || a.name.localeCompare(b.name));
        this.active = candidates[0] ?? null;
        this.notify();
    }

    notify() { if (!this.dead) this.changed(this.active); }

    remove(name) {
        const state = this.players.get(name);
        if (!state) return;
        for (const id of state.signals) this.bus.signal_unsubscribe(id);
        this.players.delete(name);
        this.select();
    }

    setOpen(open) {
        this.open = open;
        if (this.pollId) GLib.source_remove(this.pollId);
        this.pollId = 0;
        if (!open || this.dead) return;
        const poll = async () => {
            const state = this.active;
            if (!state || this.polling) return;
            this.polling = true;
            const value = await this.call(state.name, PATH, PROPS, 'Get',
                new GLib.Variant('(ss)', [PLAYER, 'Position']), '(v)');
            this.polling = false;
            if (!this.dead && this.open && this.active === state && value) {
                state.position = Math.max(0, Number(value[0]) / 1e6);
                state.at = now();
            }
        };
        poll();
        this.pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            poll();
            return GLib.SOURCE_CONTINUE;
        });
    }

    action(method) {
        if (this.active) this.call(this.active.name, PATH, PLAYER, method);
    }

    seek(seconds) {
        const s = this.active;
        const id = s?.metadata['mpris:trackid'];
        if (!id || s.CanSeek === false) return;
        const pos = Math.max(0, Math.min(s.duration, seconds));
        this.call(s.name, PATH, PLAYER, 'SetPosition', new GLib.Variant('(ox)', [id, Math.round(pos * 1e6)]));
        s.position = pos;
        s.at = now();
        this.notify();
    }

    property(name, type, value) {
        if (this.active) this.call(this.active.name, PATH, PROPS, 'Set',
            new GLib.Variant('(ssv)', [PLAYER, name, new GLib.Variant(type, value)]));
    }

    destroy() {
        this.dead = true;
        this.setOpen(false);
        this.cancel.cancel();
        for (const id of this.signals) this.bus.signal_unsubscribe(id);
        for (const state of this.players.values())
            for (const id of state.signals) this.bus.signal_unsubscribe(id);
        this.signals = [];
        this.players.clear();
        this.active = null;
        this.changed = null;
    }
}
