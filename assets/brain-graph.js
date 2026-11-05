(function () {
    'use strict';

    const COLORS = { foundations:'#00d4b8', training:'#f0a500', vision:'#a78bfa', evaluation:'#ff827c' };
    const graph = {
        nodes: [
            { id:'hub', type:'hub', name:'AI / ML', x:530, y:275 },
            { id:'foundations', type:'topic', name:'Foundations', x:295, y:55 },
            { id:'training', type:'topic', name:'Training', x:940, y:55 },
            { id:'vision', type:'topic', name:'Computer Vision', x:170, y:510 },
            { id:'evaluation', type:'topic', name:'Evaluation', x:940, y:355 },
            { id:'backprop', type:'article', topic:'foundations', name:'Backpropagation and Autodiff', lines:['Backpropagation','and Autodiff'], x:150, y:90, url:'articles/backpropagation.html', description:'How reverse-mode differentiation carries learning signals through a network.' },
            { id:'activation', type:'article', topic:'foundations', name:'Activation Functions', lines:['Activation','Functions'], x:350, y:175, url:'articles/activation-functions.html', description:'Explore how ReLU, sigmoid and tanh give neural networks their non-linearity.' },
            { id:'optimization', type:'article', topic:'training', name:'Optimization Techniques', lines:['Optimization','Techniques'], x:685, y:70, url:'articles/optimization-techniques.html', description:'Turn gradients into effective updates with momentum, adaptive steps and normalization.' },
            { id:'regularization', type:'article', topic:'training', name:'Regularization Techniques', lines:['Regularization','Techniques'], x:925, y:155, url:'articles/regularization-techniques.html', description:'Control overfitting with L1, L2, dropout and early stopping.' },
            { id:'augmentation', type:'article', topic:'training', name:'Data Augmentation', lines:['Data','Augmentation'], x:790, y:255, url:'articles/data-augmentation.html', description:'Encode useful invariances with label-preserving transforms, and automate the choice with RandAugment.' },
            { id:'alexnet', type:'article', topic:'vision', name:'AlexNet Paper', x:130, y:350, url:'articles/alexnet-paper.html', description:'Walk through the convolutional architecture that transformed ImageNet recognition.' },
            { id:'transfer', type:'article', topic:'vision', name:'Transfer Learning for CIFAR-10', lines:['Transfer Learning','for CIFAR-10'], x:365, y:450, url:'articles/cifar10-transfer-learning.html', description:'Reuse a frozen ImageNet backbone to build a fast CIFAR-10 classifier.' },
            { id:'calibration', type:'article', topic:'evaluation', name:'Model Evaluation and Calibration', lines:['Model Evaluation','and Calibration'], x:760, y:430, url:'articles/model-evaluation-calibration.html', description:'Choose held-out metrics and check whether predicted probabilities deserve trust.' },
            { id:'gradients', type:'concept', topic:'foundations', name:'Gradients', x:470, y:100 },
            { id:'nonlinearity', type:'concept', topic:'foundations', name:'Non-linearity', x:155, y:230 },
            { id:'loss', type:'concept', topic:'training', name:'Loss surfaces', x:610, y:180 },
            { id:'normalization', type:'concept', topic:'training', name:'Normalization', x:990, y:270 },
            { id:'generalization', type:'concept', topic:'training', name:'Generalization', x:585, y:365 },
            { id:'convolution', type:'concept', topic:'vision', name:'Convolution', x:125, y:435 },
            { id:'features', type:'concept', topic:'vision', name:'Pretrained features', x:340, y:325 },
            { id:'metrics', type:'concept', topic:'evaluation', name:'Metrics', x:990, y:450 },
            { id:'uncertainty', type:'concept', topic:'evaluation', name:'Uncertainty', x:930, y:515 },
            { id:'jf', type:'junction', topic:'foundations', x:300, y:260 },
            { id:'jt', type:'junction', topic:'training', x:765, y:135 },
            { id:'jv', type:'junction', topic:'vision', x:260, y:410 },
            { id:'je', type:'junction', topic:'evaluation', x:870, y:395 }
        ],
        branches: [
            ['hub','jf'], ['jf','foundations'], ['jf','backprop'], ['jf','activation'], ['jf','gradients'], ['jf','nonlinearity'],
            ['hub','jt'], ['jt','training'], ['jt','optimization'], ['jt','regularization'], ['jt','augmentation'], ['jt','loss'], ['jt','normalization'], ['jt','generalization'],
            ['hub','jv'], ['jv','vision'], ['jv','alexnet'], ['jv','transfer'], ['jv','convolution'], ['jv','features'],
            ['hub','je'], ['je','evaluation'], ['je','calibration'], ['je','metrics'], ['je','uncertainty']
        ],
        associations: [
            { from:'backprop', to:'gradients', why:'Backpropagation computes them' },
            { from:'activation', to:'gradients', why:'Saturation shrinks gradients as they flow backward' },
            { from:'activation', to:'nonlinearity', why:'The reason activations exist' },
            { from:'optimization', to:'gradients', why:'Optimizers turn gradients into updates' },
            { from:'optimization', to:'loss', why:'Momentum and adaptive steps respond to curvature' },
            { from:'optimization', to:'normalization', why:'Scaling and batch norm change conditioning' },
            { from:'regularization', to:'generalization', why:'Constrains the model to reduce overfitting' },
            { from:'augmentation', to:'generalization', why:'Encodes invariances in the training data' },
            { from:'augmentation', to:'transfer', why:'Pretrained models need matching input preprocessing' },
            { from:'alexnet', to:'convolution', why:'Deep convolutional stack on ImageNet' },
            { from:'alexnet', to:'regularization', why:'Used dropout and data augmentation' },
            { from:'alexnet', to:'activation', why:'Popularized ReLU in deep CNNs' },
            { from:'transfer', to:'features', why:'Reuses a frozen ImageNet backbone' },
            { from:'features', to:'convolution', why:'Early filters learn reusable visual features' },
            { from:'calibration', to:'generalization', why:'Held-out data estimates it' },
            { from:'calibration', to:'metrics', why:'Choosing what to measure' },
            { from:'calibration', to:'uncertainty', why:'Whether predicted probabilities can be trusted' }
        ]
    };
    const edges = graph.branches.map(([from,to])=>({ from, to, kind:'branch' }))
        .concat(graph.associations.map(edge=>({ ...edge, kind:'association' })));
    const NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs, parent, text) {
        const node = document.createElementNS(NS, tag);
        Object.entries(attrs || {}).forEach(([key,value])=>node.setAttribute(key,value));
        if(text) node.textContent = text;
        if(parent) parent.appendChild(node);
        return node;
    }

    function mount() {
        const svg = document.getElementById('topic-graph');
        const section = document.getElementById('topics');
        const caption = document.getElementById('graph-caption');
        const idleCaption = caption.textContent;
        const nodes = new Map(graph.nodes.map(node=>[node.id,node]));
        const fragment = document.createDocumentFragment();
        const defs = el('defs', {}, fragment);
        Object.entries(COLORS).forEach(([key,color])=>{
            const gradient = el('radialGradient', { id:'brain-'+key }, defs);
            el('stop', { offset:'0%', 'stop-color':'#ffffff' }, gradient);
            el('stop', { offset:'45%', 'stop-color':color }, gradient);
            el('stop', { offset:'100%', 'stop-color':color, 'stop-opacity':.5 }, gradient);
        });
        const paths = [];
        const edgeLayer = el('g', { 'aria-label':'Connections' }, fragment);
        edges.forEach((edge,index)=>{
            const a = nodes.get(edge.from), b = nodes.get(edge.to);
            const dx = b.x-a.x, dy = b.y-a.y;
            const bend = (index%2 ? 1 : -1)*.12;
            const d = `M${a.x},${a.y} C${a.x+dx*.35-dy*bend},${a.y+dy*.35+dx*bend} ${a.x+dx*.7+dy*bend},${a.y+dy*.7-dx*bend} ${b.x},${b.y}`;
            const color = COLORS[b.topic || b.id] || COLORS.foundations;
            const group = el('g', { class:'graph-edge', opacity:edge.kind==='branch' ? .45 : .25 }, edgeLayer);
            const path = el('path', { d, fill:'none', stroke:color, 'stroke-width':edge.kind==='branch' ? 1.5 : 1, 'stroke-dasharray':edge.kind==='association' ? '4 7' : 'none' }, group);
            if(edge.kind==='branch') {
                const length = Math.hypot(dx,dy);
                const nx = -dy/length, ny = dx/length;
                const c1 = { x:a.x+dx*.35-dy*bend, y:a.y+dy*.35+dx*bend };
                const c2 = { x:a.x+dx*.7+dy*bend, y:a.y+dy*.7-dx*bend };
                const taper = `M${a.x+nx*2},${a.y+ny*2} C${c1.x+nx*1.5},${c1.y+ny*1.5} ${c2.x+nx*.5},${c2.y+ny*.5} ${b.x},${b.y} C${c2.x-nx*.5},${c2.y-ny*.5} ${c1.x-nx*1.5},${c1.y-ny*1.5} ${a.x-nx*2},${a.y-ny*2} Z`;
                el('path', { d:taper, fill:color, 'aria-hidden':'true' }, group);
            } else {
                const descId = 'brain-edge-'+index;
                group.setAttribute('role','img');
                group.setAttribute('aria-label',a.name+' — '+b.name);
                group.setAttribute('aria-describedby',descId);
                el('desc', { id:descId }, group, edge.why);
            }
            paths.push({ edge, group, path });
        });
        const nodeElements = new Map();
        graph.nodes.forEach(node=>{
            const isArticle = node.type==='article';
            const colorKey = node.topic || (COLORS[node.id] ? node.id : 'foundations');
            const color = COLORS[colorKey];
            const group = el(isArticle ? 'a' : 'g', {
                class:'graph-node '+node.type, transform:`translate(${node.x},${node.y})`,
                'data-node':node.id
            }, fragment);
            if(node.name) group.setAttribute('aria-label',node.name);
            else group.setAttribute('aria-hidden','true');
            if(isArticle) {
                group.setAttribute('href',node.url);
                group.setAttribute('aria-describedby','brain-desc-'+node.id);
                el('desc', { id:'brain-desc-'+node.id }, group, node.description);
            } else if(node.name) group.setAttribute('role','group');
            const radius = isArticle ? 11 : node.type==='hub' ? 9 : node.type==='topic' ? 6 : node.type==='junction' ? 1.6 : 4;
            const art = el('g', { 'aria-hidden':'true' }, group);
            el('circle', { r:isArticle ? 45 : 22, class:'graph-hit' }, art);
            if(node.type!=='junction') {
                el('circle', { r:radius*2.5, fill:color, opacity:.12, class:'node-halo' }, art);
                el('circle', { r:radius+5, stroke:color, 'stroke-width':1, fill:'none', opacity:.55 }, art);
            }
            el('circle', { r:radius, fill:'url(#brain-'+colorKey+')' }, art);
            el('circle', { r:radius+9, class:'graph-ring' }, art);
            if(node.name) {
                const label = el('text', { 'text-anchor':'middle', y:radius+27 }, art);
                (node.lines || [node.name]).forEach((line,index)=>el('tspan', { x:0, dy:index ? 25 : 0 }, label, line));
            }
            nodeElements.set(node.id,group);
            group.addEventListener('pointerenter',()=>{ hovered = node.id; highlight(); });
            group.addEventListener('pointerleave',()=>{ hovered = null; highlight(); });
            group.addEventListener('focus',()=>{ focused = node.id; highlight(); });
            group.addEventListener('blur',()=>{ focused = null; highlight(); });
        });
        let hovered = null, focused = null;
        function highlight() {
            const id = focused || hovered;
            const neighbours = new Set(id ? [id] : []);
            paths.forEach(({edge,group})=>{
                const active = edge.from===id || edge.to===id;
                if(active) { neighbours.add(edge.from); neighbours.add(edge.to); }
                group.classList.toggle('is-dim',Boolean(id) && !active);
                group.classList.toggle('is-neighbour',active);
            });
            nodeElements.forEach((group,key)=>{
                group.classList.toggle('is-dim',Boolean(id) && !neighbours.has(key));
                group.classList.toggle('is-neighbour',neighbours.has(key));
            });
            const node = nodes.get(id);
            caption.textContent = node && node.description ? node.description : idleCaption;
        }
        const relationships = document.createElement('details');
        relationships.className = 'graph-relationships';
        const summary = document.createElement('summary');
        summary.textContent = 'Why these ideas connect';
        relationships.appendChild(summary);
        const list = document.createElement('ul');
        graph.associations.forEach(edge=>{
            const item = document.createElement('li');
            item.textContent = nodes.get(edge.from).name+' → '+nodes.get(edge.to).name+': '+edge.why+'.';
            list.appendChild(item);
        });
        relationships.appendChild(list);
        svg.replaceChildren(fragment);
        section.appendChild(relationships);

        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const narrow = window.matchMedia('(max-width: 599px)');
        const pulseLayer = el('g', { 'aria-hidden':'true', class:'graph-pulses' }, svg);
        const pulses = [0,6,14].map(index=>{
            const path = paths[index].path;
            return { circle:el('circle', { r:2.5, fill:'var(--text)' }, pulseLayer), path, length:path.getTotalLength() };
        });
        let visible = false, frame = null, elapsed = 0, previous = null;
        function tick(time) {
            if(previous!==null) elapsed += time-previous;
            previous = time;
            pulses.forEach((pulse,index)=>{
                const progress = (elapsed/12000+index/3)%1;
                const point = pulse.path.getPointAtLength(progress*pulse.length);
                pulse.circle.setAttribute('transform',`translate(${point.x},${point.y})`);
                pulse.circle.setAttribute('opacity',Math.sin(progress*Math.PI)*.8);
            });
            frame = requestAnimationFrame(tick);
        }
        function syncMotion() {
            if(frame!==null) cancelAnimationFrame(frame);
            frame = null;
            previous = null;
            const running = visible && !document.hidden && !motion.matches && !narrow.matches;
            pulseLayer.style.display = running ? '' : 'none';
            svg.dataset.pulses = running ? 'running' : 'paused';
            if(running) frame = requestAnimationFrame(tick);
        }
        const observer = new IntersectionObserver(entries=>{ visible = entries[0].isIntersecting; syncMotion(); });
        observer.observe(svg);
        document.addEventListener('visibilitychange',syncMotion);
        motion.addEventListener('change',syncMotion);
        narrow.addEventListener('change',syncMotion);
        syncMotion();
        section.classList.add('graph-mounted');
    }

    function boot() {
        try { mount(); }
        catch(error) {
            document.getElementById('topics').classList.remove('graph-mounted');
            console.warn('Topic map unavailable; use the article list.',error);
        }
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
    else boot();
}());
