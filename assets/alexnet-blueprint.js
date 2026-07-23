/* ============================================================================
   alexnet-blueprint.js — "Exploded Blueprint & GPU Split"

   Nothing here is invented. Every shape, filter count and parameter total is
   taken from Krizhevsky, Sutskever & Hinton (2012) and recomputed in the
   browser from the layer definitions below — the totals you see are summed at
   run time, not typed in. The two-lane layout mirrors the paper's own figure:
   the network was genuinely split across two GTX 580 cards, and the lanes
   exchange data at only three points.
   ========================================================================== */
(function(){
'use strict';
var V = window.VizCore;
if (!V) return;

/* ------------------------------------------------------------------ layers */
// sp     : spatial side length of the output map (or 1 for fully connected)
// ch     : channels / units
// inCh   : input depth used for the parameter count. Conv2, Conv4 and Conv5
//          see only HALF the previous depth, because in the paper those
//          layers connect solely to feature maps on their own GPU.
// cross  : true where the two GPUs actually exchange feature maps
var LAYERS = [
    { name:'Input',  sp:224, ch:3,    inCh:0,    k:0,  split:false, cross:false, kind:'in'   },
    { name:'Conv1',  sp:55,  ch:96,   inCh:3,    k:11, split:true,  cross:false, kind:'conv' },
    { name:'Pool1',  sp:27,  ch:96,   inCh:0,    k:0,  split:true,  cross:false, kind:'pool' },
    { name:'Conv2',  sp:27,  ch:256,  inCh:48,   k:5,  split:true,  cross:false, kind:'conv' },
    { name:'Pool2',  sp:13,  ch:256,  inCh:0,    k:0,  split:true,  cross:false, kind:'pool' },
    { name:'Conv3',  sp:13,  ch:384,  inCh:256,  k:3,  split:true,  cross:true,  kind:'conv' },
    { name:'Conv4',  sp:13,  ch:384,  inCh:192,  k:3,  split:true,  cross:false, kind:'conv' },
    { name:'Conv5',  sp:13,  ch:256,  inCh:192,  k:3,  split:true,  cross:false, kind:'conv' },
    { name:'Pool3',  sp:6,   ch:256,  inCh:0,    k:0,  split:true,  cross:false, kind:'pool' },
    { name:'FC6',    sp:1,   ch:4096, inCh:9216, k:0,  split:true,  cross:true,  kind:'fc'   },
    { name:'FC7',    sp:1,   ch:4096, inCh:4096, k:0,  split:true,  cross:true,  kind:'fc'   },
    { name:'FC8',    sp:1,   ch:1000, inCh:4096, k:0,  split:false, cross:true,  kind:'fc'   }
];

// params(): weights + biases, computed from the definitions above.
function params(L){
    if (!L.inCh) return 0;
    return L.kind === 'conv' ? L.ch * (L.k*L.k*L.inCh) + L.ch
                             : L.ch * L.inCh + L.ch;
}
LAYERS.forEach(function(L){ L.p = params(L); });
var TOTAL = LAYERS.reduce(function(a,L){ return a + L.p; }, 0);
var CONV  = LAYERS.filter(function(L){ return L.kind==='conv'; }).reduce(function(a,L){ return a+L.p; },0);

var COL = { conv:'#4cc9f0', pool:'#6b8fa8', fc:'#ffd166', in:'#06d6a0' };

/* ------------------------------------------------------------------- state */
var S = { explode:0.45, sel:5, hot:-1 };      // sel defaults to Conv3, the cross-GPU layer
var el = {}, three = null, bars = null;

/* ---------------------------------------------------------------- 3D panel */
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
    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

    // Geometry scales: spatial extent shrinks, channel thickness grows.
    function spOf(L){ return 0.35 + 2.15*Math.sqrt(L.sp/224); }
    function thOf(L){ return 0.16 + 1.05*Math.log(L.ch)/Math.log(4096); }

    var group = new THREE.Group(); scene.add(group);
    var slabs = [], links = [];
    var LANE = 0.95;

    LAYERS.forEach(function(L, i){
        var sp = spOf(L), th = thOf(L);
        var lanes = L.split ? [ LANE, -LANE ] : [ 0 ];
        L._mesh = [];
        lanes.forEach(function(z){
            var g = new THREE.BoxGeometry(th, sp, sp);
            var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
                color:new THREE.Color(COL[L.kind]), transparent:true, opacity:0.30 }));
            var e = new THREE.LineSegments(new THREE.EdgesGeometry(g),
                new THREE.LineBasicMaterial({ color:new THREE.Color(COL[L.kind]), transparent:true, opacity:0.85 }));
            m.add(e);
            m.userData.layer = i; m.userData.z = z;
            group.add(m); slabs.push(m); L._mesh.push(m);
        });
    });

    // Cross-GPU links: drawn only where the paper says the lanes exchange maps.
    LAYERS.forEach(function(L, i){
        if (!L.cross || !L.split) return;
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        var line = new THREE.Line(g, new THREE.LineBasicMaterial({ color:0xff6b6b, transparent:true, opacity:0.9 }));
        line.userData.layer = i; group.add(line); links.push(line);
    });

    var ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
    var az = 0.72, pol = 1.12, rad = 13.5, drag = false, lx=0, ly=0, idle=0;
    canvas.addEventListener('pointerdown', function(e){ drag=true; idle=0; lx=e.clientX; ly=e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', function(e){ drag=false; try{ canvas.releasePointerCapture(e.pointerId); }catch(_){}});
    canvas.addEventListener('pointermove', function(e){
        var r = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX-r.left)/r.width)*2-1;
        mouse.y = -((e.clientY-r.top)/r.height)*2+1;
        if (drag){ az -= (e.clientX-lx)*0.006; pol = V.clamp(pol-(e.clientY-ly)*0.005, 0.3, 1.5); lx=e.clientX; ly=e.clientY; }
    });
    canvas.addEventListener('click', function(){
        if (S.hot >= 0){ S.sel = S.hot; if (bars) bars.draw(); renderReadout(); }
    });

    var lastW=0, lastH=0;
    function render(dt){
        var w = holder.clientWidth, h = holder.clientHeight;
        if (!w || !h) return;
        if (w!==lastW||h!==lastH){ lastW=w; lastH=h; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
        if (!drag){ idle += dt; if (idle > 2.5) az += dt*0.07; }

        // Lay the slabs out along x, with the gap driven by the explode control
        var x = 0, gap = 0.12 + S.explode*1.15, positions = [];
        LAYERS.forEach(function(L){
            var th = thOf(L);
            x += th/2;
            positions.push(x);
            L._mesh.forEach(function(m){ m.position.set(x, 0, m.userData.z); });
            x += th/2 + gap;
        });
        group.position.x = -x/2;

        links.forEach(function(l){
            var i = l.userData.layer, arr = l.geometry.attributes.position.array;
            arr[0]=positions[i]; arr[1]=0; arr[2]= LANE;
            arr[3]=positions[i]; arr[4]=0; arr[5]=-LANE;
            l.geometry.attributes.position.needsUpdate = true;
        });

        camera.position.set(rad*Math.sin(pol)*Math.cos(az), rad*Math.cos(pol)*0.55, rad*Math.sin(pol)*Math.sin(az));
        camera.lookAt(0,0,0);

        ray.setFromCamera(mouse, camera);
        var hit = ray.intersectObjects(slabs, false);
        S.hot = hit.length ? hit[0].object.userData.layer : -1;
        canvas.style.cursor = S.hot >= 0 ? 'pointer' : 'grab';

        slabs.forEach(function(m){
            var i = m.userData.layer, on = (i===S.sel), warm = (i===S.hot);
            m.material.opacity = on ? 0.62 : (warm ? 0.45 : 0.22);
            m.children[0].material.opacity = on ? 1 : (warm ? 0.9 : 0.45);
        });
        renderer.render(scene, camera);
    }
    return { render: render };
}

/* ------------------------------------------------- 2D panel: parameter bars */
function buildBars(){
    var svg = d3.select('#ax-bars'), g = svg.append('g');
    var W, Hh, xS, yS;

    function resize(){
        var wrap = document.getElementById('ax-bars').parentElement;
        W = wrap.clientWidth; Hh = wrap.clientHeight;
        if (!W || !Hh) return;
        svg.attr('viewBox','0 0 '+W+' '+Hh);
        var m = { t:30, r:70, b:16, l:58 };
        var withP = LAYERS.filter(function(L){ return L.p > 0; });
        yS = d3.scaleBand().domain(withP.map(function(L){ return L.name; })).range([m.t, Hh-m.b]).padding(0.28);
        xS = d3.scaleLinear([0, d3.max(withP, function(L){ return L.p; })], [m.l, W-m.r]);
        draw();
    }

    function draw(){
        if (!xS) return;
        var p = V.palette();
        var withP = LAYERS.filter(function(L){ return L.p > 0; });

        g.selectAll('rect').data(withP).join('rect')
            .attr('x', xS(0)).attr('y', function(L){ return yS(L.name); })
            .attr('width', function(L){ return Math.max(1, xS(L.p)-xS(0)); })
            .attr('height', yS.bandwidth())
            .attr('rx', 2)
            .attr('fill', function(L){ return COL[L.kind]; })
            .attr('opacity', function(L){ return LAYERS.indexOf(L)===S.sel ? 1 : 0.42; });

        g.selectAll('text.nm').data(withP).join('text').attr('class','nm')
            .attr('x', xS(0)-8).attr('y', function(L){ return yS(L.name)+yS.bandwidth()/2+3.5; })
            .attr('text-anchor','end').attr('font-size',10)
            .attr('fill', function(L){ return LAYERS.indexOf(L)===S.sel ? p.text : p.muted; })
            .text(function(L){ return L.name; });

        g.selectAll('text.vl').data(withP).join('text').attr('class','vl')
            .attr('x', function(L){ return xS(L.p)+7; })
            .attr('y', function(L){ return yS(L.name)+yS.bandwidth()/2+3.5; })
            .attr('font-size',10).attr('fill',p.muted)
            .text(function(L){ return (L.p/1e6).toFixed(L.p>1e6?1:2)+'M'; });

        g.selectAll('text.hd').data([0]).join('text').attr('class','hd')
            .attr('x', xS(0)-8).attr('y', 18).attr('text-anchor','end')
            .attr('font-size',10).attr('fill',p.muted).text('parameters');
    }
    return { resize:resize, draw:draw };
}

/* ----------------------------------------------------------------- readout */
function renderReadout(){
    var L = LAYERS[S.sel];
    var shape = L.sp > 1 ? (L.sp+'×'+L.sp+'×'+L.ch) : (L.ch + ' units');
    var share = TOTAL ? (100*L.p/TOTAL) : 0;
    el.readout.innerHTML =
        '<b>'+L.name+'</b> <span class="ax-sep">·</span> '+shape+
        (L.p ? ' <span class="ax-sep">·</span> '+L.p.toLocaleString()+' params ('+share.toFixed(1)+'% of the network)' : ' <span class="ax-dim">· no parameters</span>') +
        (L.cross ? ' <span class="ax-cross">· GPUs exchange feature maps here</span>'
                 : (L.split ? ' <span class="ax-dim">· split, no cross-GPU traffic</span>' : ''));
}

/* --------------------------------------------------------------------- boot */
function start(){
    el.readout = document.getElementById('ax-readout');
    el.exp     = document.getElementById('ax-explode');
    el.summary = document.getElementById('ax-summary');

    bars = buildBars(); bars.resize();
    window.addEventListener('resize', function(){ bars.resize(); });
    V.onThemeChange(function(){ bars.resize(); });

    el.summary.innerHTML =
        '<b>'+(TOTAL/1e6).toFixed(1)+'M</b> parameters total <span class="ax-sep">·</span> ' +
        'the five conv layers hold <b>'+(100*CONV/TOTAL).toFixed(1)+'%</b> of them <span class="ax-sep">·</span> ' +
        'FC6 alone holds <b>'+(100*LAYERS[9].p/TOTAL).toFixed(1)+'%</b>';

    el.exp.value = String(S.explode);
    el.exp.addEventListener('input', function(){ S.explode = parseFloat(el.exp.value); });
    renderReadout();

    var holder = document.getElementById('ax-3d');
    function after(){
        if (!three) document.getElementById('ax-fallback').style.display = 'flex';
        if (V.REDUCED){ if (three) three.render(0.016); return; }
        var visible = true, prev = 0;
        V.onVisible(document.getElementById('ax'), function(v){ visible = v; });
        V.ticker(function(t){
            var dt = t - prev; prev = t;
            if (!(dt>0)||dt>0.05) dt = 0.016;
            if (visible && three) three.render(dt);
        });
    }
    if (V.REDUCED || !V.webglOK()){ after(); return; }
    V.loadLib('three').then(function(){ three = buildThree(holder); after(); }).catch(after);
}

var root = document.getElementById('ax');
if (root) V.onApproach(root, start, 400);
})();