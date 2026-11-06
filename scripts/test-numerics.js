/* Exercise actual widget implementations in a VM; no DOM renderer required. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const shared = {window:{matchMedia:()=>({matches:true})}};
vm.runInNewContext(fs.readFileSync('assets/viz-core.js','utf8'), shared);
const core = shared.window.VizCore;
function load(file, exports, extra = {}) {
    let code = fs.readFileSync(`assets/${file}.js`, 'utf8');
    code = code.replace(/var root = document.getElementById[^]*$/, `window.test = {${exports}}; })();`);
    const V = core;
    const context = {window:{VizCore:V}, document:{}, ...extra};
    vm.runInNewContext(code, context);
    return context.window.test;
}
function near(a,b,tol=1e-7) { assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`); }
const loss = load('loss-landscape', 'loss,grad,OPTS,simulate,S,start');
for (const [x,y] of [[0,0],[1.2,-0.7],[-2.2,2.6]]) {
    const h=1e-5, g=loss.grad(x,y);
    near(g[0],(loss.loss(x+h,y)-loss.loss(x-h,y))/(2*h));
    near(g[1],(loss.loss(x,y+h)-loss.loss(x,y-h))/(2*h));
}
const adam = loss.OPTS.find(o=>o.key==='adam');
const d = adam.step(adam.init(), [2,-3], .01);
near(d[0],-.01*2/(2+1e-8)); near(d[1],.01*3/(3+1e-8));
for (const r of loss.simulate(-2.6,2.4,.08)) assert.ok(r.hist.every(Number.isFinite));
const reg = load('regularization-geometry','ridge,lasso,gradAt,soft,S,resample', {d3:{range:n=>Array.from({length:n},(_,i)=>i)}});
near(reg.ridge(0)[0],2.1); near(reg.ridge(0)[1],1.15);
for (const lambda of [.1,.5,2]) {
    const r=reg.ridge(lambda), g=reg.gradAt(...r);
    near(g[0]+lambda*r[0],0); near(g[1]+lambda*r[1],0);
    const l=reg.lasso(lambda), gl=reg.gradAt(...l);
    l.forEach((v,i)=> v===0 ? assert.ok(Math.abs(gl[i])<=lambda+1e-6) : near(gl[i]+lambda*Math.sign(v),0));
}
const ax=load('alexnet-blueprint','LAYERS,TOTAL,CONV');
assert.equal(ax.LAYERS[5].p,885120); assert.equal(ax.TOTAL,60965224);
assert.ok(ax.CONV/ax.TOTAL<.04);
// Minimal DOM/plot doubles test event behavior without claiming browser testing.
function element() { return {value:'',textContent:'',children:[],style:{},listeners:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(k,f){this.listeners[k]=f},appendChild(b){this.children.push(b)}}; }
function controls(file, extraExports, replace) {
    const els={}; const get=id=>els[id] ||= element();
    const context={window:{VizCore:{rng:core.rng, REDUCED:true,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),webglOK:()=>false,onVisible(){},onThemeChange(){}}},document:{getElementById:get,createElement:element}, d3:{}};
    context.window.d3=context.d3; context.window.addEventListener=()=>{};
    let code=fs.readFileSync(`assets/${file}.js`,'utf8');
    code=code.replace(/var root = document.getElementById[^]*$/,`window.test = {start,S,${extraExports}}; })();`);
    code=replace(code); vm.runInNewContext(code,context); return {api:context.window.test,els,get};
}
let draws=0;
const opt=controls('loss-landscape','',s=>s.replace('plot = buildPlot();','plot = {resize(){},draw(){}};'));
opt.api.start();
opt.get('lv-lr').value='.12'; opt.get('lv-lr').listeners.input();
assert.equal(opt.api.S.cursor,220); assert.equal(opt.api.S.playing,false);
opt.get('lv-reset').listeners.click(); assert.equal(opt.api.S.cursor,0);
opt.get('lv-run').listeners.click(); assert.equal(opt.api.S.cursor,220);
const tl=controls('transfer-latent','',s=>s.replace('stack = buildStack();','stack = {resize(){},draw(){window.draws=(window.draws||0)+1;}};'));
tl.api.start(); tl.get('tl-morph').value='.2'; tl.get('tl-morph').listeners.input();
assert.equal(tl.api.S.morph,.2); tl.get('tl-freeze').listeners.click(); assert.equal(tl.api.S.frozen,false);
// Source invariant: refresh controls explicitly redraw when no ticker runs.
assert.match(fs.readFileSync('assets/transfer-latent.js','utf8'),/stack.draw\(0\);\s*renderReadout\(\);/);
console.log('PASS: analytic gradients, Adam first step, finite optimizer paths, ridge/lasso optimality, AlexNet parameter totals, reduced-motion optimizer and transfer controls');
const drop=controls('regularization-geometry','',s=>s.replace('plotA = buildA(); plotB = buildB();','plotA = {resize(){},draw(){}}; plotB = {resize(){},draw(){}};').replaceAll('d3.range(n)', 'Array.from({length:n},(_,i)=>i)'));
drop.api.start();
drop.get('rg-lam').value='1.8'; drop.get('rg-lam').listeners.input();
drop.get('rg-modes').children[2].listeners.click();
assert.equal(drop.get('rg-lam').max,'0.95'); assert.equal(drop.api.S.probability,.35);
drop.get('rg-lam').value='2'; drop.get('rg-lam').listeners.input();
assert.equal(drop.api.S.probability,.95); assert.equal(drop.api.S.lam,1.8);
drop.get('rg-modes').children[1].listeners.click(); assert.equal(drop.get('rg-lam').value,'1.8');
// Storage denial must not prevent system preference or accessible theme toggling.
let ready;
const themeButton=element(), classes=new Set();
const themeContext={window:{matchMedia:()=>({matches:true,addEventListener(){}}),dispatchEvent(){}},Event:function(){},localStorage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},MutationObserver:class {observe(){}},document:{documentElement:{dataset:{}},body:{classList:{toggle(k,on){on?classes.add(k):classes.delete(k)}}},getElementById:()=>themeButton,querySelectorAll:()=>[],addEventListener:(name,f)=>{ready=f}}};
vm.runInNewContext(fs.readFileSync('assets/site.js','utf8'),themeContext); ready();
assert.equal(themeContext.document.documentElement.dataset.theme,'light');
themeButton.listeners.click(); assert.equal(themeContext.document.documentElement.dataset.theme,'dark');
console.log('PASS: dropout probability clamping and independent lambda, theme with blocked storage');
for (const file of ['loss-landscape','regularization-geometry','transfer-latent','alexnet-blueprint','augmentation-margin']) {
    const nodes={};
    const doc={getElementById:id=>nodes[id] ||= element(), createElement:element, querySelectorAll:()=>[]};
    let code=fs.readFileSync(`assets/${file}.js`,'utf8').replace(/var root = document.getElementById[^]*$/, 'start(); })();');
    vm.runInNewContext(code,{window:{VizCore:core},document:doc});
    assert.ok(Object.values(nodes).some(n=>n.children.some(c=>c.textContent.includes('D3 could not load'))));
}
// The homepage must boot with all CDN globals missing.
const home=fs.readFileSync('index.html','utf8');
const scripts=[...home.matchAll(/<script>([^]*?)<\/script>/g)].map(m=>m[1]);
const homeNodes={}; let homeReady;
const homeDocument={getElementById:id=>homeNodes[id] ||= element(),querySelectorAll:()=>[]};
const homeContext={window:{matchMedia:()=>({matches:true}),addEventListener:(name,f)=>homeReady=f},document:homeDocument};
vm.runInNewContext(fs.readFileSync('assets/card-thumbnails.js','utf8'),homeContext);
for (const code of scripts) vm.runInNewContext(code,homeContext);
homeReady();
// Base graph uses native SVG and keeps a grouped link list when rendering fails.
let fallbackShown=false, graphWarning=false;
homeDocument.readyState='complete';
homeNodes.topics=element(); homeNodes.topics.classList.remove=()=>{fallbackShown=true};
homeContext.console={warn(){graphWarning=true}};
vm.runInNewContext(fs.readFileSync('assets/brain-graph.js','utf8'),homeContext);
assert.equal(fallbackShown,true); assert.equal(graphWarning,true);
assert.match(home,/id="graph-fallback"/);
const failed=[element(),element()];
failed.forEach(el=>{el.getAttribute=k=>k==='data-thumb'?'activation':null});
homeContext.CardThumbnails.mountAll({querySelectorAll:()=>failed});
failed.forEach(el=>assert.equal(el.textContent,'Decorative preview unavailable'));
console.log('PASS: five article widgets and homepage boot without CDN libraries');

const headTrainable=(1280+1)*512+(512+1)*256+(256+1)*10+2*(512+256);
assert.equal(headTrainable,791306);
assert.ok(fs.readFileSync('articles/cifar10-transfer-learning.html','utf8').includes(headTrainable.toLocaleString('en-US')+' trainable parameters'));

// Canonical preference wins conflicts; legacy preferences carry across page loads.
for (const [initial, expected] of [
    [{'light-mode':'true'}, 'light'],
    [{'light-mode':'false'}, 'dark'],
    [{theme:'dark','light-mode':'true'}, 'dark'],
    [{theme:'light','light-mode':'false'}, 'light']
]) {
    const storage={...initial};
    function page() {
        let onReady;
        const button=element();
        const context={...themeContext,
            localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>{storage[k]=v}},
            document:{...themeContext.document,documentElement:{dataset:{}},
                getElementById:id=>id==='themeToggle'?button:null,
                addEventListener:(name,f)=>{onReady=f}}};
        vm.runInNewContext(fs.readFileSync('assets/site.js','utf8'),context);
        onReady(); return {context,button};
    }
    const first=page();
    assert.equal(first.context.document.documentElement.dataset.theme,expected);
    first.button.listeners.click();
    const toggled=expected==='light'?'dark':'light';
    assert.equal(storage.theme,toggled);
    assert.equal(page().context.document.documentElement.dataset.theme,toggled);
}
console.log('PASS: canonical theme precedence, legacy migration and cross-page persistence');
