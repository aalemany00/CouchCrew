import { useId } from "react";
import CinemaBackdrop from "./CinemaBackdrop";

/**
 * Scalable, crisp-edged pixel theater background.
 * Built from SVG shapes so these are real scene assets, never screenshots
 * of buttons/chat/video. Theme changes do not affect room synchronization.
 */
const PALETTES = {
  classic: { wall:"#321326", deep:"#0f0917", trim:"#f7ad46", glow:"#ffa94f", fabric:"#9a1e39", seat:"#8d172b", accent:"#ffc96a", side:"#50253b" },
  thriller:{ wall:"#102c40", deep:"#06111b", trim:"#54cee9", glow:"#5fc8dd", fabric:"#163e55", seat:"#19475e", accent:"#a0eaff", side:"#173346" },
  horror:{ wall:"#240b17", deep:"#06050a", trim:"#9e2934", glow:"#e94c40", fabric:"#651322", seat:"#48101b", accent:"#eeb48d", side:"#361021" },
  comedy:{ wall:"#57244b", deep:"#211029", trim:"#ffd062", glow:"#f9b44c", fabric:"#bb3373", seat:"#933167", accent:"#f5c8eb", side:"#783062" },
  romance:{ wall:"#4a1d43", deep:"#19091d", trim:"#ffc1a0", glow:"#ff8ebd", fabric:"#a72460", seat:"#a52861", accent:"#ffc8d8", side:"#763050" },
  scifi:{ wall:"#132d53", deep:"#070d29", trim:"#53d9ff", glow:"#78d7fa", fabric:"#323178", seat:"#2c387c", accent:"#bc9aff", side:"#24466e" },
  fantasy:{ wall:"#26392f", deep:"#0b1519", trim:"#ebbf72", glow:"#e8ba65", fabric:"#6c3f27", seat:"#61432e", accent:"#b1d79e", side:"#475749" },
  action:{ wall:"#482c23", deep:"#110d13", trim:"#fca343", glow:"#ff783b", fabric:"#653127", seat:"#6d3126", accent:"#ffc18b", side:"#554039" }
};
const STARS = Array.from({length:44},(_,i)=>({x:(i*113+67)%1160+20,y:(i*71+19)%410+58,r:i%4===0?2:1}));
const BULBS = Array.from({length:37},(_,i)=>[176+i*23,104]);
const SEATS = Array.from({length:15},(_,i)=>i);
function IconProp({theme,x,y,scale=1}) {
  const common={transform:`translate(${x} ${y}) scale(${scale})`,strokeLinejoin:"miter"};
  if(theme==="horror")return <g {...common}><path d="M0 35 6 15 17 7 34 8 44 19 49 36 40 42 38 58 13 58 10 42Z" fill="#e3d2af" stroke="#3d2225" strokeWidth="4"/><rect x="12" y="28" width="11" height="12" fill="#160a16"/><rect x="30" y="28" width="10" height="12" fill="#160a16"/><path d="M25 41h5v7h-5z" fill="#221119"/><path d="M16 52v7m10-7v7m9-7v7" stroke="#4e2930" strokeWidth="3"/></g>;
  if(theme==="thriller")return <g {...common}><path d="M6 19h44v32H6z" fill="#7b6655" stroke="#261a20" strokeWidth="4"/><path d="M9 7h30v10H9z" fill="#9f876c"/><path d="M14 23h14v16H14zM33 26h10v18H33z" fill="#e7d0a8"/><path d="M20 38 40 28M20 32 40 41" stroke="#c73c43" strokeWidth="2"/><rect x="18" y="42" width="8" height="5" fill="#ca6169"/></g>;
  if(theme==="comedy")return <g {...common}><path d="M8 7h36v45H8z" fill="#e9b84d" stroke="#d07132" strokeWidth="4"/><path d="M11 20h9v7h-9zM31 20h9v7h-9z" fill="#3a1633"/><path d="M13 35q13 23 26 0" fill="none" stroke="#5a2340" strokeWidth="5"/><path d="M23 8v-8" stroke="#ffdf7c" strokeWidth="3"/></g>;
  if(theme==="romance")return <g {...common}><path d="M26 51 3 29Q-6 11 10 7Q20 4 26 14Q37 -1 49 8Q63 25 47 38Z" fill="#fd73a7" stroke="#ffd0db" strokeWidth="4"/><path d="M17 15q-7 1-9 8" stroke="#fff0ed" strokeWidth="4" fill="none"/></g>;
  if(theme==="scifi")return <g {...common}><path d="M7 13H49V49H7z" fill="#243654" stroke="#72e8fa" strokeWidth="4"/><path d="M12 18h30v23H12z" fill="#123a65"/><path d="M16 35 22 26 29 31 40 20" fill="none" stroke="#88f1fb" strokeWidth="3"/><path d="M13 44h8m7 0h12" stroke="#bf8aff" strokeWidth="4"/></g>;
  if(theme==="fantasy")return <g {...common}><path d="M8 6h40v47L28 66 8 52z" fill="#723829" stroke="#e6be6e" strokeWidth="4"/><path d="m16 33 12-18 12 18-12 18z" fill="#c2a3ed"/><rect x="25" y="24" width="6" height="20" fill="#e9d9ff"/></g>;
  if(theme==="action")return <g {...common}><rect x="1" y="13" width="52" height="40" fill="#615442" stroke="#242322" strokeWidth="5"/><path d="M5 17h45v10H5z" fill="#eaa744"/><path d="m9 27 10-10m4 10 10-10m4 10 10-10" stroke="#26201e" strokeWidth="6"/><path d="M10 35h30v8H10z" fill="#a67d48"/></g>;
  return <g {...common}><path d="M2 14h50l-7 48H9z" fill="#f4e6d5" stroke="#a41e38" strokeWidth="4"/>{[10,25,40].map(x=><path key={x} d={`M${x} 18v39`} stroke="#d22d44" strokeWidth="7"/>)}{Array.from({length:8},(_,i)=><rect key={i} x={3+(i*13)%46} y={1+(i*7)%14} width="10" height="10" fill="#ffe6a2" stroke="#f6b95f" strokeWidth="2"/>)}</g>;
}
export default function PixelTheaterScenery({theme="classic",mode="lobby"}) {
  // The Default (classic) theme uses the realistic cinema backdrop; every other
  // genre theme keeps its pixel scene below.
  const isCinema=theme==="classic";
  const p=PALETTES[theme]||PALETTES.classic;
  const uid=useId().replace(/:/g,"");
  if(isCinema)return <CinemaBackdrop/>;
  return <svg className={`pixel-theater pixel-theater--${mode}`} viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" style={{"--pixel-glow":p.glow}}>
    <defs>
      <linearGradient id={`wall-${uid}`} x2="0" y2="1"><stop stopColor={p.wall}/><stop offset="1" stopColor={p.deep}/></linearGradient>
      <pattern id={`brick-${uid}`} width="84" height="42" patternUnits="userSpaceOnUse"><path d="M0 0h84M0 21h84M42 0v21M0 21v21M84 21v21" fill="none" stroke={p.trim} strokeOpacity=".17" strokeWidth="2"/></pattern>
      <pattern id={`fabric-${uid}`} width="32" height="40" patternUnits="userSpaceOnUse"><rect width="32" height="40" fill={p.fabric}/><rect width="7" height="40" fill={p.deep} opacity=".4"/><path d="M19 0v40" stroke={p.accent} strokeOpacity=".18" strokeWidth="4"/></pattern>
    </defs>
    <rect width="1200" height="760" fill={p.deep}/>
    <rect width="1200" height="760" fill={`url(#wall-${uid})`}/>
    <rect width="1200" height="760" fill={`url(#brick-${uid})`}/>
    {theme==="thriller"&&<g><rect x="760" y="135" width="270" height="300" fill="#06111d" stroke="#496777" strokeWidth="12"/>{[0,1,2].map(i=><path key={i} d={`M${808+i*80} 140v285`} stroke="#42617c" strokeWidth="6"/>)}{Array.from({length:30},(_,i)=><path key={i} d={`M${780+(i*31)%230} ${145+(i*37)%260}l-7 20`} stroke="#6c9cb4" strokeWidth="2" opacity=".6"/>)}</g>}
    {theme==="scifi"&&<g><rect x="165" y="135" width="870" height="410" rx="50" stroke="#2e679b" strokeWidth="32" fill="#060b28"/><rect x="198" y="165" width="804" height="353" rx="30" stroke="#5dc9ee" strokeWidth="5" fill="#050e27"/>{STARS.map((s,i)=><rect key={i} x={200+(s.x%790)} y={175+(s.y%340)} width={s.r*2} height={s.r*2} fill={i%3?"#97c7fa":"#e9c6ff"}/>)}<circle cx="885" cy="285" r="90" fill="#4b4ba8"/><ellipse cx="885" cy="288" rx="136" ry="28" fill="none" stroke="#8ca7ec" strokeWidth="16"/></g>}
    {theme==="fantasy"&&<g><path d="M170 520V255Q170 130 300 130H900Q1030 130 1030 255V520" fill="#0e2530" stroke="#857453" strokeWidth="42"/><path d="M206 510V260Q206 162 306 162H894Q994 162 994 260V510" fill="none" stroke="#e1bf78" strokeWidth="8"/><rect x="215" y="190" width="160" height="330" fill="#254f61" stroke="#8b7d4b" strokeWidth="14"/><path d="M218 390 295 220 369 390" fill="#7b7db1" opacity=".4"/><rect x="825" y="190" width="160" height="330" fill="#354c5f" stroke="#8b7d4b" strokeWidth="14"/></g>}
    {theme==="action"&&<g>{Array.from({length:9},(_,i)=><path key={i} d={`M${i*155-30} 55L${i*155+80} 520`} stroke="#241c19" strokeWidth="18"/>)}<path d="M0 144h1200" stroke="#6d6d5c" strokeWidth="26"/>{Array.from({length:16},(_,i)=><path key={i} d={`M${i*90} 140l45-22`} stroke="#eb9b41" strokeWidth="8"/>)}</g>}
    {theme==="horror"&&<g><path d="M0 180Q110 40 260 135T570 95T860 120T1200 65" fill="none" stroke="#131014" strokeWidth="15"/>{[180,410,670,1000].map((x,i)=><g key={i}><path d={`M${x} 75v${120+i*15}m-40-80h80m-69-24 140 95m-140 0 140-95`} stroke="#8a8180" strokeOpacity=".65" strokeWidth="3" fill="none"/></g>)}<rect x="410" y="360" width="390" height="140" fill="#2a1721" opacity=".5"/></g>}
    {theme==="romance"&&<g>{[300,600,900].map((x,i)=><g key={i}><path d={`M${x-100} 165Q${x} 90 ${x+100} 165`} fill="none" stroke="#c77796" strokeWidth="15"/><rect x={x-12} y="140" width="24" height="24" fill="#ffd2e4"/></g>)}<path d="M0 300Q240 240 400 300T800 300T1200 300" stroke="#ef81af" strokeWidth="8" fill="none"/></g>}
    {theme==="comedy"&&<g>{[180,350,840,1020].map((x,i)=><g key={i}><path d={`M${x} 95v170`} stroke="#fbdd7c" strokeWidth="3"/><rect x={x-13} y="255" width="26" height="30" fill={i%2?"#db54b5":"#f5ae52"}/></g>)}<path d="M0 390Q280 290 500 390T1200 380" fill="none" stroke="#f8bc5c" strokeWidth="9"/></g>}
    <rect x="0" y="0" width="1200" height="82" fill={p.deep} opacity=".82"/>
    <rect x="0" y="77" width="1200" height="13" fill={p.trim}/>
    <rect x="0" y="93" width="1200" height="5" fill="#120710"/>
    <g><rect x="0" y="85" width="150" height="560" fill={`url(#fabric-${uid})`}/><rect x="1050" y="85" width="150" height="560" fill={`url(#fabric-${uid})`}/><path d="M0 92Q80 240 165 156L148 340Q85 410 0 290Z" fill={p.fabric} stroke={p.trim} strokeWidth="8"/><path d="M1200 92Q1120 240 1035 156L1052 340Q1115 410 1200 290Z" fill={p.fabric} stroke={p.trim} strokeWidth="8"/></g>
    <path d="M130 110h940v440H130z" fill="none" stroke={p.side} strokeWidth="28"/>
    <path d="M144 120h912v430H144z" fill="none" stroke={p.trim} strokeWidth="8" opacity=".8"/>
    {BULBS.map(([x,y],i)=><g key={i}><rect x={x} y={y} width="12" height="12" fill="#e39b38"/><rect x={x+2} y={y+2} width="8" height="8" fill="#fff3ac"/></g>)}
    {Array.from({length:15},(_,i)=><g key={i}><rect x="145" y={138+i*27} width="12" height="12" fill={p.glow}/><rect x="1045" y={138+i*27} width="12" height="12" fill={p.glow}/></g>)}
    <rect x="0" y="532" width="1200" height="228" fill="#0b0711" opacity=".6"/>
    <path d="M480 760 540 560H660L720 760" fill={p.side} opacity=".75"/>
    {[0,1,2,3].map(row=><g key={row} transform={`translate(${-40+row*18} ${565+row*48})`}>
      {SEATS.map(i=><g key={i} transform={`translate(${i*87} 0)`}><rect x="2" y="10" width="78" height="58" rx="8" fill="#0d070b"/><rect x="8" y="6" width="64" height="52" rx="7" fill={p.seat}/><path d="M12 13h56v5H12z" fill={p.accent} opacity=".3"/><rect x="0" y="32" width="11" height="31" fill={p.side}/><rect x="70" y="32" width="11" height="31" fill={p.side}/></g>)}</g>)}
    <path d="M535 760 580 590H620L665 760" fill="#17121a"/>
    {Array.from({length:8},(_,i)=><rect key={i} x={535+i*11} y={744-i*21} width={Math.max(4,130-i*22)} height="3" fill={p.glow} opacity=".9"/>)}
    <g opacity=".95"><IconProp theme={theme} x={35} y={385} scale={2.5}/><IconProp theme={theme} x={1070} y={385} scale={2}/></g>
    {theme==="horror"&&<g>{[60,1080,240,955].map((x,i)=><g key={i}><rect x={x} y={495+i%2*25} width="7" height="40" fill="#e9d8bc"/><rect x={x-4} y={488+i%2*25} width="15" height="9" fill="#ffd481"/></g>)}</g>}
    {theme==="romance"&&<g>{[70,1090,255,940].map((x,i)=><g key={i}><rect x={x} y={445+i%2*27} width="8" height="43" fill="#677c37"/><rect x={x-9} y={431+i%2*27} width="28" height="26" fill="#ea6197"/><rect x={x-3} y={427+i%2*27} width="17" height="15" fill="#ffd0db"/></g>)}</g>}
    {theme==="action"&&<g>{[55,1080].map((x,i)=><g key={i}><rect x={x} y="470" width="70" height="65" fill="#66523d" stroke="#302c24" strokeWidth="8"/><path d={`M${x} 485h70`} stroke="#fba735" strokeWidth="7"/></g>)}</g>}
    {theme==="scifi"&&<g>{[30,1050].map((x,i)=><g key={i}><path d={`M${x} 410h125v95H${x}z`} fill="#193350" stroke="#46d7ef" strokeWidth="5"/><path d={`M${x+15} 438h72m-60 15h75`} stroke="#70e7ff" strokeWidth="4"/></g>)}</g>}
  </svg>;
}
