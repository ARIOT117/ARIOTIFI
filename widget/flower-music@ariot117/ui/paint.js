import Cairo from 'cairo';
import St from 'gi://St';

export const TAU = Math.PI * 2;
export const clamp = x => Math.max(0, Math.min(1, x));
export const fmt = value => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};
const smooth = (edge, x) => { const t = clamp(x / edge); return t * t * (3 - 2 * t); };

export function rounded(cr, x, y, w, h, r) {
    cr.newSubPath();
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    cr.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    cr.closePath();
}

/** Cubic Hermite segments with analytic tangents: no polygon edges. */
export function flower(cr, cx, cy, radius, amplitude, angle = 0) {
    const sample = a => {
        const r = radius * (1 - amplitude + amplitude * Math.cos(10 * a));
        const dr = -radius * amplitude * 10 * Math.sin(10 * a);
        return [cx + r * Math.cos(a + angle), cy + r * Math.sin(a + angle),
            dr * Math.cos(a + angle) - r * Math.sin(a + angle),
            dr * Math.sin(a + angle) + r * Math.cos(a + angle)];
    };
    const step = TAU / 100;
    let p = sample(0);
    cr.moveTo(p[0], p[1]);
    for (let i = 1; i <= 100; i++) {
        const q = sample(i * step);
        cr.curveTo(p[0] + p[2] * step / 3, p[1] + p[3] * step / 3,
            q[0] - q[2] * step / 3, q[1] - q[3] * step / 3, q[0], q[1]);
        p = q;
    }
    cr.closePath();
}

export function area(width, height, paint, props = {}) {
    const actor = new St.DrawingArea({width, height, ...props});
    actor.connect('repaint', () => {
        const cr = actor.get_context();
        try {
            cr.setAntialias(Cairo.Antialias.BEST);
            cr.setLineCap(Cairo.LineCap.ROUND);
            cr.setLineJoin(Cairo.LineJoin.ROUND);
            const [w, h] = actor.get_surface_size();
            paint(cr, w, h);
        } finally { cr.$dispose(); }
    });
    return actor;
}

export function cover(cr, w, h, art, small = false, angle = 0) {
    cr.save();
    if (small) {
        cr.translate(w / 2, h / 2);
        cr.rotate(angle);
        cr.translate(-w / 2, -h / 2);
    }
    if (small) {
        flower(cr, w / 2, h / 2, Math.min(w, h) / 2, .05);
    }
    else rounded(cr, 0, 0, w, h, 16);
    cr.clip();
    if (art?.surface) {
        const s = art.surface;
        const sourceWidth = s.getWidth();
        const sourceHeight = s.getHeight();
        const scale = Math.max(w / sourceWidth, h / sourceHeight);
        cr.translate((w - sourceWidth * scale) / 2,
            (h - sourceHeight * scale) / 2);
        cr.scale(scale, scale);
        cr.setSourceSurface(s, 0, 0);
        cr.paint();
    } else {
        const color = art?.color ?? [.4, .3, .5];
        const gradient = new Cairo.LinearGradient(0, 0, w, h);
        gradient.addColorStopRGB(0, ...color);
        gradient.addColorStopRGB(1, .08, .06, .12);
        cr.setSource(gradient);
        cr.paint();
        cr.setSourceRGBA(1, 1, 1, .75);
        cr.setLineWidth(Math.max(1.4, w * .025));
        cr.moveTo(w * .55, h * .62);
        cr.lineTo(w * .55, h * .32);
        cr.lineTo(w * .7, h * .29);
        cr.stroke();
        cr.arc(w * .46, h * .65, w * .09, 0, TAU);
        cr.fill();
    }
    cr.restore();
    if (!small) {
        rounded(cr, .5, .5, w - 1, h - 1, 15.5);
        cr.setSourceRGBA(1, 1, 1, .06);
        cr.setLineWidth(1);
        cr.stroke();
    }
}

export function background(cr, w, h, art) {
    cr.save();
    rounded(cr, 0, 0, w, h, 22);
    cr.clip();
    cr.setSourceRGB(5 / 255, 5 / 255, 6 / 255);
    cr.paint();
    const color = art?.color ?? [.3, .25, .35];
    // Analytic soft gradients: no blur shader, cover texture or frame updates.
    for (const [x, y, radius, alpha] of [[80, h / 2, 156, .16], [w - 12, 8, 138, .14]]) {
        const glow = new Cairo.RadialGradient(x, y, 0, x, y, radius);
        glow.addColorStopRGBA(0, ...color, alpha);
        glow.addColorStopRGBA(.48, ...color, alpha * .42);
        glow.addColorStopRGBA(1, ...color, 0);
        cr.setSource(glow);
        cr.paint();
    }
    const shade = new Cairo.RadialGradient(40, h / 2, 0, 40, h / 2, w - 40);
    for (const [stop, alpha] of [[0, .35], [.6, .88], [1, .96]])
        shade.addColorStopRGBA(stop, 5 / 255, 5 / 255, 6 / 255, alpha);
    cr.setSource(shade);
    cr.paint();
    cr.setSourceRGBA(1, 1, 1, .06);
    cr.setLineWidth(1);
    cr.moveTo(22, 1.5);
    cr.lineTo(w - 22, 1.5);
    cr.stroke();
    cr.restore();
    rounded(cr, .5, .5, w - 1, h - 1, 21.5);
    cr.setSourceRGBA(1, 1, 1, .07);
    cr.setLineWidth(1);
    cr.stroke();
}

export function wave(cr, w, h, fraction, phase, amplitude, pill = false) {
    const pad = pill ? 1 : 2;
    const head = pad + Math.max(0, w - 2 * pad) * clamp(fraction);
    const cy = h / 2;
    cr.setSourceRGBA(1, 1, 1, pill ? .12 : .18);
    cr.setLineWidth(pill ? 2 : 3);
    if (head + (pill ? 0 : 4) < w - pad) {
        cr.moveTo(head + (pill ? 0 : 4), cy);
        cr.lineTo(w - pad, cy);
        cr.stroke();
    }
    cr.setSourceRGBA(1, 1, 1, pill ? .75 : .95);
    cr.setLineWidth(pill ? 2 : 2.5);
    const len = head - pad;
    if (len <= 0) return;
    for (let x = 0; x <= len; x += .5) {
        const env = smooth(14, x) * smooth(12, len - x);
        const y = cy + (pill ? 0 : 2.2 * amplitude * env * Math.sin(x * TAU / 30 - phase * TAU));
        if (x === 0) cr.moveTo(pad + x, y);
        else cr.lineTo(pad + x, y);
    }
    cr.lineTo(head, cy);
    cr.stroke();
}

export function play(cr, w, h, playing, angle, breathing) {
    const size = Math.min(w, h);
    flower(cr, w / 2, h / 2, (size / 2 - .8) * breathing, .028, angle);
    cr.setSourceRGB(1, 1, 1);
    cr.fill();
    cr.setSourceRGB(.07, .06, .08);
    cr.save();
    cr.translate(w / 2, h / 2);
    cr.scale(18 / 22, 18 / 22);
    const cx = 0, cy = 0;
    if (playing) {
        rounded(cr, cx - 7.2, cy - 7.5, 4.2, 15, 1.4);
        rounded(cr, cx + 3, cy - 7.5, 4.2, 15, 1.4);
    } else {
        cr.moveTo(cx - 5.3, cy - 8);
        cr.curveTo(cx - 5.3, cy - 9, cx - 4.3, cy - 9, cx - 3.5, cy - 8.4);
        cr.lineTo(cx + 8.4, cy - .9);
        cr.curveTo(cx + 9.2, cy - .4, cx + 9.2, cy + .4, cx + 8.4, cy + .9);
        cr.lineTo(cx - 3.5, cy + 8.4);
        cr.curveTo(cx - 4.3, cy + 9, cx - 5.3, cy + 9, cx - 5.3, cy + 8);
        cr.closePath();
    }
    cr.fill();
    cr.restore();
}
