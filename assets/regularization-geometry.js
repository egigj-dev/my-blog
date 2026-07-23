/* ============================================================================
   regularization-geometry.js — "Constraint Contours & Subnetwork Pruner"

   The SETUP is illustrative: a synthetic two-parameter quadratic loss and a
   small randomly-weighted network, chosen so the geometry is visible in 2D.

   The SOLUTIONS are computed, not drawn. The ridge point is the closed-form
   (H + lambda*I)^-1 H b_hat. The lasso point comes from proximal gradient
   descent with soft-thresholding — the same operator that produces sparsity
   in practice. Loss contours are traced by marching squares over the real
   loss field, so where the contour meets the constraint really is the optimum.
   ========================================================================== */
(function(){
'use strict';
var V = window.VizCore;
if (!V) return;

/* --------------------------------------------------------------- the loss */
// f(b) = 0.5 * (b - bHat)' H (b - bHat).  H correlated so contours tilt.
var H11 = 1.0, H12 = 0.55, H22 = 0.75;
var BX = 2.1, BY = 1.15;                       // unregularised optimum

function lossAt(x, y){
    var dx = x - BX, dy = y - BY;
    return 0.5 * (H11*dx*dx + 2*H12*dx*dy + H22*dy*dy);
}
function gradAt(x, y){
    var dx = x - BX, dy = y - BY;
    return [H11*dx + H12*dy, H12*dx + H22*dy];
}

// Ridge: closed form (H + lambda I)^-1 H bHat
function ridge(lam){
    var a = H11+lam, b = H12, c = H12, d = H22+lam;
    var det = a*d - b*c;
    if (Math.abs(det) < 1e-12) return [0,0];
    var hx = H11*BX + H12*BY, hy = H12*BX + H22*BY;      // H * bHat
    return [ ( d*hx - b*hy)/det, (-c*hx + a*hy)/det ];
}
// Lasso: proximal gradient. soft() is the proximal operator of the L1 norm,
// and it is what drives coefficients to exactly zero.
function soft(v, k){ var s = v<0?-1:1, m = Math.abs(v)-k; return m>0 ? s*m : 0; }
function lasso(lam){
    var x = BX, y = BY, t = 0.6;                          // t < 1/L(H)
    for (var i=0;i<500;i++){
        var g = gradAt(x,y);
        x = soft(x - t*g[0], t*lam);
        y = soft(y - t*g[1], t*lam);
    }
    return [x,y];
}

/* ------------------------------------------------------------- the network */
var LAYERS = [4,5,3];
var W0 = (function(){                                     // seeded base weights
    var g = V.rng(97), out = [];
    for (var l=0;l<LAYERS.length-1;l++){
        var m = [];
        for (var i=0;i<LAYERS[l];i++) for (var j=0;j<LAYERS[l+1];j++)
            m.push({ l:l, i:i, j:j, w:(g()*2-1) });
        out.push(m);
    }
    return out;
})();
var TOTAL = W0.reduce(function(a,m){ return a + m.length; }, 0);

/* -------------------------------------------------------------------- state */
var S = { lam:0.35, mode:'l1', drop:null, runs:0 };
var el = {}, plotA = null, plotB = null;

/* ------------------------------------------------- panel A: constraint plot */
function buildA(){
    var svg = d3.select('#rg-geo'), g = svg.append('g');
    var gField = g.append('g'), gCons = g.append('g'), gPts = g.append('g'), gAx = g.append('g');
    var xS, yS, W, Hh;
    var DOM = [-0.6, 3.2];

    function resize(){
        var wrap = document.getElementById('rg-geo').parentElement;
        W = wrap.clientWidth; Hh = wrap.clientHeight;
        if (!W || !Hh) return;
        svg.attr('viewBox','0 0 '+W+' '+Hh);
        var size = Math.min(W, Hh) - 44, ox = (W-size)/2, oy = (Hh-size)/2;
        xS = d3.scaleLinear(DOM, [ox, ox+size]);
        yS = d3.scaleLinear(DOM, [oy+size, oy]);
        drawField(); draw();
    }

    // Loss contours via marching squares over the real loss field
    function drawField(){
        var p = V.palette(), N = 90;
        var vals = new Array(N*N);
        for (var r=0;r<N;r++) for (var c=0;c<N;c++){
            var x = DOM[0] + (DOM[1]-DOM[0])*c/(N-1);
            var y = DOM[0] + (DOM[1]-DOM[0])*(N-1-r)/(N-1);
            vals[r*N+c] = lossAt(x,y);
        }
        var thresholds = [0.05,0.2,0.45,0.8,1.25,1.8,2.5,3.3];
        var contours = d3.contours().size([N,N]).thresholds(thresholds)(vals);
        var sx = (xS(DOM[1])-xS(DOM[0]))/(N-1), sy = (yS(DOM[0])-yS(DOM[1]))/(N-1);
        gField.selectAll('path').data(contours).join('path')
            .attr('d', d3.geoPath())
            .attr('transform','translate('+xS(DOM[0])+','+yS(DOM[1])+') scale('+sx+','+sy+')')
            .attr('fill','none').attr('stroke',p.muted).attr('stroke-width',0.7/Math.max(sx,0.001))
            .attr('vector-effect','non-scaling-stroke').attr('opacity',0.3);
    }

    function draw(){
        if (!xS) return;
        var p = V.palette();
        var rg = ridge(S.lam), la = lasso(S.lam);
        var r2 = Math.sqrt(rg[0]*rg[0] + rg[1]*rg[1]);       // L2 budget hit by ridge
        var r1 = Math.abs(la[0]) + Math.abs(la[1]);          // L1 budget hit by lasso

        gAx.selectAll('*').remove();
        gAx.append('line').attr('x1',xS(DOM[0])).attr('x2',xS(DOM[1])).attr('y1',yS(0)).attr('y2',yS(0))
           .attr('stroke',p.muted).attr('stroke-width',1).attr('opacity',0.5);
        gAx.append('line').attr('y1',yS(DOM[0])).attr('y2',yS(DOM[1])).attr('x1',xS(0)).attr('x2',xS(0))
           .attr('stroke',p.muted).attr('stroke-width',1).attr('opacity',0.5);

        // Constraint regions: L2 circle and L1 diamond at the budgets above
        var cons = [
            { type:'circle',  r:r2, color:'#4cc9f0' },
            { type:'diamond', r:r1, color:'#ffd166' }
        ];
        gCons.selectAll('path').data(cons).join('path')
            .attr('d', function(d){
                if (d.type === 'circle'){
                    return d3.arc()({ innerRadius:0, outerRadius:Math.abs(xS(d.r)-xS(0)), startAngle:0, endAngle:2*Math.PI });
                }
                var rr = d.r;
                return 'M'+xS(0)+','+yS(rr)+'L'+xS(rr)+','+yS(0)+'L'+xS(0)+','+yS(-rr)+'L'+xS(-rr)+','+yS(0)+'Z';
            })
            .attr('transform', function(d){ return d.type==='circle' ? 'translate('+xS(0)+','+yS(0)+')' : null; })
            .attr('fill', function(d){ return d.color; }).attr('fill-opacity',0.07)
            .attr('stroke', function(d){ return d.color; }).attr('stroke-width',1.6);

        // The unregularised optimum and the two constrained solutions
        var pts = [
            { x:BX,     y:BY,     c:p.muted,   r:4,   lab:'unregularised' },
            { x:rg[0],  y:rg[1],  c:'#4cc9f0', r:5.5, lab:'L2' },
            { x:la[0],  y:la[1],  c:'#ffd166', r:5.5, lab:'L1' }
        ];
        gPts.selectAll('circle').data(pts).join('circle')
            .attr('cx',function(d){return xS(d.x);}).attr('cy',function(d){return yS(d.y);})
            .attr('r',function(d){return d.r;}).attr('fill',function(d){return d.c;});
        gPts.selectAll('text').data(pts.slice(1)).join('text')
            .attr('x',function(d){return xS(d.x)+9;}).attr('y',function(d){return yS(d.y)-7;})
            .attr('font-size',11).attr('font-weight',600).attr('fill',function(d){return d.c;})
            .text(function(d){return d.lab;});

        var sparse = Math.abs(la[0]) < 1e-9 || Math.abs(la[1]) < 1e-9;
        el.geoNote.innerHTML =
            'L1 &rarr; (' + la[0].toFixed(3) + ', ' + la[1].toFixed(3) + ')' +
            (sparse ? ' <b class="rg-hit">exactly zero &mdash; sparse</b>' : '') +
            '<span class="rg-sep">·</span>L2 &rarr; (' + rg[0].toFixed(3) + ', ' + rg[1].toFixed(3) + ')' +
            ' <span class="rg-dim">shrunk, never zero</span>';
    }
    return { resize:resize, draw:draw };
}

/* --------------------------------------------------- panel B: network pruner */
function buildB(){
    var svg = d3.select('#rg-net'), g = svg.append('g');
    var gE = g.append('g'), gN = g.append('g');
    var W, Hh, nodePos = [];

    function resize(){
        var wrap = document.getElementById('rg-net').parentElement;
        W = wrap.clientWidth; Hh = wrap.clientHeight;
        if (!W || !Hh) return;
        svg.attr('viewBox','0 0 '+W+' '+Hh);
        var padX = 54, padY = 34;
        nodePos = LAYERS.map(function(n, l){
            var x = padX + (W-2*padX) * (l/(LAYERS.length-1));
            return d3.range(n).map(function(i){
                return { x:x, y:padY + (Hh-2*padY) * (n===1?0.5:(i/(n-1))) };
            });
        });
        draw();
    }

    // Effective weights under the active regulariser.
    // L1 uses the same soft-threshold operator as the lasso above; L2 scales
    // every weight by 1/(1+lambda); dropout masks whole units.
    function effective(){
        var out = [], mask = S.drop;
        for (var l=0;l<W0.length;l++){
            out.push(W0[l].map(function(e){
                var w = e.w;
                if (S.mode === 'l1') w = soft(w, S.lam * 0.85);
                else if (S.mode === 'l2') w = w / (1 + S.lam * 4);
                else if (S.mode === 'drop' && mask){
                    if (mask[e.l] && mask[e.l][e.i]) w = 0;
                    if (mask[e.l+1] && mask[e.l+1][e.j]) w = 0;
                }
                return { l:e.l, i:e.i, j:e.j, w:w };
            }));
        }
        return out;
    }

    function draw(){
        if (!nodePos.length) return;
        var p = V.palette();
        var eff = effective(), flat = [];
        eff.forEach(function(m){ m.forEach(function(e){ flat.push(e); }); });
        var alive = flat.filter(function(e){ return Math.abs(e.w) > 1e-9; });
        var col = S.mode==='l1' ? '#ffd166' : (S.mode==='l2' ? '#4cc9f0' : '#06d6a0');

        gE.selectAll('line').data(flat).join('line')
            .attr('x1',function(e){ return nodePos[e.l][e.i].x; })
            .attr('y1',function(e){ return nodePos[e.l][e.i].y; })
            .attr('x2',function(e){ return nodePos[e.l+1][e.j].x; })
            .attr('y2',function(e){ return nodePos[e.l+1][e.j].y; })
            .attr('stroke',col)
            .attr('stroke-width',function(e){ return 0.4 + Math.abs(e.w)*2.6; })
            .attr('opacity',function(e){ return Math.abs(e.w)<1e-9 ? 0 : 0.18 + Math.abs(e.w)*0.6; });

        var nodes = [];
        nodePos.forEach(function(layer, l){ layer.forEach(function(n, i){
            var dropped = S.mode==='drop' && S.drop && S.drop[l] && S.drop[l][i];
            nodes.push({ x:n.x, y:n.y, dropped:dropped });
        }); });
        gN.selectAll('circle').data(nodes).join('circle')
            .attr('cx',function(d){return d.x;}).attr('cy',function(d){return d.y;}).attr('r',6)
            .attr('fill',function(d){ return d.dropped ? 'transparent' : p.card; })
            .attr('stroke',function(d){ return d.dropped ? p.muted : col; })
            .attr('stroke-width',1.6)
            .attr('stroke-dasharray',function(d){ return d.dropped ? '2 2' : null; })
            .attr('opacity',function(d){ return d.dropped ? 0.35 : 1; });

        var label = S.mode==='l1' ? 'weights driven to exactly zero'
                  : S.mode==='l2' ? 'every weight shrunk, none removed'
                  : 'units masked at random each pass';
        el.netNote.innerHTML = '<b>'+alive.length+' / '+TOTAL+'</b> weights active <span class="rg-dim">&mdash; '+label+'</span>';
    }
    return { resize:resize, draw:draw };
}

/* --------------------------------------------------------------- controls */
function resample(){
    var g = V.rng(1000 + (S.runs++));
    S.drop = LAYERS.map(function(n, l){
        return d3.range(n).map(function(){
            return (l>0 && l<LAYERS.length-1) ? g() < S.lam : false;   // hidden units only
        });
    });
}

function start(){
    el.geoNote = document.getElementById('rg-geonote');
    el.netNote = document.getElementById('rg-netnote');
    el.lam     = document.getElementById('rg-lam');
    el.lamv    = document.getElementById('rg-lamv');
    el.modes   = document.getElementById('rg-modes');

    plotA = buildA(); plotB = buildB();
    plotA.resize(); plotB.resize();
    window.addEventListener('resize', function(){ plotA.resize(); plotB.resize(); });
    V.onThemeChange(function(){ plotA.resize(); plotB.resize(); });

    [['l1','L1 (lasso)'],['l2','L2 (ridge)'],['drop','Dropout']].forEach(function(m){
        var b = document.createElement('button');
        b.className = 'rg-chip' + (m[0]===S.mode ? ' on' : '');
        b.textContent = m[1];
        b.addEventListener('click', function(){
            S.mode = m[0];
            Array.prototype.forEach.call(el.modes.children, function(c){ c.classList.remove('on'); });
            b.classList.add('on');
            document.getElementById('rg-lamlabel').textContent = S.mode==='drop' ? 'Drop rate' : 'Lambda';
            if (S.mode==='drop') resample();
            plotB.draw();
        });
        el.modes.appendChild(b);
    });

    el.lam.value = String(S.lam);
    el.lamv.textContent = S.lam.toFixed(2);
    el.lam.addEventListener('input', function(){
        S.lam = parseFloat(el.lam.value);
        el.lamv.textContent = S.lam.toFixed(2);
        if (S.mode==='drop') resample();
        plotA.draw(); plotB.draw();
    });

    resample();
    plotA.draw(); plotB.draw();

    // Dropout resamples on a slow beat so the "different subnetwork each pass"
    // idea is visible; the other two modes are deterministic.
    if (!V.REDUCED){
        var visible = true, acc = 0, prev = 0;
        V.onVisible(document.getElementById('rg'), function(v){ visible = v; });
        V.ticker(function(t){
            var dt = t - prev; prev = t;
            if (!(dt>0) || dt>0.05) dt = 0.016;
            if (!visible || S.mode!=='drop') return;
            acc += dt;
            if (acc > 1.1){ acc = 0; resample(); plotB.draw(); }
        });
    }
}

var root = document.getElementById('rg');
if (root) V.onApproach(root, start, 400);
})();