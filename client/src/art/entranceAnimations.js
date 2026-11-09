// GENERATED decorative artwork (entrance animations). Static, inert markup authored for the
// Default (classic) theme - no user input ever flows into it. Rendered via
// dangerouslySetInnerHTML inside aria-hidden containers.
// Lightweight by design: only transform/opacity animations (compositor-only), a
// few dozen animated nodes, no blur/brightness filters, no per-frame JS.
export function startEntranceAnimations(R){
 const timers=[];
 const setInterval=(f,t)=>{const id=window.setInterval(f,t);timers.push(id);return id};
 const mk=(css,html='')=>{const d=document.createElement('div');d.className='a';d.style.cssText=css;d.innerHTML=html;R.appendChild(d);return d};


let seed=11;const rn=()=>{seed=(seed*9301+49297)%233280;return seed/233280};
const sty=e=>e.getAttribute('style')||'';
// bulb chase + neon flicker
{const bl=[...R.querySelectorAll('.bulb')];const mkg=()=>{const g=document.createElement('div');g.style.cssText='position:absolute;inset:0;pointer-events:none';bl[0].parentNode.appendChild(g);return g};
 const A=mkg(),B=mkg();bl.forEach((el,k)=>{if(k%3==0)A.appendChild(el);else if(k%3==1)B.appendChild(el)});
 A.animate([{opacity:1},{opacity:.3},{opacity:1}],{duration:1200,iterations:Infinity});B.animate([{opacity:.3},{opacity:1},{opacity:.3}],{duration:1200,iterations:Infinity});}
[...R.querySelectorAll('div')].filter(e=>['CONCESSIONS','THEATER 1 ENTRANCE','BOX OFFICE'].includes(e.textContent)&&e.children.length==0).forEach((el,i)=>el.animate([{opacity:1},{opacity:1,offset:.86},{opacity:.35,offset:.88},{opacity:1,offset:.9},{opacity:.5,offset:.92},{opacity:1,offset:.95},{opacity:1}],{duration:4200+i*900,iterations:Infinity}));
// ---------- popcorn ----------
const variants=[
 [[9,14,5.5],[15,13,6],[12,8,5.5],[7,9,3.6],[17.5,7.5,3.6]],
 [[8,13,5],[14,15,5.2],[16,9,5.4],[10,7,5],[5,8,3.2]],
 [[12,15,5.6],[6,12,4.4],[18,12,4.6],[9,6,4.6],[15,5.5,4.2]]];
const pc=(sz,v,rot)=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" style="display:block;transform:rotate(${rot}deg);overflow:visible"><g fill="url(#ce-pg)" stroke="rgba(140,90,25,.5)" stroke-width=".6">${variants[v].map(c=>`<circle cx="${c[0]}" cy="${c[1]}" r="${c[2]}"/>`).join('')}</g><ellipse cx="12" cy="${v==1?20:19.5}" rx="3" ry="2" fill="#d8962a"/></svg>`;
const cube={x:437,y:326,w:116,h:84};
const clip=mk(`left:${cube.x}px;top:${cube.y}px;width:${cube.w}px;height:${cube.h}px;overflow:hidden;z-index:2`);
const arr=[];
for(let i=0;i<84;i++){const sz=17+rn()*9;const xn=rn();const prof=.5+.5*Math.sin(Math.PI*xn);
 const x=4+xn*(cube.w-sz-8);const y=cube.h-sz*.9-Math.pow(rn(),1.5)*(cube.h*.7*prof);arr.push({x,y,sz,v:Math.floor(rn()*3),rot:rn()*360})}
arr.sort((a,b)=>a.y-b.y);
arr.forEach(p=>{const d=document.createElement('div');d.style.cssText=`position:absolute;left:${p.x}px;top:${p.y}px;width:${p.sz}px;height:${p.sz}px;opacity:${.82+.18*(p.y/cube.h)}`;d.innerHTML=pc(p.sz,p.v,p.rot);clip.appendChild(d);p.el=d;
 if(rn()<.09)d.animate([{transform:'translateY(0)'},{transform:`translateY(${-(8+rn()*34)}px) rotate(${(rn()-.5)*50}deg)`,offset:.3},{transform:'translateY(0)'}],{duration:550+rn()*700,delay:rn()*3000,iterations:Infinity,easing:'ease-out'})});
// glass glare over pile
mk(`left:${cube.x}px;top:${cube.y}px;width:${cube.w}px;height:${cube.h}px;z-index:3;background:linear-gradient(110deg,rgba(255,255,255,.22),rgba(255,255,255,0) 28%,rgba(255,255,255,.06) 100%);pointer-events:none`);
// fresh kernels popping from the kettle and falling onto the pile
setInterval(()=>{const sz=12+Math.random()*7;const p=document.createElement('div');const x0=cube.w/2-sz/2+(Math.random()-.5)*34;
 p.style.cssText=`position:absolute;left:${x0}px;top:22px;width:${sz}px;height:${sz}px`;p.innerHTML=pc(sz,Math.floor(Math.random()*3),Math.random()*360);clip.appendChild(p);
 const dx=(Math.random()-.5)*70;p.animate([{transform:'translate(0,0) rotate(0) scale(.5)',opacity:0},{transform:`translate(${dx*.4}px,-22px) rotate(160deg) scale(1)`,opacity:1,offset:.25},{transform:`translate(${dx}px,${28+Math.random()*24}px) rotate(380deg) scale(1)`,opacity:1}],{duration:900,easing:'cubic-bezier(.3,.6,.6,1)'}).onfinish=()=>p.remove()},1200);
// steam from the top vent
setInterval(()=>{const p=mk(`left:${468+Math.random()*50}px;top:296px;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.3),rgba(255,255,255,0) 70%);z-index:4`);
 p.animate([{transform:'translate(0,0) scale(.6)',opacity:.45},{transform:`translate(${(Math.random()-.5)*26}px,-42px) scale(1.8)`,opacity:0}],{duration:2200}).onfinish=()=>p.remove()},2600);
// ---------- soda ----------
const svg=ns=>document.createElementNS('http://www.w3.org/2000/svg',ns);
const liq=R.querySelector('#ce-liq'),stream=R.querySelector('#ce-stream'),bubs=R.querySelector('#ce-bubs');
if(liq){const T=7000;
 /* the stream is an SVG rect: without transform-box it would scale from the svg's left edge and slide in from the side */
 stream.style.transformBox='fill-box';stream.style.transformOrigin='center top';
 /* fill 0-55%, hold, then the full cup fades out and is swapped for an empty one while hidden (no instant drain) */
 liq.animate([{transform:'scaleY(.04)',opacity:1},{transform:'scaleY(.92)',opacity:1,offset:.55},{transform:'scaleY(.92)',opacity:1,offset:.84},{transform:'scaleY(.92)',opacity:0,offset:.92},{transform:'scaleY(.04)',opacity:0,offset:.93},{transform:'scaleY(.04)',opacity:0,offset:.98},{transform:'scaleY(.04)',opacity:1}],{duration:T,iterations:Infinity});
 /* stream grows down from the nozzle, flows steadily, then retracts upward */
 stream.animate([{opacity:0,transform:'scaleY(.05) scaleX(1)'},{opacity:.95,transform:'scaleY(1) scaleX(1)',offset:.04},{opacity:.95,transform:'scaleY(1) scaleX(1)',offset:.53},{opacity:0,transform:'scaleY(.05) scaleX(.6)',offset:.57},{opacity:0,transform:'scaleY(.05) scaleX(1)'}],{duration:T,iterations:Infinity});
 for(let i=0;i<4;i++){const c=svg('circle');c.setAttribute('cx',72+Math.random()*16);c.setAttribute('cy',108);c.setAttribute('r',.7+Math.random()*1.1);c.setAttribute('fill','rgba(255,255,255,.8)');bubs.appendChild(c);
  c.animate([{transform:'translateY(0)',opacity:0},{opacity:.9,offset:.2},{transform:`translateY(${-24-Math.random()*8}px)`,opacity:0}],{duration:900+Math.random()*900,delay:Math.random()*2000,iterations:Infinity})}}
// bubbles in the two finished cups
const sodaSvg=R.querySelector('svg[viewBox="0 0 160 170"]');
[[40,'#fff'],[120,'#fff']].forEach(([cx])=>{for(let i=0;i<4;i++){const c=svg('circle');c.setAttribute('cx',cx-8+Math.random()*16);c.setAttribute('cy',106);c.setAttribute('r',.7+Math.random()*1);c.setAttribute('fill','rgba(255,255,255,.75)');sodaSvg.appendChild(c);
 c.animate([{transform:'translateY(0)',opacity:0},{opacity:.9,offset:.2},{transform:`translateY(${-16-Math.random()*6}px)`,opacity:0}],{duration:1100+Math.random()*900,delay:Math.random()*2200,iterations:Infinity})}});
// fizz above the filling cup
for(let i=0;i<5;i++){const f=mk(`left:${663+Math.random()*14}px;top:376px;width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.85);z-index:5`);
 f.animate([{transform:'translate(0,0)',opacity:0},{opacity:1,offset:.3},{transform:`translate(${(Math.random()-.5)*16}px,${-10-Math.random()*12}px)`,opacity:0}],{duration:600+Math.random()*500,delay:Math.random()*2500,iterations:Infinity})}
// ---------- candy ----------
const lol=R.querySelector('#ce-lolls');if(lol)[...lol.children].forEach((g,i)=>{g.style.transformBox='fill-box';g.style.transformOrigin='center bottom';g.animate([{transform:'rotate(-3deg)'},{transform:'rotate(3deg)'},{transform:'rotate(-3deg)'}],{duration:2600+i*500,iterations:Infinity,easing:'ease-in-out'}).effect.updateTiming({})});
const glint=mk('left:764px;top:342px;width:20px;height:128px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-18deg);z-index:6;pointer-events:none');
glint.animate([{transform:'translateX(-10px) skewX(-18deg)',opacity:0},{opacity:1,offset:.1},{transform:'translateX(90px) skewX(-18deg)',opacity:0,offset:.3},{opacity:0}],{duration:6000,iterations:Infinity});
// ---------- ticket + doors + guests ----------
const tk=[...R.querySelectorAll('div')].find(e=>sty(e).includes('left:78px;top:440px'));
if(tk)tk.animate([{transform:'translateY(0)'},{transform:'translateY(-8px)',offset:.15},{transform:'translateY(0)',offset:.3},{transform:'translateY(0)'}],{duration:4000,iterations:Infinity,easing:'ease-out'});
const cols=['#14080c','#1c0c12','#0d0a14','#1a1008'];
for(let g=0;g<2;g++){const dir=g%2?1:-1;const sc=.8+Math.random()*.5;const y=640+Math.random()*120;
 const w=mk(`left:0;top:${y}px;width:50px;height:120px;z-index:${g};opacity:.85;transform:scale(${sc})${dir>0?'':' scaleX(-1)'};transform-origin:bottom`,
 `<div style="position:absolute;left:14px;top:0;width:22px;height:24px;border-radius:50%;background:radial-gradient(circle at 40% 30%,#c99a78,#3a2418 80%);box-shadow:inset 0 5px 0 ${cols[g%4]}"></div>
  <div style="position:absolute;left:8px;top:24px;width:34px;height:52px;border-radius:14px 14px 6px 6px;background:linear-gradient(${['#8e1f31','#2c3a6a','#3a3a3a','#6a4a1a'][g%4]},${cols[g%4]});box-shadow:inset 2px 0 0 rgba(255,200,150,.25)"></div>
  <div class="leg" style="position:absolute;left:12px;top:74px;width:11px;height:40px;border-radius:5px;background:#0c0508;transform-origin:top"></div>
  <div class="leg2" style="position:absolute;left:27px;top:74px;width:11px;height:40px;border-radius:5px;background:#0c0508;transform-origin:top"></div>
  ${g%3==0?'<div style="position:absolute;left:30px;top:44px;width:16px;height:22px;background:repeating-linear-gradient(90deg,#c8302f 0 3px,#fff 3px 6px);clip-path:polygon(0 0,100% 0,85% 100%,15% 100%)"></div>':''}`);
 const dur=16000+Math.random()*10000,delay=-Math.random()*dur;
 const fl=dir>0?'':' scaleX(-1)';w.animate([{transform:`translateX(${dir>0?-80:1300}px) scale(${sc})${fl}`},{transform:`translateX(${dir>0?1300:-80}px) scale(${sc})${fl}`}],{duration:dur,delay:delay,iterations:Infinity});
 w.querySelector('.leg').animate([{transform:'rotate(-22deg)'},{transform:'rotate(22deg)'},{transform:'rotate(-22deg)'}],{duration:700,iterations:Infinity});
 w.querySelector('.leg2').animate([{transform:'rotate(22deg)'},{transform:'rotate(-22deg)'},{transform:'rotate(22deg)'}],{duration:700,iterations:Infinity});
}
const dl=[...R.querySelectorAll('div')].find(e=>sty(e).includes('left:940px;top:258px')),dr=[...R.querySelectorAll('div')].find(e=>sty(e).includes('left:1084px;top:258px'));
mk('left:943px;top:261px;width:274px;height:164px;background:radial-gradient(ellipse at 50% 100%,#fff2c0,#ffb25a 55%,#7a3a1a);z-index:1');
if(dl&&dr){dl.style.zIndex=2;dr.style.zIndex=2;dl.style.transformOrigin='left';dr.style.transformOrigin='right';
 const kf=[{transform:'scaleX(1)'},{transform:'scaleX(1)',offset:.55},{transform:'scaleX(.12)',offset:.68},{transform:'scaleX(.12)',offset:.85},{transform:'scaleX(1)',offset:.95},{transform:'scaleX(1)'}];
 dl.animate(kf,{duration:12000,iterations:Infinity,easing:'ease-in-out'});dr.animate(kf,{duration:12000,iterations:Infinity,easing:'ease-in-out'});}
 const onVis=()=>R.getAnimations({subtree:true}).forEach(a=>document.hidden?a.pause():a.play());
 document.addEventListener('visibilitychange',onVis);
 return ()=>{timers.forEach(clearInterval);document.removeEventListener('visibilitychange',onVis);R.getAnimations({subtree:true}).forEach(a=>a.cancel());};
}
