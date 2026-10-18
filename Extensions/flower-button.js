/*
 * FlowerButton — fondo de flor suave para el botón play/pausa.
 *
 * Por qué se veía "trabado": Spotify vuelve a dibujar su botón a cada rato y eso
 * reinicia cualquier animación CSS, así que el giro nunca avanzaba. Aquí el ángulo
 * se calcula a partir del reloj (performance.now), así que aunque el botón se
 * vuelva a crear, el giro sigue exactamente donde iba.
 *
 * - Flor dibujada como path SVG de 240 puntos (bordes suaves, sin facetas).
 * - Un solo requestAnimationFrame compartido por todos los botones.
 * - Gira solo mientras suena; en pausa se queda quieta en su ángulo (sin saltos).
 * - Se detiene con la ventana oculta y respeta prefers-reduced-motion.
 *
 * Uso:
 *   const fb = new FlowerButton(botonPlay, { size: 40 });
 *   fb.setPlaying(true|false);
 *   fb.destroy();
 *   // o, con Spicetify:  FlowerButton.bindSpicetify(fb);
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var instances = new Set();
  var raf = 0;
  var angle = 0;          // grados, compartido: todas las flores giran igual
  var lastT = 0;
  var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function flowerPath(lobes, amp, points) {
    var d = '';
    for (var i = 0; i <= points; i++) {
      var a = (i / points) * Math.PI * 2;
      var r = 50 * (1 - amp + amp * Math.cos(lobes * a));
      var x = 50 + r * Math.cos(a), y = 50 + r * Math.sin(a);
      d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    return d + 'Z';
  }

  function anyPlaying() {
    var on = false;
    instances.forEach(function (fb) { if (fb.playing) on = true; });
    return on;
  }

  function tick(t) {
    raf = 0;
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
    lastT = t;
    angle = (angle + dt * (360 / FlowerButton.period)) % 360;
    instances.forEach(function (fb) { fb._apply(); });
    if (anyPlaying() && !document.hidden && !reduced) raf = requestAnimationFrame(tick);
    else lastT = 0;
  }

  function kick() {
    if (!raf && anyPlaying() && !document.hidden && !reduced) raf = requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', kick);

  function FlowerButton(button, opts) {
    opts = opts || {};
    if (button.__flower && !button.__flower._dead) return button.__flower;
    button.__flower = this;
    this.button = button;
    this.size = opts.size || 40;
    this.lobes = opts.lobes || 10;
    this.amp = opts.amplitude != null ? opts.amplitude : 0.028;
    this.color = opts.color || '#fff';
    this.playing = false;
    this._unbinds = [];

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;left:50%;top:50%;width:' + this.size + 'px;height:' + this.size +
      'px;margin:' + (-this.size / 2) + 'px 0 0 ' + (-this.size / 2) + 'px;pointer-events:none;z-index:0;' +
      'overflow:visible;will-change:transform;transition:scale .2s ease;';
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', flowerPath(this.lobes, this.amp, 240));
    path.setAttribute('fill', this.color);
    svg.appendChild(path);
    this.svg = svg;

    this._attach();
    // Si Spotify vuelve a crear el contenido del botón, volvemos a poner la flor.
    // Observamos SOLO el botón (no todo el documento).
    var self = this;
    this.mo = new MutationObserver(function () { if (!svg.isConnected) self._attach(); });
    this.mo.observe(button, { childList: true });
    instances.add(this);
    this._apply();
  }

  FlowerButton.period = 24; // segundos por vuelta: sutil, pero se nota que está vivo

  FlowerButton.prototype._attach = function () {
    var b = this.button;
    if (!b.isConnected) return this.destroy();
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    // el ícono queda por encima de la flor
    Array.prototype.forEach.call(b.children, function (c) {
      if (c !== this.svg && getComputedStyle(c).position === 'static') { c.style.position = 'relative'; c.style.zIndex = '1'; }
    }, this);
    b.insertBefore(this.svg, b.firstChild);
  };

  FlowerButton.prototype._apply = function () {
    if (!this.button.isConnected) return this.destroy();
    // giro (por reloj) + respiración muy leve solo mientras suena
    var s = this.playing && !reduced ? 1 + 0.02 * Math.sin(performance.now() / 3000 * Math.PI * 2) : 1;
    this.svg.style.transform = 'rotate(' + angle.toFixed(2) + 'deg) scale(' + s.toFixed(4) + ')';
  };

  FlowerButton.prototype.setPlaying = function (on) {
    if (this._dead) return;
    this.playing = !!on;
    this._apply();
    kick();
  };

  FlowerButton.prototype.destroy = function () {
    if (this._dead) return;
    this._dead = true;
    this._unbinds.forEach(function (f) { try { f(); } catch (e) {} });
    this.mo.disconnect();
    this.svg.remove();
    instances.delete(this);
    if (this.button.__flower === this) this.button.__flower = null;
  };

  FlowerButton.bindSpicetify = function (fb) {
    var P = global.Spicetify && global.Spicetify.Player;
    if (!P) return function () {};
    function sync() { fb.setPlaying(P.isPlaying()); }
    P.addEventListener('onplaypause', sync);
    P.addEventListener('songchange', sync);
    sync();
    var off = function () {
      P.removeEventListener('onplaypause', sync);
      P.removeEventListener('songchange', sync);
    };
    fb._unbinds.push(off);
    return off;
  };

  global.FlowerButton = FlowerButton;
})(window);
