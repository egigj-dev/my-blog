/* ============================================================================
   viz-core.js — shared helpers for the article visualisations.
   Loaded once per article page; exposes window.VizCore.
   Deliberately small: only what more than one component actually needs.
   ========================================================================== */
(function(){
'use strict';

// REDUCED: honour the OS "reduce motion" setting everywhere.
var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var LIBS = {
    three: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    d3:    'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js',
    gsap:  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js'
};

var _loading = {};   // src -> Promise, so each library is fetched at most once

// loadScript(src): inject a <script> and resolve when it is ready.
function loadScript(src){
    if (_loading[src]) return _loading[src];
    _loading[src] = new Promise(function(res, rej){
        var s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = function(){ res(); };
        s.onerror = function(){ rej(new Error('failed to load ' + src)); };
        document.head.appendChild(s);
    });
    return _loading[src];
}
// loadLib('three'|'d3'|'gsap'): convenience wrapper around loadScript.
function loadLib(name){ return loadScript(LIBS[name]); }

// webglOK(): true when a WebGL context can actually be created.
function webglOK(){
    try {
        var c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch(e){ return false; }
}

// onApproach(el, cb, margin): fire cb once when el nears the viewport.
// Used to defer heavy library loading until it is actually needed.
function onApproach(el, cb, margin){
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function(entries, obs){
        for (var i = 0; i < entries.length; i++){
            if (entries[i].isIntersecting){ obs.disconnect(); cb(); return; }
        }
    }, { rootMargin: (margin || 320) + 'px' });
    io.observe(el);
}

// onVisible(el, cb): cb(true/false) as el enters and leaves the viewport.
// Lets components stop rendering while off-screen.
function onVisible(el, cb){
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    var io = new IntersectionObserver(function(entries){
        for (var i = 0; i < entries.length; i++) cb(entries[i].isIntersecting);
    }, { threshold: 0.05 });
    io.observe(el);
}

// ticker(fn): drive fn(seconds) each frame. Uses GSAP's ticker when present
// so animations stay on one clock; falls back to requestAnimationFrame.
function ticker(fn){
    if (REDUCED) { fn(0.7); return function(){}; }
    if (window.gsap && window.gsap.ticker){
        window.gsap.ticker.add(fn);
        return function(){ window.gsap.ticker.remove(fn); };
    }
    var t0 = performance.now(), stop = false;
    (function loop(now){
        if (stop) return;
        fn((now - t0) / 1000);
        requestAnimationFrame(loop);
    })(t0);
    return function(){ stop = true; };
}

// palette(): read the article's CSS custom properties so components follow
// the existing light/dark toggle without duplicating any colour values.
function palette(){
    var cs = getComputedStyle(document.body);
    function get(n, fb){ var v = cs.getPropertyValue(n); return (v && v.trim()) || fb; }
    return {
        bg:     get('--bg-dark', '#0f1e2e'),
        card:   get('--bg-card', '#1a2e42'),
        text:   get('--text-primary', '#e8f0f5'),
        muted:  get('--text-secondary', '#a0adb8'),
        accent: get('--accent', '#00d9ff'),
        border: get('--border', '#2a3f5a')
    };
}

// onThemeChange(cb): call cb whenever the body class changes (theme toggle).
function onThemeChange(cb){
    new MutationObserver(cb).observe(document.body, { attributes:true, attributeFilter:['class'] });
}

// rng(seed): deterministic mulberry32 PRNG, so generated layouts are stable.
function rng(seed){
    return function(){
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

var lerp   = function(a,b,t){ return a + (b-a)*t; };
var clamp  = function(v,a,b){ return v<a?a:(v>b?b:v); };
var smooth = function(k){ k = clamp(k,0,1); return k*k*(3-2*k); };

window.VizCore = {
    REDUCED: REDUCED, LIBS: LIBS,
    loadScript: loadScript, loadLib: loadLib, webglOK: webglOK,
    onApproach: onApproach, onVisible: onVisible, ticker: ticker,
    palette: palette, onThemeChange: onThemeChange,
    rng: rng, lerp: lerp, clamp: clamp, smooth: smooth
};
})();
