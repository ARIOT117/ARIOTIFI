// Temporary instrumentation, invoked explicitly through GNOME Looking Glass.
// Not imported by the widget or installed during normal use.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

export async function run(dir) {
    const uuid = 'flower-music@ariot117';
    const settings = new Gio.Settings({schema_id: 'org.gnome.shell'});
    const original = {
        enabled: settings.get_strv('enabled-extensions'),
        disabled: settings.get_strv('disabled-extensions'),
        popup: !!Main.extensionManager.lookup(uuid)?.stateObj?.indicator?.popupOpen,
    };
    let detached = null;
    let detachedClose = null;
    let busy = false;
    let previous = null;
    let watchdog = 0;
    const save = value => GLib.file_set_contents(`${dir}/response.json`, JSON.stringify(value));
    const status = () => {
        const i = Main.extensionManager.lookup(uuid)?.stateObj?.indicator;
        return {enabled: !!i, popupOpen: !!i?.popupOpen, mounted: !!i?.popup,
            timeline: !!i?.clock?.is_playing(), positionTimer: !!i?.mpris?.pollId,
            cacheEntries: i?.artwork?.cache?.size ?? 0,
            liveSurfaces: i?.artwork?.liveSurfaces ?? 0, playing: !!i?.playing};
    };
    const close = () => {
        if (detached) {
            if (detachedClose) detached.menu.close = detachedClose;
            detachedClose = null;
            detached.menu.close(false);
            Main.panel.menuManager.addMenu(detached.menu);
            detached = null;
        }
        Main.extensionManager.lookup(uuid)?.stateObj?.indicator?.menu.close(false);
    };
    const open = () => {
        const i = Main.extensionManager.lookup(uuid)?.stateObj?.indicator;
        if (!i) throw new Error('Flower Music is not enabled');
        if (!detached) {
            Main.panel.menuManager.removeMenu(i.menu);
            detached = i;
            // Keep outside clicks from invalidating the bounded render sample.
            // No modal grab: the rest of the desktop remains usable.
            detachedClose = i.menu.close;
            i.menu.close = () => {};
        }
        i.menu.open(false);
    };
    const cleanup = () => {
        close();
        if (original.enabled.includes(uuid) && !original.disabled.includes(uuid))
            Main.extensionManager.enableExtension(uuid);
        else Main.extensionManager.disableExtension(uuid);
        settings.set_strv('enabled-extensions', original.enabled);
        settings.set_strv('disabled-extensions', original.disabled);
        if (original.popup) Main.extensionManager.lookup(uuid)?.stateObj?.indicator?.menu.open(false);
    };
    await Scripting.sleep(1200);
    Main.lookingGlass.close();
    save({id:'ready', original, state:status()});
    const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
        if (busy) return GLib.SOURCE_CONTINUE;
        let command;
        try {
            command = JSON.parse(new TextDecoder().decode(GLib.file_get_contents(`${dir}/command.json`)[1]));
        } catch (_) { return GLib.SOURCE_CONTINUE; }
        if (command.id === previous) return GLib.SOURCE_CONTINUE;
        previous = command.id;
        busy = true;
        (async () => {
            try {
                if (command.action === 'off') { close(); Main.extensionManager.disableExtension(uuid); }
                else if (command.action === 'closed') {
                    Main.extensionManager.enableExtension(uuid); close();
                } else if (command.action === 'open') open();
                else if (command.action === 'focus') {
                    const window = global.get_window_actors().map(a => a.meta_window)
                        .find(w => w.get_title() === 'Pulso');
                    if (!window) throw new Error('Pulso window not found');
                    window.maximize(Meta.MaximizeFlags.BOTH);
                    Main.activateWindow(window);
                } else if (command.action === 'screenshot') {
                    if (!/^[-a-z0-9]+\.png$/.test(command.name)) throw new Error('Invalid screenshot name');
                    const window = global.get_window_actors().map(a => a.meta_window)
                        .find(w => w.get_title() === 'Pulso');
                    if (!window) throw new Error('Pulso window not found');
                    window.maximize(Meta.MaximizeFlags.BOTH);
                    Main.activateWindow(window);
                    await Scripting.sleep(1000);
                    const monitor = Main.layoutManager.monitors[window.get_monitor()];
                    const stream = Gio.File.new_for_path(`${dir}/${command.name}`).replace(null,false,0,null);
                    const shot = new Shell.Screenshot();
                    try { await shot.screenshot_area(monitor.x,monitor.y,monitor.width,monitor.height,stream); }
                    finally { stream.close(null); shot.run_dispose(); }
                } else if (command.action === 'finish') {
                    cleanup(); GLib.source_remove(timer);
                    if (watchdog) GLib.source_remove(watchdog);
                } else if (command.action !== 'status') throw new Error('Unknown command');
                await Scripting.sleep(350);
                save({id:command.id, ok:true, state:status()});
            } catch (error) { save({id:command.id,ok:false,error:String(error)}); }
            finally { busy=false; }
        })();
        return GLib.SOURCE_CONTINUE;
    });
    // Restore state even if the external sampler disappears.
    watchdog = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 600, () => {
        if (previous !== null && busy) return GLib.SOURCE_CONTINUE;
        cleanup();
        if (GLib.MainContext.default().find_source_by_id(timer)) GLib.source_remove(timer);
        return GLib.SOURCE_REMOVE;
    });
}
