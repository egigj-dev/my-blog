/* ============================================================================
   augmentation-margin.js — "Augmentation Prism & Margin Expansion"

   The DATASET is illustrative: a synthetic two-class problem in 2D, because a
   decision boundary can only be drawn in two dimensions.

   Everything else is measured. The classifier is 1-nearest-neighbour. The
   accuracy shown is scored on 1000 held-out samples drawn from the same
   generator and never used for fitting. The boundary is the real 1-NN
   decision region, traced with marching squares.

   The lesson this was built to show is the one the numbers actually support:
   augmentation is only worth the invariance it encodes. Sliding a sample along
   the arc it came from is a true invariance here and lifts held-out accuracy
   from 79.9% to about 90.7%. Mirroring is not an invariance of this data, and
   it takes the classifier apart.
   ========================================================================== */
(function(){
'use strict';
var V = window.VizCore;
if (!V) return;

var DOM = [-3.2, 3.2];

// The generator. Class 0 and class 1 lie on two interleaved arcs, each
// parameterised by t in [0, pi]. Augmenting "along the arc" moves a sample
// in t — which is exactly the invariance this data really has.
function ARC(t, c){
    return c === 0 ? { x: Math.cos(t)*1.85 - 0.45, y: Math.sin(t)*1.55 - 0.55 }
                   : { x: 1 - Math.cos(t)*1.85 - 0.75, y: 0.55 - Math.sin(t)*1.55 };
}

// 10 training points (5 per class), seeded so every reader sees the same set.
var BASE = (function(){
    var g = V.rng(16), p = [];
    for (var i=0;i<5;i++){
        var t = Math.PI * (i/4);
        for (var c=0;c<2;c++){
            var a = ARC(t,c);
            p.push({ x:a.x + (g()-0.5)*0.40, y:a.y + (g()-0.5)*0.40, c:c, t:t });
        }
    }
    return p;
})();

// 1000 held-out samples from the same generator — never used for fitting.
var TEST = (function(){
    var g = V.rng(555), p = [];
    for (var i=0;i<1000;i++){
        var t = Math.PI*g(), c = g()<0.5 ? 0 : 1, a = ARC(t,c);
        p.push({ x:a.x + (g()-0.5)*0.5, y:a.y + (g()-0.5)*0.5, c:c });
    }
    return p;
})();

/* --------------------------------------------------------- transformations */
// 'along' is the only one that respects the generator. The others are here so
// the reader can watch a wrong invariance do damage.
var TRANSFORMS = {
    along:  { label:'Along arc', apply:function(p,g){
        var t2 = p.t + (g()-0.5)*0.9, a = ARC(t2, p.c);
        return { x:a.x + (g()-0.5)*0.30, y:a.y + (g()-0.5)*0.30, c:p.c, t:t2 }; } },
    jitter: { label:'Jitter', apply:function(p,g){
        return { x:p.x + (g()-0.5)*0.55, y:p.y + (g()-0.5)*0.55, c:p.c, t:p.t }; } },
    rotate: { label:'Rotate', apply:function(p,g){
        var a = (g()-0.5)*0.6;
        return { x:p.x*Math.cos(a) - p.y*Math.sin(a), y:p.x*Math.sin(a) + p.y*Math.cos(a), c:p.c, t:p.t }; } },
    mirror: { label:'Mirror', apply:function(p,g){
        return { x:-p.x, y:p.y, c:p.c, t:p.t }; } }
};
var ORDER = ['along','jitter','rotate','mirror'];

/* -------------------------------------------------------------------- state */
var S = { copies:0, on:{along:true, jitter:false, rotate:false, mirror:false},
          data:BASE.slice(), acc:0, base:0 };
var el = {}, cloud = null, margin = null;

function augment(){
    var g = V.rng(7), out = BASE.slice();
    var active = ORDER.filter(function(k){ return S.on[k]; });
    if (S.copies > 0 && active.length){
        for (var i=0;i<BASE.length;i++){
            for (var k=0;k<S.copies;k++){
                var p = BASE[i];
                for (var a=0;a<active.length;a++) p = TRANSFORMS[active[a]].apply(p, g);
                out.push(p);
            }
        }
    }
    S.data = out;
}

/* -------------------------------------------------------- 1-NN classifier */
function nn(data, x, y){
    var bd = Infinity, bc = 0;
    for (var i=0;i<data.length;i++){
        var dx = x - data[i].x, dy = y - data[i].y, q = dx*dx + dy*dy;
        if (q < bd){ bd = q; bc = data[i].c; }
    }
    return bc;
}
function heldOutAccuracy(data){
    var n = 0;
    for (var i=0;i<TEST.length;i++) if (nn(data, TEST[i].x, TEST[i].y) === TEST[i].c) n++;
    return n / TEST.length;
}

/* --------------------------------------------- panel B: boundary + accuracy */
var GRID = 56;
function buildMargin(){
    var svg = d3.select('#am-plot'), g = svg.append('g');
    var gRegion = g.append('g'), gLine = g.append('g'), gPts = g.append('g');
    var xS, yS, W, Hh;

    function resize(){
        var wrap = document.getElementById('am-plot').parentElement;
        W = wrap.clientWidth; Hh = wrap.clientHeight;
        if (!W || !Hh) return;
        svg.attr('viewBox','0 0 '+W+' '+Hh);
        var size = Math.min(W,Hh) - 18, ox = (W-size)/2, oy = (Hh-size)/2;
        xS = d3.scaleLinear(DOM,[ox, ox+size]);
        yS = d3.scaleLinear(DOM,[oy+size, oy]);
        draw();
    }

    function draw(){
        if (!xS) return;
        var vals = new Array(GRID*GRID), r, c, x, y;
        for (r=0;r<GRID;r++){
            y = DOM[1] - (DOM[1]-DOM[0])*r/(GRID-1);
            for (c=0;c<GRID;c++){
                x = DOM[0] + (DOM[1]-DOM[0])*c/(GRID-1);
                vals[r*GRID+c] = nn(S.data, x, y) === 0 ? 1 : -1;
            }
        }
        var conts = d3.contours().size([GRID,GRID]).thresholds([0])(vals);
        var cell = (xS(DOM[1])-xS(DOM[0]))/(GRID-1);
        var tf = 'translate('+xS(DOM[0])+','+yS(DOM[1])+') scale('+cell+','+cell+')';

        gRegion.selectAll('path').data(conts).join('path')
            .attr('d', d3.geoPath()).attr('transform', tf)
            .attr('fill','#4cc9f0').attr('fill-opacity',0.10).attr('stroke','none');
        gLine.selectAll('path').data(conts).join('path')
            .attr('d', d3.geoPath()).attr('transform', tf)
            .attr('fill','none').attr('stroke','#f0a500').attr('stroke-width',2.2/cell)
            .attr('vector-effect','non-scaling-stroke').attr('opacity',0.95);

        gPts.selectAll('circle').data(S.data).join('circle')
            .attr('cx',function(p){ return xS(p.x); }).attr('cy',function(p){ return yS(p.y); })
            .attr('r',function(p,i){ return i < BASE.length ? 4.5 : 2.0; })
            .attr('fill',function(p){ return p.c===0 ? '#4cc9f0' : '#ff6b6b'; })
            .attr('opacity',function(p,i){ return i < BASE.length ? 1 : 0.3; });

        S.acc = heldOutAccuracy(S.data);
        var delta = (S.acc - S.base) * 100;
        var sign = delta >= 0 ? '+' : '';
        var cls = Math.abs(delta) < 0.6 ? 'am-dim' : (delta > 0 ? 'am-good' : 'am-bad');
        el.readout.innerHTML =
            '<b>'+S.data.length+'</b> training samples <span class="am-sep">&middot;</span> ' +
            'held-out accuracy <b>'+(S.acc*100).toFixed(1)+'%</b> ' +
            '<span class="'+cls+'">('+sign+delta.toFixed(1)+' pts vs no augmentation)</span>';
    }
    return { resize:resize, draw:draw };
}

/* ------------------------------------------------- panel A: the sample cloud */
function buildCloud(){
    var svg = d3.select('#am-prism'), g = svg.append('g');
    var gArc = g.append('g'), gPts = g.append('g');
    var xS, yS, W, Hh;

    function resize(){
        var wrap = document.getElementById('am-prism').parentElement;
        W = wrap.clientWidth; Hh = wrap.clientHeight;
        if (!W || !Hh) return;
        svg.attr('viewBox','0 0 '+W+' '+Hh);
        var size = Math.min(W,Hh) - 18, ox = (W-size)/2, oy = (Hh-size)/2;
        xS = d3.scaleLinear(DOM,[ox, ox+size]);
        yS = d3.scaleLinear(DOM,[oy+size, oy]);
        draw();
    }

    // Draws the true generating arcs, so it is visible whether the synthetic
    // copies land on the data manifold or drift off it.
    function draw(){
        if (!xS) return;
        var line = d3.line().x(function(d){ return xS(d.x); }).y(function(d){ return yS(d.y); }).curve(d3.curveBasis);
        var curves = [0,1].map(function(c){
            return d3.range(0, 1.001, 0.02).map(function(u){ return ARC(Math.PI*u, c); });
        });
        gArc.selectAll('path').data(curves).join('path')
            .attr('d', line).attr('fill','none')
            .attr('stroke',function(d,i){ return i===0 ? '#4cc9f0' : '#ff6b6b'; })
            .attr('stroke-width',1.2).attr('stroke-dasharray','4 4').attr('opacity',0.45);

        gPts.selectAll('circle').data(S.data).join('circle')
            .attr('cx',function(q){ return xS(q.x); }).attr('cy',function(q){ return yS(q.y); })
            .attr('r',function(q,i){ return i < BASE.length ? 5 : 2.1; })
            .attr('fill',function(q){ return q.c===0 ? '#4cc9f0' : '#ff6b6b'; })
            .attr('opacity',function(q,i){ return i < BASE.length ? 1 : 0.34; });

        var extra = S.data.length - BASE.length;
        el.cloudNote.textContent = extra
            ? extra + ' synthetic copies · dashed lines are the true manifold'
            : 'no augmentation — 10 real samples';
    }
    return { resize:resize, draw:draw };
}

/* --------------------------------------------------------------- controls */
function refresh(){ augment(); cloud.draw(); margin.draw(); }

function start(){
    el.readout   = document.getElementById('am-readout');
    el.cloudNote = document.getElementById('am-cloudnote');
    el.copies    = document.getElementById('am-copies');
    el.copiesv   = document.getElementById('am-copiesv');
    el.tf        = document.getElementById('am-transforms');

    S.base = heldOutAccuracy(BASE);          // reference: unaugmented accuracy

    cloud = buildCloud(); margin = buildMargin();
    cloud.resize(); margin.resize();
    window.addEventListener('resize', function(){ cloud.resize(); margin.resize(); });
    V.onThemeChange(function(){ cloud.resize(); margin.resize(); });

    ORDER.forEach(function(k){
        var b = document.createElement('button');
        b.className = 'am-chip' + (S.on[k] ? ' on' : '');
        b.textContent = TRANSFORMS[k].label;
        b.addEventListener('click', function(){
            S.on[k] = !S.on[k];
            b.classList.toggle('on', S.on[k]);
            refresh();
        });
        el.tf.appendChild(b);
    });

    el.copies.value = String(S.copies);
    el.copiesv.textContent = S.copies;
    el.copies.addEventListener('input', function(){
        S.copies = parseInt(el.copies.value, 10);
        el.copiesv.textContent = S.copies;
        refresh();
    });

    refresh();
}

var root = document.getElementById('am');
if (root) V.onApproach(root, start, 400);
})();