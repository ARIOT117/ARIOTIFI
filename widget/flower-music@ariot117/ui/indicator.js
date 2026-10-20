import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Mpris} from '../mpris.js';
import {Artwork} from '../artwork-cache.js';
import {area, background, cover, play, wave, fmt, TAU, clamp} from './paint.js';

const mono = () => GLib.get_monotonic_time() / 1e6;
const vertical = props => new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, ...props});
const label = (text, style) => {
    const l = new St.Label({text, style_class: style, y_align: Clutter.ActorAlign.CENTER});
    l.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    return l;
};
const iconDir = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent().get_child('icons');
const iconFile = name => new Gio.FileIcon({file: iconDir.get_child(`${name}.svg`)});
function button(icon, name, style, callback, size = 18) {
    const b = new St.Button({style_class: style, accessible_name: name, can_focus: true,
        y_align: Clutter.ActorAlign.CENTER, child: new St.Icon({gicon: iconFile(icon), icon_size: size, style: `icon-size: ${size}px;`})});
    b.connect('clicked', callback);
    return b;
}

export const Indicator = GObject.registerClass(class FlowerMusicIndicator extends PanelMenu.Button {
    _init() {
        super._init(0, 'Controles de música');
        this.add_style_class_name('flower-indicator');
        // The panel gesture otherwise recognizes child control presses as menu toggles.
        this._clickGesture.set_enabled(false);
        this.dead = false;
        this.art = null;
        this.artKey = null;
        this.angle = 0;
        this.phase = 0;
        this.elapsedAnimation = 0;
        this.amplitude = 0;
        this.playing = false;
        this.popupOpen = false;
        this.lastFrame = 0;
        this.artwork = new Artwork();
        this.settings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        this.reduced = !this.settings.get_boolean('enable-animations');
        this.settingsId = this.settings.connect('changed::enable-animations', () => {
            this.reduced = !this.settings.get_boolean('enable-animations');
            this.updateClock();
            this.repaint();
        });
        this.buildPill();
        this.menu.actor.add_style_class_name('flower-menu');
        this.menu.box.add_style_class_name('flower-menu-box');
        this.nativeOpen = this.menu.open;
        this.menu.open = animate => {
            if (this.dead) return;
            this.buildPopup();
            const [px] = this.pill.get_transformed_position();
            const [ix] = this.get_transformed_position();
            const box = this.get_theme_node().get_content_box(this.get_allocation_box());
            this.menu.setSourceAlignment(clamp((px - ix - box.x1) / Math.max(1, box.x2 - box.x1)));
            this.nativeOpen.call(this.menu, animate);
        };
        this.closedId = this.menu.connect('menu-closed', () => {
            if (!this.popupOpen) this.destroyPopup();
        });
        this.clock = new Clutter.Timeline({actor: this, duration: 1000, repeat_count: -1});
        this.clockId = this.clock.connect('new-frame', () => this.frame());
        this.menuId = this.menu.connect('open-state-changed', (_menu, open) => {
            this.popupOpen = open;
            this.mpris?.setOpen(open);
            this.updateClock();
            this.repaint();
            // BoxPointer may close synchronously when no animation is requested;
            // in that case menu-closed precedes this state notification.
            if (!open && !this.menu.actor.visible) this.destroyPopup();
        });
        this.mpris = new Mpris(state => this.update(state));
        this.secondId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this.tick();
            return GLib.SOURCE_CONTINUE;
        });
        this.hide();
    }

    buildPill() {
        const outer = this.pill = new St.Bin({y_align: Clutter.ActorAlign.CENTER, style_class: 'flower-pill'});
        const stack = vertical({});
        this.pillStack = stack;
        const row = new St.BoxLayout({style_class: 'flower-pill-row'});
        const main = new St.Button({accessible_name: 'Abrir controles de música', can_focus: true,
            style_class: 'flower-pill-main'});
        const info = new St.BoxLayout({style_class: 'flower-pill-info'});
        this.pillCover = area(20, 20, (cr, w, h) => cover(cr, w, h, this.art, true, this.angle),
            {y_align: Clutter.ActorAlign.CENTER});
        this.pillCover.set_pivot_point(.5, .5);
        this.pillCover.set_translation(0, 2, 0);
        this.pillTitle = label('Spotify', 'flower-pill-title');
        info.add_child(this.pillCover);
        info.add_child(this.pillTitle);
        main.set_child(info);
        main.connect('clicked', () => this.menu.toggle());
        row.add_child(main);
        this.pillPlay = button('media-playback-start-symbolic', 'Reproducir', 'flower-pill-control',
            () => this.mpris.action('PlayPause'), 14);
        this.pillNext = button('media-skip-forward-symbolic', 'Siguiente', 'flower-pill-control',
            () => this.mpris.action('Next'), 14);
        row.add_child(this.pillPlay);
        row.add_child(this.pillNext);
        stack.add_child(row);
        this.pillProgress = area(-1, 2, (cr, w, h) => wave(cr, w, h, this.fraction(), 0, 0, true),
            {x_expand: true, x_align: Clutter.ActorAlign.FILL,
                style_class: 'flower-pill-progress'});
        stack.add_child(this.pillProgress);
        outer.set_child(stack);
        this.add_child(outer);
    }

    buildPopup() {
        if (this.popup) return;
        const item = this.popupItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false,
            style_class: 'flower-menu-item'});
        this.popup = new St.Widget({width: 400, height: 172,
            layout_manager: new Clutter.BinLayout(), style_class: 'flower-popup'});
        this.backdrop = area(400, 172, (cr, w, h) => background(cr, w, h, this.art));
        this.popup.add_child(this.backdrop);
        const content = new St.BoxLayout({style_class: 'flower-content', x_expand: true, y_expand: true});
        this.bigCover = area(128, 128, (cr, w, h) => cover(cr, w, h, this.art),
            {y_align: Clutter.ActorAlign.CENTER, style_class: 'flower-album'});
        content.add_child(this.bigCover);
        const details = vertical({style_class: 'flower-details', width: 224,
            y_align: Clutter.ActorAlign.CENTER, x_expand: true});
        const header = new St.BoxLayout({style_class: 'flower-header'});
        this.eq = area(11.5, 9, (cr, w, h) => {
            const accent = this.accent();
            cr.setSourceRGB(...accent);
            cr.setLineWidth(2.5);
            for (let i = 0; i < 3; i++) {
                const f = this.playing && !this.reduced ? .35 + .65 *
                    (.5 + .5 * Math.sin(this.elapsedAnimation * TAU / 1.1 + i * 2.3)) : .45;
                cr.moveTo(1.25 + i * 4.5, h - 1.25);
                cr.lineTo(1.25 + i * 4.5, h - 1.25 - (h - 2.5) * f);
                cr.stroke();
            }
        }, {y_align: Clutter.ActorAlign.CENTER});
        header.add_child(this.eq);
        this.playerLabel = label('Spotify', 'flower-source');
        header.add_child(this.playerLabel);
        details.add_child(header);
        this.title = label('', 'flower-title');
        this.artist = label('', 'flower-artist');
        details.add_child(this.title);
        details.add_child(this.artist);
        const progress = vertical({style_class: 'flower-progress-wrap'});
        this.progress = area(224, 12, (cr, w, h) => wave(cr, w, h, this.fraction(),
            this.phase, this.reduced ? 0 : this.amplitude),
        {reactive: true, can_focus: true, accessible_name: 'Progreso de la canción',
            accessible_role: Atk.Role.SLIDER, x_expand: true});
        const seekGesture = new Clutter.ClickGesture();
        seekGesture.connect('recognize', (_g, _sequence) => {
            const [x] = global.get_pointer();
            const [ok, localX] = this.progress.transform_stage_point(x, 0);
            if (ok) this.mpris.seek(clamp(localX / this.progress.width) * (this.mpris.active?.duration ?? 0));
        });
        this.progress.add_action(seekGesture);
        this.progress.connect('key-press-event', (_a, event) => {
            const key = event.get_key_symbol();
            if (key === Clutter.KEY_Left || key === Clutter.KEY_Right) {
                this.mpris.seek(this.mpris.position() + (key === Clutter.KEY_Right ? 5 : -5));
                return Clutter.EVENT_STOP;
            }
            if (key === Clutter.KEY_Home || key === Clutter.KEY_End) {
                this.mpris.seek(key === Clutter.KEY_Home ? 0 : this.mpris.active?.duration ?? 0);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        progress.add_child(this.progress);
        const times = new St.BoxLayout({style_class: 'flower-times'});
        this.elapsed = label('0:00', 'flower-time');
        this.total = label('0:00', 'flower-time');
        this.total.x_expand = true;
        this.total.x_align = Clutter.ActorAlign.END;
        times.add_child(this.elapsed);
        times.add_child(this.total);
        progress.add_child(times);
        details.add_child(progress);
        const controls = new St.BoxLayout({style_class: 'flower-controls'});
        this.shuffle = button('media-playlist-shuffle-symbolic', 'Aleatorio', 'flower-control flower-small',
            () => this.mpris.property('Shuffle', 'b', !this.mpris.active?.shuffle), 15);
        this.previous = button('media-skip-backward-symbolic', 'Anterior', 'flower-control flower-skip',
            () => this.mpris.action('Previous'), 17);
        this.playDrawing = area(46, 46, (cr, w, h) => play(cr, w, h, this.playing,
            this.angle, this.playing && !this.reduced ? 1 + .01 * (1 - Math.cos(this.elapsedAnimation * TAU / 3)) : 1));
        this.playButton = new St.Button({child: this.playDrawing, style_class: 'flower-play',
            can_focus: true, accessible_name: 'Reproducir', y_align: Clutter.ActorAlign.CENTER});
        this.playButton.connect('clicked', () => this.mpris.action('PlayPause'));
        this.next = button('media-skip-forward-symbolic', 'Siguiente', 'flower-control flower-skip',
            () => this.mpris.action('Next'), 17);
        this.repeat = button('media-playlist-repeat-symbolic', 'Repetir', 'flower-control flower-small',
            () => {
                const next = {None: 'Playlist', Playlist: 'Track', Track: 'None'};
                this.mpris.property('LoopStatus', 's', next[this.mpris.active?.loop] ?? 'None');
            }, 15);
        for (const b of [this.shuffle, this.previous, this.playButton, this.next, this.repeat]) controls.add_child(b);
        details.add_child(controls);
        content.add_child(details);
        this.popup.add_child(content);
        item.add_child(this.popup);
        this.menu.addMenuItem(item);
        this.updatePopup(this.mpris?.active);
        this.tick();
    }

    destroyPopup() {
        if (!this.popup) return;
        this.popupItem.destroy();
        for (const key of ['popupItem', 'popup', 'backdrop', 'bigCover', 'eq', 'playerLabel',
            'title', 'artist', 'progress', 'elapsed', 'total', 'shuffle', 'previous',
            'playDrawing', 'playButton', 'next', 'repeat']) this[key] = null;
        this.amplitude = 0;
    }

    updatePopup(state) {
        if (!this.popup || !state) return;
        const metadata = state.metadata;
        this.title.text = metadata['xesam:title'] || 'Sin título';
        this.artist.text = (metadata['xesam:artist'] ?? []).join(', ') || 'Artista desconocido';
        this.playerLabel.text = state.name.toLowerCase().includes('spotify') ? 'Spotify' :
            state.name.replace('org.mpris.MediaPlayer2.', '').split('.')[0];
        this.playButton.accessible_name = this.playing ? 'Pausar' : 'Reproducir';
        this.next.reactive = state.CanGoNext !== false;
        this.previous.reactive = state.CanGoPrevious !== false;
        this.progress.reactive = state.CanSeek !== false;
        for (const [b, active] of [[this.shuffle, state.shuffle], [this.repeat, state.loop !== 'None']]) {
            if (active) b.add_style_pseudo_class('checked');
            else b.remove_style_pseudo_class('checked');
            b.set_style(active ? `color: rgb(${this.accent().map(c => Math.round(c * 255)).join(',')});` : null);
        }
        this.repeat.accessible_name = state.loop === 'Track' ? 'Repetir canción' : 'Repetir';
    }

    fraction() {
        const duration = this.mpris?.active?.duration ?? 0;
        return duration > 0 ? this.mpris.position() / duration : 0;
    }

    accent() {
        // Keep the equalizer visible even for a nearly black album cover.
        return (this.art?.color ?? [.75, .58, .8]).map(c => Math.max(.45, c));
    }

    update(state) {
        if (this.dead) return;
        this.visible = !!state;
        this.playing = state?.status === 'Playing';
        if (!state) {
            this.menu.close();
            this.artwork.cancelPending();
            this.artwork.release(this.art);
            this.art = null;
            this.artKey = null;
            this.pillCover.queue_repaint();
            this.updateClock();
            return;
        }
        const metadata = state.metadata;
        const title = metadata['xesam:title'] || 'Sin título';
        this.pillTitle.text = title;
        this.pillPlay.child.gicon = iconFile(this.playing ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic');
        this.pillPlay.accessible_name = this.playing ? 'Pausar' : 'Reproducir';
        this.pillNext.reactive = state.CanGoNext !== false;
        this.updatePopup(state);
        const key = `${metadata['mpris:trackid']}|${metadata['mpris:artUrl'] ?? ''}`;
        if (key !== this.artKey) {
            this.artKey = key;
            this.artwork.load(metadata['mpris:trackid'] ?? '', metadata['mpris:artUrl'] ?? '').then(art => {
                if (this.dead || key !== this.artKey) {
                    this.artwork.release(art);
                    return;
                }
                const previous = this.art;
                this.art = art;
                this.artwork.release(previous);
                this.pillCover.queue_repaint();
                this.bigCover?.queue_repaint();
                this.backdrop?.queue_repaint();
                this.eq?.queue_repaint();
            });
        }
        this.updateClock();
        this.repaint();
        this.tick();
    }

    updateClock() {
        if (!this.clock) return;
        const animated = !!this.mpris?.active && !this.reduced;
        const popupClock = animated && this.popupOpen && !!this.popup &&
            (this.playing || this.amplitude > .002);
        if (popupClock && !this.clock.is_playing()) {
            this.lastFrame = mono();
            this.clock.start();
        } else if (!popupClock && this.clock.is_playing()) this.clock.stop();
        // A 20px cover moves only 0.26px per tick at 10fps. Avoid keeping the
        // compositor's full frame clock awake while the popup is closed.
        const pillClock = animated && this.playing && !this.popupOpen;
        if (pillClock && !this.pillTimer) {
            this.lastPillFrame = mono();
            this.pillTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                const t = mono(), dt = t - this.lastPillFrame;
                this.lastPillFrame = t;
                this.advanceCover(dt);
                return GLib.SOURCE_CONTINUE;
            });
        } else if (!pillClock && this.pillTimer) {
            GLib.source_remove(this.pillTimer);
            this.pillTimer = 0;
        }
    }

    advanceCover(dt) {
        this.angle = (this.angle + dt * TAU / 24) % TAU;
        this.elapsedAnimation += dt;
        this.pillCover.queue_repaint();
    }

    frame() {
        if (this.dead) return;
        const t = mono();
        const dt = Math.min(.1, t - this.lastFrame);
        if (dt < 1 / 32) return;
        this.lastFrame = t;
        if (this.playing && !this.reduced) {
            this.advanceCover(dt);
        }
        if (!this.popupOpen || !this.popup) return;
        const target = this.playing && !this.reduced ? 1 : 0;
        this.amplitude += (target - this.amplitude) * (1 - Math.exp(-dt / .13));
        if (Math.abs(target - this.amplitude) < .002) this.amplitude = target;
        if (this.playing) this.phase = (this.phase + dt * .3) % 1;
        this.progress.queue_repaint();
        this.playDrawing.queue_repaint();
        this.eq.queue_repaint();
        if (!this.playing && this.amplitude === 0) this.updateClock();
    }

    repaint() {
        if (this.popupOpen && this.popup) {
            this.progress.queue_repaint();
            this.playDrawing.queue_repaint();
            this.eq.queue_repaint();
        }
    }

    tick() {
        if (this.dead || !this.mpris?.active) return;
        this.pillProgress.queue_repaint();
        if (this.popupOpen && this.popup) {
            this.elapsed.text = fmt(this.mpris.position());
            this.total.text = fmt(this.mpris.active.duration);
            if (!this.playing || this.reduced) this.progress.queue_repaint();
        }
    }

    cleanup() {
        if (this.dead) return;
        this.dead = true;
        if (this.secondId) GLib.source_remove(this.secondId);
        this.secondId = 0;
        if (this.pillTimer) GLib.source_remove(this.pillTimer);
        this.pillTimer = 0;
        this.clock.stop();
        this.clock.disconnect(this.clockId);
        this.clock = null;
        this.settings.disconnect(this.settingsId);
        this.menu.disconnect(this.menuId);
        this.menu.disconnect(this.closedId);
        this.menu.open = this.nativeOpen;
        this.nativeOpen = null;
        this.destroyPopup();
        this.mpris.destroy();
        this.artwork.destroy();
        this.artwork.release(this.art);
        this.art = null;
    }

    _onDestroy() {
        this.cleanup();
        super._onDestroy();
    }
});
