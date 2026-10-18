/*
 * WavyProgress — barra de progreso ondulada, limpia y ligera.
 *
 * - Un <canvas> nítido (respeta devicePixelRatio) encima del riel; no captura clics,
 *   así que el slider nativo de Spotify sigue funcionando debajo.
 * - La onda está fija en pantalla: solo se desplaza la fase. La atenuación de los
 *   extremos depende de la posición x, NO de la fase, así que la forma nunca "tiembla".
 * - La cabeza avanza de forma continua (extrapola entre lecturas) y no a saltos de 1 s.
 * - En pausa, la amplitud se aplana suavemente y el bucle se detiene (0 CPU).
 * - Se pausa sola si la ventana está oculta o el elemento no está en el DOM.
 *
 * Uso:
 *   const wp = new WavyProgress(contenedorDelSlider);
 *   wp.setDuration(ms); wp.setProgress(ms); wp.setPlaying(true|false);
 *   wp.destroy();
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  function smoothstep(e0, e1, x) {
    var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  function WavyProgress(host, opts) {
    opts = opts || {};
    // Una sola instancia por contenedor: si ya existe, la reutiliza (evita fugas de memoria)
    if (host.__wavy && !host.__wavy._dead) return host.__wavy;
    host.__wavy = this;
    this._unbinds = [];
    this.host = host;
    this.amp = opts.amplitude != null ? opts.amplitude : 2.2;          // px
    this.wavelength = opts.wavelength != null ? opts.wavelength : 30;  // px
    this.speed = opts.speed != null ? opts.speed : 0.3;                // periodos por segundo (lento)
    this.stroke = opts.stroke != null ? opts.stroke : 2.5;             // grosor de la onda
    this.trackStroke = opts.trackStroke != null ? opts.trackStroke : 3;
    this.color = opts.color || 'rgba(255,255,255,0.95)';
    this.trackColor = opts.trackColor || 'rgba(255,255,255,0.18)';
    this.gap = opts.gap != null ? opts.gap : 4;                        // separación cabeza → riel
    this.taperStart = 14;   // px donde la onda "nace"
    this.taperEnd = 12;     // px antes de la cabeza donde "muere"

    this.duration = 1;
    this.posMs = 0;
    this.posAt = performance.now();
    this.playing = false;
    this.ampNow = 0;        // amplitud animada 0..1
    this.phase = 0;
    this.raf = 0;
    this.last = 0;
    this.w = 0; this.h = 0; this.dpr = 1;

    var c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block;';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');

    this.reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var self = this;
    this._loop = function (t) { self._frame(t); };
    this._onVis = function () { if (!document.hidden) self._kick(); };
    document.addEventListener('visibilitychange', this._onVis);
    this.ro = new ResizeObserver(function () { self._resize(); self._draw(); });
    this.ro.observe(host);
    this._resize();
    this._draw();
  }

  WavyProgress.prototype.setDuration = function (ms) {
    this.duration = Math.max(1, ms || 1);
    this._draw();
  };

  // Llamar cada vez que Spotify reporte progreso (cada 250–1000 ms está bien).
  WavyProgress.prototype.setProgress = function (ms) {
    if (this._dead) return;
    if (!this.host.isConnected) return this.destroy();
    this.posMs = Math.max(0, Math.min(this.duration, ms));
    this.posAt = performance.now();
    if (!this.raf) this._draw();
  };

  WavyProgress.prototype.setPlaying = function (on) {
    if (this._dead) return;
    on = !!on;
    if (on === this.playing) return;
    // fija la posición extrapolada al pausar para que la cabeza no retroceda
    this.posMs = this._currentMs();
    this.posAt = performance.now();
    this.playing = on;
    this._kick();
  };

  WavyProgress.prototype.destroy = function () {
    if (this._dead) return;
    this._dead = true;
    this._unbinds.forEach(function (f) { try { f(); } catch (e) {} });
    this._unbinds = [];
    if (this.host.__wavy === this) this.host.__wavy = null;
    cancelAnimationFrame(this.raf); this.raf = 0;
    document.removeEventListener('visibilitychange', this._onVis);
    this.ro.disconnect();
    this.canvas.remove();
  };

  WavyProgress.prototype._currentMs = function () {
    if (!this.playing) return this.posMs;
    var ms = this.posMs + (performance.now() - this.posAt);
    return Math.min(this.duration, ms);
  };

  WavyProgress.prototype._resize = function () {
    var r = this.host.getBoundingClientRect();
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height; this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
  };

  WavyProgress.prototype._kick = function () {
    if (this.raf || document.hidden) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._loop);
  };

  WavyProgress.prototype._frame = function (t) {
    this.raf = 0;
    if (!this.host.isConnected) return this.destroy();
    var dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;

    var target = this.playing && !this.reduced ? 1 : 0;
    // easing exponencial de la amplitud (~400 ms)
    this.ampNow += (target - this.ampNow) * (1 - Math.exp(-dt / 0.13));
    if (Math.abs(target - this.ampNow) < 0.002) this.ampNow = target;

    if (this.playing && !this.reduced) this.phase = (this.phase + dt * this.speed) % 1;

    this._draw();

    // sigue animando solo si hace falta
    if (this.playing || this.ampNow !== target) this._kick();
  };

  WavyProgress.prototype._draw = function () {
    var ctx = this.ctx, w = this.w, h = this.h, dpr = this.dpr;
    if (!w || !h) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var pad = Math.max(this.stroke, this.trackStroke) / 2 + 0.5; // que las puntas redondas no se corten
    var usable = w - pad * 2;
    var head = pad + usable * (this._currentMs() / this.duration);
    var cy = h / 2;

    // Riel restante
    var trackFrom = head + this.gap;
    if (trackFrom < w - pad) {
      ctx.beginPath();
      ctx.moveTo(trackFrom, cy);
      ctx.lineTo(w - pad, cy);
      ctx.strokeStyle = this.trackColor;
      ctx.lineWidth = this.trackStroke;
      ctx.stroke();
    }

    // Onda reproducida
    if (head <= pad + 0.5) return;
    var A = this.amp * this.ampNow;
    var k = TAU / this.wavelength;
    var ph = this.phase * TAU;
    var len = head - pad;
    var step = 0.5; // muestreo fino = curva suave

    ctx.beginPath();
    for (var x = 0; x <= len + 0.001; x += step) {
      var env = smoothstep(0, this.taperStart, x) * smoothstep(0, this.taperEnd, len - x);
      var y = cy + A * env * Math.sin(x * k - ph);
      if (x === 0) ctx.moveTo(pad + x, y); else ctx.lineTo(pad + x, y);
    }
    ctx.lineTo(head, cy);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.stroke;
    ctx.stroke();
  };

  /*
   * Conexión con Spicetify (opcional). Devuelve una función para desconectar.
   *   const off = WavyProgress.bindSpicetify(wp);
   */
  WavyProgress.bindSpicetify = function (wp) {
    var P = global.Spicetify && global.Spicetify.Player;
    if (!P) return function () {};
    function sync() {
      wp.setDuration(P.getDuration());
      wp.setProgress(P.getProgress());
      wp.setPlaying(P.isPlaying());
    }
    function onProg(e) { wp.setProgress(e && e.data != null ? e.data : P.getProgress()); }
    P.addEventListener('songchange', sync);
    P.addEventListener('onplaypause', sync);
    P.addEventListener('onprogress', onProg);
    sync();
    var off = function () {
      P.removeEventListener('songchange', sync);
      P.removeEventListener('onplaypause', sync);
      P.removeEventListener('onprogress', onProg);
    };
    wp._unbinds.push(off); // destroy() también desconecta los listeners
    return off;
  };

  global.WavyProgress = WavyProgress;
})(window);
