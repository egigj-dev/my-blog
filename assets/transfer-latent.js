/* ============================================================================
   transfer-latent.js — "Feature Transfuser & Latent Clusters"

   The FEATURE GEOMETRY is illustrative. Real EfficientNetB0 embeddings are
   1280-dimensional and cannot be shown directly, so the cloud below is a
   synthetic stand-in: isotropic noise at one end of the slider, well-separated
   class clusters at the other.

   The CLASSIFIER IS REAL. A nearest-centroid linear probe is fitted on 60% of
   the points and scored on the held-out 40%, recomputed every time you move
   the slider. That is the actual reason a frozen backbone works: if the
   features are already linearly separable, a tiny head is all that is left to
   learn. Parameter counts for the head are computed, not quoted.
   ========================================================================== */
(function(){
'use strict';
var V = window.VizCore;
if (!V) return;

var CLASSES = ['airplane','automobile','bird','cat','deer','dog','frog','horse','ship','truck'];
var PER = 42;                                    // points per class
var FEATURE_DIM = 1280;                          // EfficientNetB0 pooled feature width
var BACKBONE_PARAMS = 4049571;                   // EfficientNetB0, include_top=False
var HEAD_PARAMS = FEATURE_DIM * CLASSES.length + CLASSES.length;

/* ------------------------------------------------------- synthetic geometry */
// Two layouts for the same points: unstructured (random init) and clustered
// (pretrained). The slider interpolates between them.
var PTS = (function(){
    var g = V.rng(404), pts = [];
    // Class centroids spread evenly over a sphere (Fibonacci lattice)
    var cent = CLASSES.map(function(_, i){
        var y = 1 - (i/(CLASSES.length-1))*2, r = Math.sqrt(Math.max(0,1-y*y));
        var th = Math.PI*(3-Math.sqrt(5))*i;
        return [Math.cos(th)*r*2.3, y*2.3, Math.sin(th)*r*2.3];
    });
    for (var c=0;c<CLASSES.length;c++){
        for (var k=0;k<PER;k++){
            pts.push({
                c: c,
                // clustered: tight around the class centroid
                a: [ cent[c][0] + (g()-0.5)*0.85, cent[c][1] + (g()-0.5)*0.85, cent[c][2] + (g()-0.5)*0.85 ],
                // unstructured: one shared blob, class carries no positional info
                b: [ (g()-0.5)*4.2, (g()-0.5)*4.2, (g()-0.5)*4.2 ]
            });
        }
    }
    return pts;
})();

// pos(): current position of point i under the morph value t (0 random, 1 pretrained)
function pos(p, t){
    return [ p.b[0] + (p.a[0]-p.b[0])*t,
             p.b[1] + (p.a[1]-p.b[1])*t,
             p.b[2] + (p.a[2]-p.b[2])*t ];
}

/* ----------------------------------------------- nearest-centroid linear probe */
// Fitted on the first 60% of each class, scored on the remaining 40%.
var SPLIT = Math.floor(PER * 0.6);
function probeAccuracy(t){
    var sums = [], counts = [], i, c;
    for (c=0;c<CLASSES.length;c++){ sums.push([0,0,0]); counts.push(0); }
    for (i=0;i<PTS.length;i++){
        if ((i % PER) >= SPLIT) continue;                    // train split only
        var p = pos(PTS[i], t), c0 = PTS[i].c;
        sums[c0][0]+=p[0]; sums[c0][1]+=p[1]; sums[c0][2]+=p[2]; counts[c0]++;
    }
    var cents = sums.map(function(s, ci){
        var n = Math.max(counts[ci],1);
        return [s[0]/n, s[1]/n, s[2]/n];
    });
    var right = 0, total = 0;
    for (i=0;i<PTS.length;i++){
        if ((i % PER) < SPLIT) continue;                     // held-out split
        var q = pos(PTS[i], t), best = -1, bd = Infinity;
        for (c=0;c<CLASSES.length;c++){
            var dx=q[0]-cents[c][0], dy=q[1]-cents[c][1], dz=q[2]-cents[c][2];
            var d = dx*dx+dy*dy+dz*dz;
            if (d < bd){ bd = d; best = c; }
        }
        total++; if (best === PTS[i].c) right++;
    }
    return total ? right/total : 0;
}

/* -------------------------------------------------------------------- state */
var S = { morph:1, frozen:true, acc:0 };
var el = {}, three = null, stack = null;

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
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

    var n = PTS.length;
    var geo = new THREE.BufferGeometry();
    var posArr = new Float32Array(n*3), colArr = new Float32Array(n*3);
    var scheme = d3.schemeCategory10;
    for (var i=0;i<n;i++){
        var col = new THREE.Color(scheme[PTS[i].c % scheme.length]);
        colArr[i*3]=col.r; colArr[i*3+1]=col.g; colArr[i*3+2]=col.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posArr,3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr,3));
    var cloud = new THREE.Points(geo, new THREE.PointsMaterial({
        size:0.13, vertexColors:true, transparent:true, opacity:0.92, sizeAttenuation:true }));
    scene.add(cloud);

    var az = 0.7, pol = 1.1, rad = 9.2, drag = false, lx=0, ly=0, idle=0;
    canvas.addEventListener('pointerdown', function(e){ drag=true; idle=0; lx=e.clientX; ly=e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', function(e){ drag=false; try{ canvas.releasePointerCapture(e.pointerId); }catch(_){}});
    canvas.addEventListener('pointermove', function(e){
        if (!drag) return;
        az -= (e.clientX-lx)*0.006; pol = V.clamp(pol-(e.clientY-ly)*0.005, 0.3, 1.5);
        lx=e.clientX; ly=e.clientY;
    });

    var lastW=0,lastH=0;
    function render(dt){
        var w = holder.clientWidth, h = holder.clientHeight;
        if (!w||!h) return;
        if (w!==lastW||h!==lastH){ lastW=w; lastH=h; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
        if (!drag){ idle += dt; if (idle > 2) az += dt*0.1; }
        for (var i=0;i<n;i++){
            var p = pos(PTS[i], S.morph);
            posArr[i*3]=p[0]; posArr[i*3+1]=p[1]; posArr[i*3+2]=p[2];
        }
        geo.attributes.position.needsUpdate = true;
        camera.position.set(rad*Math.sin(pol)*Math.cos(az), rad*Math.cos(pol), rad*Math.sin(pol)*Math.sin(az));
        camera.lookAt(0,0,0);
        renderer.render(scene, camera);
    }
    return { render:render };
}

/* ------------------------------------------- 2D panel: frozen stack + gradient */
function buildStack(){
    var svg = d3.select('#tl-stack'), g = svg.append('g');
    var gLink = g.append('g'), gBlock = g.append('g'), gLab = g.append('g'), gPulse = g.append('g');
    var W, Hh, xs = [], y0;
    var BLOCKS = [
        { name:'Stem',    frozen:true  },
        { name:'Block 1', frozen:true  },
        { name:'Block 2', frozen:true  },
        { name:'Block 3', frozen:true  },
        { name:'Pool',    frozen:true  },
        { name:'Head',    frozen:false }
    ];

    function resize(){
        var wrap = document.getElementById('tl-stack').parentElement;
        W = wrap.clientWidth; Hh = wrap.clientHeight;
        if (!W||!Hh) return;
        svg.attr('viewBox','0 0 '+W+' '+Hh);
        var pad = 42;
        xs = BLOCKS.map(function(_,i){ return pad + (W-2*pad)*(i/(BLOCKS.length-1)); });
        y0 = Hh*0.46;
        draw(0);
    }

    function draw(t){
        if (!xs.length) return;
        var p = V.palette();
        gLink.selectAll('line').data(BLOCKS.slice(0,-1)).join('line')
            .attr('x1',function(d,i){ return xs[i]+16; }).attr('x2',function(d,i){ return xs[i+1]-16; })
            .attr('y1',y0).attr('y2',y0).attr('stroke',p.muted).attr('stroke-width',1).attr('opacity',0.4);

        gBlock.selectAll('rect').data(BLOCKS).join('rect')
            .attr('x',function(d,i){ return xs[i]-16; }).attr('y',y0-30)
            .attr('width',32).attr('height',60).attr('rx',5)
            .attr('fill',function(d){ return d.frozen && S.frozen ? 'none' : '#06d6a0'; })
            .attr('fill-opacity',0.18)
            .attr('stroke',function(d){ return d.frozen && S.frozen ? p.muted : '#06d6a0'; })
            .attr('stroke-width',1.6)
            .attr('stroke-dasharray',function(d){ return d.frozen && S.frozen ? '3 3' : null; })
            .attr('opacity',function(d){ return d.frozen && S.frozen ? 0.5 : 1; });

        gLab.selectAll('text').data(BLOCKS).join('text')
            .attr('x',function(d,i){ return xs[i]; }).attr('y',y0+48)
            .attr('text-anchor','middle').attr('font-size',9.5)
            .attr('fill',function(d){ return d.frozen && S.frozen ? p.muted : '#06d6a0'; })
            .text(function(d){ return d.name; });

        gLab.selectAll('text.lock').data(BLOCKS).join('text').attr('class','lock')
            .attr('x',function(d,i){ return xs[i]; }).attr('y',y0-40)
            .attr('text-anchor','middle').attr('font-size',9).attr('fill',p.muted)
            .text(function(d){ return d.frozen && S.frozen ? 'frozen' : 'training'; });

        // Gradient pulse travels backwards from the head and stops at the
        // freeze boundary — nothing upstream receives an update.
        var startX = xs[xs.length-1];
        var stopIdx = S.frozen ? BLOCKS.length-2 : 0;
        var stopX = xs[stopIdx];
        var cyc = V.REDUCED ? 0.5 : (t*0.45) % 1;
        var x = startX - (startX-stopX)*cyc;
        gPulse.selectAll('circle').data([0]).join('circle')
            .attr('cx',x).attr('cy',y0).attr('r',4).attr('fill','#ffd166')
            .attr('opacity',V.REDUCED ? 0.8 : 0.9*(1-cyc)+0.1);
        gPulse.selectAll('text').data([0]).join('text')
            .attr('x',W/2).attr('y',Hh-12).attr('text-anchor','middle')
            .attr('font-size',10).attr('fill',p.muted)
            .text(S.frozen ? 'gradient reaches the head only' : 'gradient flows through every layer');
    }
    return { resize:resize, draw:draw };
}

/* ----------------------------------------------------------------- readout */
function renderReadout(){
    S.acc = probeAccuracy(S.morph);
    var trainable = S.frozen ? HEAD_PARAMS : (HEAD_PARAMS + BACKBONE_PARAMS);
    var total = HEAD_PARAMS + BACKBONE_PARAMS;
    el.readout.innerHTML =
        'linear-probe accuracy on held-out points <b>' + (S.acc*100).toFixed(1) + '%</b>' +
        ' <span class="tl-sep">&middot;</span> trainable parameters <b>' + trainable.toLocaleString() + '</b>' +
        ' <span class="tl-dim">of ' + total.toLocaleString() + ' (' + (100*trainable/total).toFixed(1) + '%)</span>';
}

/* --------------------------------------------------------------------- boot */
function start(){
    el.readout = document.getElementById('tl-readout');
    el.morph   = document.getElementById('tl-morph');
    el.morphv  = document.getElementById('tl-morphv');
    el.freeze  = document.getElementById('tl-freeze');

    stack = buildStack(); stack.resize();
    window.addEventListener('resize', function(){ stack.resize(); });
    V.onThemeChange(function(){ stack.resize(); });

    el.morph.value = String(S.morph);
    el.morphv.textContent = 'pretrained';
    el.morph.addEventListener('input', function(){
        S.morph = parseFloat(el.morph.value);
        el.morphv.textContent = S.morph < 0.15 ? 'random init'
                              : (S.morph > 0.85 ? 'pretrained' : 'partially adapted');
        renderReadout();
    });
    el.freeze.addEventListener('click', function(){
        S.frozen = !S.frozen;
        el.freeze.textContent = S.frozen ? 'Backbone: frozen' : 'Backbone: fine-tuning';
        el.freeze.classList.toggle('on', S.frozen);
        renderReadout();
    });
    renderReadout();

    var holder = document.getElementById('tl-3d');
    function after(){
        if (!three) document.getElementById('tl-fallback').style.display = 'flex';
        if (V.REDUCED){ if (three) three.render(0.016); stack.draw(0); return; }
        var visible = true, prev = 0;
        V.onVisible(document.getElementById('tl'), function(v){ visible = v; });
        V.ticker(function(t){
            var dt = t - prev; prev = t;
            if (!(dt>0)||dt>0.05) dt = 0.016;
            if (!visible) return;
            if (three) three.render(dt);
            stack.draw(t);
        });
    }
    if (V.REDUCED || !V.webglOK()){ after(); return; }
    V.loadLib('three').then(function(){ three = buildThree(holder); after(); }).catch(after);
}

var root = document.getElementById('tl');
if (root) V.onApproach(root, start, 400);
})();