/* ============================================================================
   loss-landscape.js — "Loss Landscape Marble Race"

   The SURFACE is illustrative: a synthetic analytic function chosen to show
   plateaus, local minima and a global minimum in two dimensions. Real loss
   landscapes live in millions of dimensions and cannot be drawn.

   The OPTIMIZERS are not illustrative. SGD, Momentum, RMSProp and Adam use
   their real update rules, run on the analytic gradient of that surface, so
   the differences you see are produced by the algorithms themselves.
   ========================================================================== */
(function(){
'use strict';
var V = window.VizCore;
if (!V) return;

/* ---------------------------------------------------------------- surface */
// Quadratic bowl minus three Gaussian wells of differing depth.
// A = depth, (cx,cy) = centre, s = width.
var WELLS = [
    { A:1.6, cx: 1.7, cy: 1.2, s:0.9 },
    { A:1.1, cx:-1.8, cy:-1.4, s:1.0 },
    { A:0.8, cx: 1.5, cy:-1.7, s:0.7 }
];
var BOWL = 0.08, LIM = 3.2;

function loss(x, y){
    var v = BOWL * (x*x + y*y);
    for (var i=0;i<WELLS.length;i++){
        var w = WELLS[i];
        v -= w.A * Math.exp(-(((x-w.cx)*(x-w.cx)) + ((y-w.cy)*(y-w.cy))) / w.s);
    }
    return v;
}
// Analytic gradient (verified against central differences to ~1e-10).
function grad(x, y){
    var gx = 2*BOWL*x, gy = 2*BOWL*y;
    for (var i=0;i<WELLS.length;i++){
        var w = WELLS[i];
        var e = Math.exp(-(((x-w.cx)*(x-w.cx)) + ((y-w.cy)*(y-w.cy))) / w.s);
        gx += w.A * e * 2*(x-w.cx) / w.s;
        gy += w.A * e * 2*(y-w.cy) / w.s;
    }
    return [gx, gy];
}

/* -------------------------------------------------------------- optimizers */
// Each optimizer keeps its own state and returns the parameter delta.
var OPTS = [
    { key:'sgd', label:'SGD', color:'#ff6b6b',
      init:function(){ return {}; },
      step:function(st,g,lr){ return [-lr*g[0], -lr*g[1]]; } },

    { key:'momentum', label:'Momentum', color:'#ffd166',
      init:function(){ return {mx:0,my:0}; },
      step:function(st,g,lr){
          st.mx = 0.9*st.mx + g[0];  st.my = 0.9*st.my + g[1];
          return [-lr*st.mx, -lr*st.my]; } },

    { key:'rmsprop', label:'RMSProp', color:'#06d6a0',
      init:function(){ return {sx:0,sy:0}; },
      step:function(st,g,lr){
          st.sx = 0.9*st.sx + 0.1*g[0]*g[0];
          st.sy = 0.9*st.sy + 0.1*g[1]*g[1];
          return [-lr*g[0]/(Math.sqrt(st.sx)+1e-8), -lr*g[1]/(Math.sqrt(st.sy)+1e-8)]; } },

    { key:'adam', label:'Adam', color:'#4cc9f0',
      init:function(){ return {mx:0,my:0,vx:0,vy:0,t:0}; },
      step:function(st,g,lr){
          st.t++;
          st.mx = 0.9*st.mx + 0.1*g[0];        st.my = 0.9*st.my + 0.1*g[1];
          st.vx = 0.999*st.vx + 0.001*g[0]*g[0]; st.vy = 0.999*st.vy + 0.001*g[1]*g[1];
          var b1 = 1 - Math.pow(0.9, st.t), b2 = 1 - Math.pow(0.999, st.t);
          return [ -lr*(st.mx/b1)/(Math.sqrt(st.vx/b2)+1e-8),
                   -lr*(st.my/b1)/(Math.sqrt(st.vy/b2)+1e-8) ]; } }
];

var STEPS = 220;
var STARTS = [
    { label:'Plateau',  x:-2.6, y: 2.4 },
    { label:'Far ridge',x: 2.7, y: 2.6 },
    { label:'Shallow',  x:-0.2, y:-2.9 }
];

// simulate(): run every optimizer from the same start, return paths + losses.
function simulate(sx, sy, lr){
    return OPTS.map(function(o){
        var st = o.init(), x = sx, y = sy;
        var path = [[x, y, loss(x,y)]], hist = [loss(x,y)];
        for (var i=0;i<STEPS;i++){
            var d = o.step(st, grad(x,y), lr);
            x = V.clamp(x + d[0], -LIM, LIM);
            y = V.clamp(y + d[1], -LIM, LIM);
            var L = loss(x,y);
            path.push([x,y,L]); hist.push(L);
        }
        return { opt:o, path:path, hist:hist };
    });
}

/* ------------------------------------------------------------------ state */
var S = { lr:0.08, start:0, cursor:0, playing:false, runs:null, on:{} };
OPTS.forEach(function(o){ S.on[o.key] = true; });

var el = {}, three = null, plot = null;

/* -------------------------------------------------------------- 3D panel */
function buildThree(holder){
    if (typeof THREE === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    holder.appendChild(canvas);
    var renderer;
    try { renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true, alpha:true}); }
    catch(e){ holder.removeChild(canvas); return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    var HS = 1.15;                                  // height scale for the surface

    // Surface mesh: a subdivided plane displaced by the loss value, coloured
    // by height. Rotated so the displaced axis becomes world "up".
    var SEG = 84, geo = new THREE.PlaneGeometry(2*LIM, 2*LIM, SEG, SEG);
    var pos = geo.attributes.position, cols = new Float32Array(pos.count*3);
    var lo = Infinity, hi = -Infinity, vals = new Float32Array(pos.count);
    for (var i=0;i<pos.count;i++){
        var L = loss(pos.getX(i), pos.getY(i));
        vals[i] = L; if (L<lo) lo=L; if (L>hi) hi=L;
        pos.setZ(i, L*HS);
    }
    for (var j=0;j<pos.count;j++){
        var t = (vals[j]-lo)/(hi-lo);
        var c = new THREE.Color(d3.interpolateViridis(1-t));   // deep valleys bright
        cols[j*3]=c.r; cols[j*3+1]=c.g; cols[j*3+2]=c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols,3));
    geo.computeVertexNormals();
    var surf = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0.92}));
    surf.rotation.x = -Math.PI/2; scene.add(surf);
    var wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:0x000000, wireframe:true, transparent:true, opacity:0.08}));
    wire.rotation.x = -Math.PI/2; scene.add(wire);

    // One marble + one trail per optimizer
    var marbles = OPTS.map(function(o){
        var m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12),
                               new THREE.MeshBasicMaterial({color:new THREE.Color(o.color)}));
        scene.add(m); return m;
    });
    var trails = OPTS.map(function(o){
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((STEPS+1)*3), 3));
        var l = new THREE.Line(g, new THREE.LineBasicMaterial({color:new THREE.Color(o.color), transparent:true, opacity:0.85}));
        l.frustumCulled = false; scene.add(l); return l;
    });

    // Hand-rolled orbit (OrbitControls is not in the core r128 build)
    var az = 0.85, pol = 0.95, rad = 10.5, drag = false, lx = 0, ly = 0, idle = 0;
    canvas.addEventListener('pointerdown', function(e){ drag = true; idle = 0; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup',   function(e){ drag = false; try{ canvas.releasePointerCapture(e.pointerId); }catch(_){} });
    canvas.addEventListener('pointermove', function(e){
        if (!drag) return;
        az -= (e.clientX-lx)*0.006; pol = V.clamp(pol - (e.clientY-ly)*0.005, 0.25, 1.45);
        lx = e.clientX; ly = e.clientY;
    });

    var lastW=0, lastH=0;
    function render(dt){
        var w = holder.clientWidth, h = holder.clientHeight;
        if (!w || !h) return;
        if (w!==lastW || h!==lastH){ lastW=w; lastH=h; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
        if (!drag){ idle += dt; if (idle > 2.5) az += dt*0.09; }
        camera.position.set(rad*Math.sin(pol)*Math.cos(az), rad*Math.cos(pol), rad*Math.sin(pol)*Math.sin(az));
        camera.lookAt(0,0,0);

        var cur = Math.floor(S.cursor);
        for (var i=0;i<OPTS.length;i++){
            var run = S.runs[i], vis = S.on[OPTS[i].key];
            marbles[i].visible = vis; trails[i].visible = vis;
            if (!vis) continue;
            var p = run.path[Math.min(cur, STEPS)];
            marbles[i].position.set(p[0], p[2]*HS + 0.12, -p[1]);
            var arr = trails[i].geometry.attributes.position.array;
            for (var k=0;k<=cur && k<=STEPS;k++){
                var q = run.path[k];
                arr[k*3]=q[0]; arr[k*3+1]=q[2]*HS+0.05; arr[k*3+2]=-q[1];
            }
            trails[i].geometry.attributes.position.needsUpdate = true;
            trails[i].geometry.setDrawRange(0, Math.max(2, Math.min(cur,STEPS)+1));
        }
        renderer.render(scene, camera);
    }
    return { render: render };
}

/* -------------------------------------------------------------- 2D panel */
function buildPlot(){
    var svg = d3.select('#lv-plot'), xS, yS, W, H, g = svg.append('g');
    var grid = g.append('g'), lines = g.append('g'), marker = g.append('line');
    var dots = g.append('g');

    function resize(){
        var wrap = document.getElementById('lv-plot').parentElement;
        W = wrap.clientWidth; H = wrap.clientHeight;
        if (!W || !H) return;
        svg.attr('viewBox','0 0 '+W+' '+H);
        var m = {t:18, r:16, b:26, l:44};
        xS = d3.scaleLinear([0, STEPS],[m.l, W-m.r]);
        var all = S.runs.reduce(function(a,r){ return a.concat(r.hist); },[]);
        yS = d3.scaleLinear(d3.extent(all),[H-m.b, m.t]).nice();
        var p = V.palette();

        grid.selectAll('*').remove();
        yS.ticks(4).forEach(function(t){
            grid.append('line').attr('x1',m.l).attr('x2',W-m.r).attr('y1',yS(t)).attr('y2',yS(t))
               .attr('stroke',p.muted).attr('stroke-width',0.5).attr('opacity',0.18);
            grid.append('text').attr('x',m.l-8).attr('y',yS(t)+3).attr('text-anchor','end')
               .attr('font-size',10).attr('fill',p.muted).text(t.toFixed(1));
        });
        grid.append('text').attr('x',(m.l+W-m.r)/2).attr('y',H-6).attr('text-anchor','middle')
            .attr('font-size',10).attr('fill',p.muted).text('step');
        marker.attr('y1',m.t).attr('y2',H-m.b).attr('stroke',p.accent).attr('stroke-width',0.8).attr('opacity',0.4);
        draw();
    }

    function draw(){
        if (!xS) return;
        var cur = Math.floor(S.cursor);
        var line = d3.line().x(function(d,i){ return xS(i); }).y(function(d){ return yS(d); }).curve(d3.curveMonotoneX);
        lines.selectAll('path').data(S.runs).join('path')
            .attr('fill','none').attr('stroke-width',1.9)
            .attr('stroke',function(r){ return r.opt.color; })
            .attr('opacity',function(r){ return S.on[r.opt.key] ? 0.95 : 0; })
            .attr('d',function(r){ return line(r.hist.slice(0, cur+1)); });
        dots.selectAll('circle').data(S.runs).join('circle')
            .attr('r',3.4).attr('fill',function(r){ return r.opt.color; })
            .attr('opacity',function(r){ return S.on[r.opt.key] ? 1 : 0; })
            .attr('cx',xS(Math.min(cur,STEPS)))
            .attr('cy',function(r){ return yS(r.hist[Math.min(cur,STEPS)]); });
        marker.attr('x1',xS(Math.min(cur,STEPS))).attr('x2',xS(Math.min(cur,STEPS)));
    }
    return { resize:resize, draw:draw };
}

/* -------------------------------------------------------------- controls */
function recompute(){
    var st = STARTS[S.start];
    S.runs = simulate(st.x, st.y, S.lr);
    S.cursor = 0;
    if (plot) plot.resize();
    renderReadout();
}

function renderReadout(){
    var cur = Math.min(Math.floor(S.cursor), STEPS);
    el.readout.innerHTML = S.runs.map(function(r){
        return '<span style="color:'+r.opt.color+'">'+r.opt.label+'</span> '+r.hist[cur].toFixed(3);
    }).join('<span class="lv-sep">·</span>');
}

function buildLegend(){
    el.legend.innerHTML = '';
    OPTS.forEach(function(o){
        var b = document.createElement('button');
        b.className = 'lv-chip' + (S.on[o.key] ? ' on' : '');
        b.innerHTML = '<i style="background:'+o.color+'"></i>'+o.label;
        b.addEventListener('click', function(){
            S.on[o.key] = !S.on[o.key];
            b.classList.toggle('on', S.on[o.key]);
            if (plot) plot.draw();
        });
        el.legend.appendChild(b);
    });
}

function buildStarts(){
    el.starts.innerHTML = '';
    STARTS.forEach(function(s, i){
        var b = document.createElement('button');
        b.className = 'lv-chip' + (i===S.start ? ' on' : '');
        b.textContent = s.label;
        b.addEventListener('click', function(){
            S.start = i;
            Array.prototype.forEach.call(el.starts.children, function(c,ci){ c.classList.toggle('on', ci===i); });
            recompute(); S.playing = true; el.run.textContent = 'Pause';
        });
        el.starts.appendChild(b);
    });
}

/* ------------------------------------------------------------------- boot */
function start(){
    el.readout = document.getElementById('lv-readout');
    el.legend  = document.getElementById('lv-legend');
    el.starts  = document.getElementById('lv-starts');
    el.run     = document.getElementById('lv-run');
    el.lr      = document.getElementById('lv-lr');
    el.lrv     = document.getElementById('lv-lrv');

    recompute();
    buildLegend(); buildStarts();
    plot = buildPlot(); plot.resize();
    window.addEventListener('resize', function(){ plot.resize(); });
    V.onThemeChange(function(){ plot.resize(); });

    el.lr.value = String(S.lr);
    el.lrv.textContent = S.lr.toFixed(3);
    el.lr.addEventListener('input', function(){
        S.lr = parseFloat(el.lr.value); el.lrv.textContent = S.lr.toFixed(3);
        recompute(); S.playing = true; el.run.textContent = 'Pause';
    });
    el.run.addEventListener('click', function(){
        if (S.cursor >= STEPS) S.cursor = 0;
        S.playing = !S.playing; el.run.textContent = S.playing ? 'Pause' : 'Run';
    });
    document.getElementById('lv-reset').addEventListener('click', function(){
        S.cursor = 0; S.playing = false; el.run.textContent = 'Run'; plot.draw(); renderReadout();
    });

    var holder = document.getElementById('lv-3d');
    function afterThree(){
        if (three === null) {
            document.getElementById('lv-fallback').style.display = 'flex';
        }
        var visible = true, prev = 0;
        V.onVisible(document.getElementById('lv'), function(v){ visible = v; });
        if (V.REDUCED){
            S.cursor = STEPS; plot.draw(); renderReadout();
            if (three) three.render(0.016);
            return;
        }
        S.playing = true; el.run.textContent = 'Pause';
        V.ticker(function(t){
            var dt = t - prev; prev = t;
            if (!(dt > 0) || dt > 0.05) dt = 0.016;
            if (!visible) return;
            if (S.playing){
                S.cursor += dt * (STEPS / 9);            // full race in ~9 s
                if (S.cursor >= STEPS){ S.cursor = STEPS; S.playing = false; el.run.textContent = 'Run'; }
                plot.draw(); renderReadout();
            }
            if (three) three.render(dt);
        });
    }

    if (V.REDUCED || !V.webglOK()){ afterThree(); return; }
    V.loadLib('three')
        .then(function(){ three = buildThree(holder); afterThree(); })
        .catch(function(){ afterThree(); });
}

// d3 and gsap are already on the page; defer only the WebGL work.
var root = document.getElementById('lv');
if (root) V.onApproach(root, start, 400);
})();
