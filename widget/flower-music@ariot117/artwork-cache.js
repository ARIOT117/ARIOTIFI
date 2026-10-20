import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';
import Soup from 'gi://Soup?version=3.0';
import Cairo from 'cairo';

const SIZE = 256;
const LIMIT = 10;

/** LRU contains JPEG bytes + colors, never Cairo surfaces or decoded originals. */
export class Artwork {
    constructor() {
        this.dir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'flower-music']);
        GLib.mkdir_with_parents(this.dir, 0o700);
        this.session = new Soup.Session({timeout: 12});
        this.cache = new Map();
        this.serial = 0;
        this.cancel = null;
        this.dead = false;
        this.liveSurfaces = 0;
        this.prune();
    }

    prune(protectedName = null) {
        const dir = Gio.File.new_for_path(this.dir);
        const iterator = dir.enumerate_children('standard::name,time::modified,time::modified-usec', Gio.FileQueryInfoFlags.NONE, null);
        const files = [];
        let info;
        while ((info = iterator.next_file(null))) {
            const name = info.get_name();
            // Remove only the old extension's generated PNG cache, not arbitrary files.
            if (/^[a-f0-9]{64}\.png$/.test(name)) dir.get_child(name).delete(null);
            else if (/^[a-f0-9]{64}\.jpg$/.test(name)) files.push(info);
        }
        iterator.close(null);
        files.sort((a, b) => Number(b.get_name() === protectedName) - Number(a.get_name() === protectedName) ||
            b.get_attribute_uint64('time::modified') - a.get_attribute_uint64('time::modified') ||
            b.get_attribute_uint32('time::modified-usec') - a.get_attribute_uint32('time::modified-usec'));
        for (const file of files.slice(LIMIT)) dir.get_child(file.get_name()).delete(null);
    }

    cancelPending() {
        ++this.serial;
        this.cancel?.cancel();
        this.cancel = null;
    }

    async decode(stream, cancel) {
        try {
            return await new Promise((resolve, reject) => GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(
                stream, SIZE, SIZE, true, cancel, (_s, result) => {
                    try { resolve(GdkPixbuf.Pixbuf.new_from_stream_finish(result)); }
                    catch (e) { reject(e); }
                }));
        } finally { stream.close(null); }
    }

    color(pixbuf) {
        const small = pixbuf.scale_simple(8, 8, GdkPixbuf.InterpType.BILINEAR);
        const pixels = small.get_pixels(), stride = small.rowstride, channels = small.n_channels;
        const color = [0, 0, 0];
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
            for (let c = 0; c < 3; c++) color[c] += pixels[y * stride + x * channels + c] / (64 * 255);
        return color;
    }

    surface(pixbuf) {
        // GJS Cairo exposes only createFromPNG. This 256px decoding bridge is
        // unlinked immediately, never cached; persistent/memory artwork is JPEG.
        const [file, io] = Gio.File.new_tmp('flower-music-XXXXXX.png');
        io.close(null);
        try {
            pixbuf.savev(file.get_path(), 'png', [], []);
            const result = Cairo.ImageSurface.createFromPNG(file.get_path());
            this.liveSurfaces++;
            return result;
        } finally { file.delete(null); }
    }

    release(art) {
        if (!art?.surface) return;
        art.surface.finish();
        art.surface = null;
        this.liveSurfaces--;
    }

    async load(track, url) {
        this.cancelPending();
        const serial = this.serial;
        if (this.dead || !url || !/^(https?:|file:)/.test(url)) return null;
        const cancel = this.cancel = new Gio.Cancellable();
        const key = `${track}|${url}`;
        const hash = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, `jpeg256-v1|${key}`, -1);
        const path = `${this.dir}/${hash}.jpg`;
        let pixbuf = null;
        try {
            let entry = this.cache.get(key);
            if (!entry) {
                if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                    const bytes = GLib.Bytes.new(GLib.file_get_contents(path)[1]);
                    pixbuf = await this.decode(Gio.MemoryInputStream.new_from_bytes(bytes), cancel);
                    entry = {bytes, color: this.color(pixbuf)};
                } else {
                    let stream;
                    if (url.startsWith('file:')) {
                        const file = Gio.File.new_for_uri(url);
                        stream = await new Promise((resolve, reject) => file.read_async(GLib.PRIORITY_DEFAULT,
                            cancel, (f, r) => { try { resolve(f.read_finish(r)); } catch (e) { reject(e); } }));
                    } else {
                        const message = Soup.Message.new('GET', url);
                        stream = await new Promise((resolve, reject) => this.session.send_async(message,
                            GLib.PRIORITY_DEFAULT, cancel, (session, result) => {
                                try {
                                    const input = session.send_finish(result);
                                    if (message.status_code < 200 || message.status_code >= 300) {
                                        input.close(null);
                                        throw new Error(`HTTP ${message.status_code}`);
                                    }
                                    resolve(input);
                                } catch (e) { reject(e); }
                            }));
                    }
                    pixbuf = await this.decode(stream, cancel);
                    if (this.dead || serial !== this.serial) return null;
                    const [ok, jpeg] = pixbuf.save_to_bufferv('jpeg', ['quality'], ['82']);
                    if (!ok) throw new Error('No se pudo codificar la portada reducida');
                    entry = {bytes: GLib.Bytes.new(jpeg), color: this.color(pixbuf)};
                    GLib.file_set_contents(path, jpeg);
                }
            }
            if (this.dead || serial !== this.serial) return null;
            // Refresh LRU order without keeping any decoded image in the cache.
            this.cache.delete(key);
            this.cache.set(key, entry);
            while (this.cache.size > LIMIT) this.cache.delete(this.cache.keys().next().value);
            const file = Gio.File.new_for_path(path);
            if (!file.query_exists(cancel)) GLib.file_set_contents(path, entry.bytes.get_data());
            const time = GLib.get_real_time();
            file.set_attribute_uint64('time::modified', Math.floor(time / 1e6), Gio.FileQueryInfoFlags.NONE, cancel);
            file.set_attribute_uint32('time::modified-usec', time % 1e6, Gio.FileQueryInfoFlags.NONE, cancel);
            this.prune(`${hash}.jpg`);
            if (!pixbuf) pixbuf = await this.decode(Gio.MemoryInputStream.new_from_bytes(entry.bytes), cancel);
            if (this.dead || serial !== this.serial) return null;
            return {surface: this.surface(pixbuf), color: entry.color};
        } catch (e) {
            if (!cancel.is_cancelled()) console.warn(`Flower Music artwork: ${e.message}`);
            return null;
        } finally {
            pixbuf = null;
            if (this.cancel === cancel) this.cancel = null;
        }
    }

    destroy() {
        this.dead = true;
        this.cancelPending();
        this.session.abort();
        this.cache.clear();
    }
}
