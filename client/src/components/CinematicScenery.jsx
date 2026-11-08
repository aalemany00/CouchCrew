import { useId } from "react";

/**
 * Asset-free, cinematic theater sets. Every element is editable SVG: real
 * perspective, materials, silhouettes and lighting, not a screenshot of UI.
 * The player, camera tiles, room settings and chat stay regular React controls.
 */
const LOOKS = {
  classic:  { wall:"#24171d", ceiling:"#110e16", floor:"#22151a", seat:"#8c273b", trim:"#d2a56d", light:"#ffd1a0" },
  horror:   { wall:"#17201e", ceiling:"#090e12", floor:"#171716", seat:"#35232b", trim:"#777f74", light:"#b9edc8" },
  romance:  { wall:"#38212e", ceiling:"#181321", floor:"#34232c", seat:"#9d4a60", trim:"#dfb992", light:"#ffd9bd" },
  thriller: { wall:"#142630", ceiling:"#09141b", floor:"#14212a", seat:"#314b51", trim:"#92aab3", light:"#7fd6e8" },
  comedy:   { wall:"#422d2b", ceiling:"#1d121d", floor:"#40242a", seat:"#ac3547", trim:"#f5c477", light:"#ffe2ad" },
  scifi:    { wall:"#0f2331", ceiling:"#040c18", floor:"#142733", seat:"#233f55", trim:"#58bfd9", light:"#6ee6fa" },
  fantasy:  { wall:"#2c3027", ceiling:"#171a19", floor:"#282821", seat:"#61452e", trim:"#c5ac77", light:"#ffd58a" },
  action:   { wall:"#37342e", ceiling:"#13191e", floor:"#31302a", seat:"#485047", trim:"#baa681", light:"#ffb97c" }
};
const STARS = Array.from({ length: 56 }, (_, i) => ({ x: 350 + ((i*97+29)%755), y: 16 + ((i*71+13)%250), r: i%5===0?2:1 }));
const RAIN = Array.from({ length: 32 }, (_, i) => ({ x: 70+(i*41)%190, y: 30+(i*67)%400 }));
const petals = Array.from({ length: 15 }, (_, i) => ({ x: (i*137+54)%1440, y: (i*89+31)%770 }));

function Seat({ x, y, scale=1, uid }) {
  return (
    <g transform={"translate("+x+" "+y+") scale("+scale+")"}>
      <ellipse cx="0" cy="99" rx="62" ry="14" fill="#020305" opacity=".6"/>
      <rect x="-60" y="18" width="120" height="83" rx="27" fill={"url(#seatSide-"+uid+")"} stroke="#09080b" strokeWidth="6"/>
      <path d="M-50 17Q-50 -12 -20 -16H20Q50 -12 50 17V66Q0 93 -50 66Z" fill={"url(#seat-"+uid+")"} stroke="#100c10" strokeWidth="6"/>
      <path d="M-39 10Q-30 -1 -12 -3H12Q31 -1 39 10" stroke="#ffe1db" strokeOpacity=".22" strokeWidth="4" fill="none"/>
      <path d="M-50 60Q0 46 50 60V88Q0 99 -50 88Z" fill={"url(#seatSide-"+uid+")"}/>
      <rect x="-66" y="63" width="18" height="36" rx="7" fill="#121318" stroke="#6c5551" strokeWidth="2"/>
      <rect x="48" y="63" width="18" height="36" rx="7" fill="#121318" stroke="#6c5551" strokeWidth="2"/>
      <ellipse cx="58" cy="64" rx="7" ry="4" fill="#a9946b"/><ellipse cx="58" cy="64" rx="4" ry="2" fill="#090a0e"/>
    </g>
  );
}

function VenueProps({ theme, uid }) {
  switch (theme) {
    case "horror":
      return <g>
        <g opacity=".9"><circle cx="1124" cy="196" r="84" fill="#cfe2bd" opacity=".17" filter={"url(#bloom-"+uid+")"}/><circle cx="1124" cy="196" r="52" fill="#d8e2cf" opacity=".43"/></g>
        <path d="M0 50Q150 190 260 40M100 0Q180 85 120 190M1440 0Q1280 160 1210 35" stroke="#1e3029" strokeWidth="18" fill="none"/>
        <g stroke="#a6ada1" strokeOpacity=".25" fill="none" strokeWidth="2">
          <path d="M0 0 230 220M0 35 180 190M30 0 198 170M0 70 168 145"/><path d="M0 0Q170 40 230 220M0 0Q65 140 230 220"/>
          <path d="M1440 0 1220 220M1440 40 1280 185M1440 75 1300 144M1440 0Q1290 50 1220 220"/>
        </g>
        <path d="M130 130 250 280 208 353 270 460M1330 116 1240 220 1310 270 1240 440" fill="none" stroke="#050b09" strokeWidth="8"/>
        {[144,1290].map((x,i)=><g key={i}><rect x={x-20} y="510" width="40" height="118" fill="#3c3429" stroke="#100d0b" strokeWidth="7"/><path d={"M"+(x-22)+" 510H"+(x+22)} stroke="#b1a492" strokeWidth="6"/><path d={"M"+x+" 507Q"+(x-24)+" 475 "+x+" 452Q"+(x+24)+" 477 "+x+" 507Z"} fill="#f9d1a0" opacity=".8" filter={"url(#bloom-"+uid+")"}/><path d={"M"+x+" 502Q"+(x-13)+" 480 "+x+" 462Q"+(x+13)+" 486 "+x+" 502Z"} fill="#fae6b3"/></g>)}
      </g>;
    case "romance":
      return <g>
        <path d="M0 230Q190 8 415 130M1440 230Q1250 8 1025 130" stroke="#69734b" strokeWidth="34" fill="none"/>
        <path d="M0 230Q190 8 415 130M1440 230Q1250 8 1025 130" stroke="#c0b092" strokeOpacity=".4" strokeWidth="3" fill="none"/>
        {[160,290,1120,1280].map((x,i)=><g key={i}><path d={"M"+x+" 100Q"+(x-34)+" 330 "+x+" 525"} stroke="#49704b" strokeWidth="6" fill="none"/>{[0,1,2,3,4].map(n=><g key={n} transform={"translate("+(x+Math.sin(n+i)*25)+" "+(155+n*73)+")"}><path d="M0 0q-23-30-35-2q24 27 35 2q14-29 35 0Q10 22 0 0" fill="#5b7751"/><circle r="11" fill={n%2?"#ed9eaf":"#c9567f"}/><circle r="5" fill="#ffcad2"/></g>)}</g>)}
        {[80,1360].map((x,i)=><g key={i}><path d={"M"+x+" 585v-105"} stroke="#b69871" strokeWidth="8"/><path d={"M"+(x-20)+" 480Q"+x+" 432 "+(x+20)+" 480Z"} fill="#ffde9f" opacity=".8" filter={"url(#bloom-"+uid+")"}/><path d={"M"+(x-23)+" 486H"+(x+23)+"L"+(x+14)+" 530H"+(x-14)+"Z"} fill="#f5b987" opacity=".7" stroke="#e3cba2" strokeWidth="3"/></g>)}
        {petals.map((pt,i)=><ellipse key={i} cx={pt.x} cy={pt.y} rx="4" ry="7" fill="#eba3af" opacity=".4" transform={"rotate("+(i*37)+" "+pt.x+" "+pt.y+")"}/>)}
      </g>;
    case "thriller":
      return <g>
        <rect x="1100" y="104" width="270" height="440" rx="4" fill="#071b25" stroke="#486271" strokeWidth="16"/>
        <rect x="1118" y="120" width="236" height="405" fill="#173d4d"/>
        <path d="M1235 120V525M1118 330H1354" stroke="#7396a2" strokeWidth="10"/>
        {RAIN.map((r,i)=><path key={i} d={"M"+(1090+r.x)+" "+(115+r.y)+" l-8 32"} stroke="#8dd8e9" strokeOpacity={i%3===0?".42":".24"} strokeWidth="2"/>)}
        <rect x="52" y="238" width="235" height="270" fill="#3d3027" stroke="#8b6850" strokeWidth="15"/>
        <path d="M92 275h92v74H92zM175 390h65v56h-65zM84 448h55v40H84z" fill="#c7baa0" stroke="#c9ab84" strokeWidth="5"/>
        <path d="M130 330 214 412 106 470 198 302" stroke="#ba645b" strokeWidth="3" fill="none"/>
        <circle cx="198" cy="302" r="7" fill="#d44e51"/><circle cx="214" cy="412" r="7" fill="#d44e51"/>
        <path d="M0 650 130 500 230 600" stroke="#2c4651" strokeWidth="55" opacity=".4" fill="none"/>
      </g>;
    case "comedy":
      return <g>
        <path d="M60 76Q150 162 255 76Q360 170 465 75Q710 184 965 75Q1080 158 1180 75Q1310 166 1390 76" stroke="#bf8343" strokeWidth="18" fill="none"/>
        {[120,230,1210,1325].map((x,i)=><g key={i}><path d={"M"+x+" 0v"+(190+i%2*54)} stroke="#d3a15e" strokeWidth="5"/><circle cx={x} cy={195+i%2*54} r="29" fill="#ffcb70" opacity=".23" filter={"url(#bloom-"+uid+")"}/><circle cx={x} cy={195+i%2*54} r="13" fill="#ffe3a1"/></g>)}
        <g transform="translate(112 310)"><path d="M-65-55Q0-90 65-55V50Q0 128-65 50Z" fill="#f8e2bc" stroke="#865d44" strokeWidth="7"/><path d="M-41-15Q-23-37-3-12M3-12Q23-38 41-15" stroke="#4e2b30" strokeWidth="8" fill="none"/><path d="M-35 42Q0 98 35 42" stroke="#ab4f4b" strokeWidth="7" fill="none"/></g>
        <g transform="translate(1310 310)"><path d="M-65-55Q0-90 65-55V50Q0 128-65 50Z" fill="#f8e2bc" stroke="#865d44" strokeWidth="7"/><path d="M-42-20L-7-9M7-9 42-20" stroke="#4e2b30" strokeWidth="7"/><path d="M-33 77Q0 28 33 77" stroke="#ab4f4b" strokeWidth="7" fill="none"/></g>
        {[0,1,2,3,4,5,6,7].map(n=><circle key={n} cx={365+n*100} cy="103" r="7" fill="#ffe4a6" filter={"url(#bloom-"+uid+")"}/>)}
      </g>;
    case "scifi":
      return <g>
        <path d="M270 84Q720-98 1170 84L1122 230Q720 60 318 230Z" fill="#040e1d" stroke="#398eac" strokeWidth="19"/>
        <path d="M310 133Q720-10 1130 133L1100 235Q720 98 340 235Z" fill="#07192e" stroke="#56c8e4" strokeWidth="5"/>
        {STARS.map((s,i)=><circle key={i} cx={s.x} cy={s.y} r={s.r} fill={i%3?"#d4efff":"#94d5ef"}/>)}
        <circle cx="1075" cy="157" r="71" fill="#397a92"/><path d="M1020 142Q1080 93 1120 142T1133 184Q1090 220 1030 177Z" fill="#57a4b2"/><ellipse cx="1075" cy="164" rx="113" ry="27" stroke="#a5dbe7" strokeOpacity=".7" strokeWidth="5" fill="none" transform="rotate(-21 1075 164)"/>
        <path d="M0 590H306L340 740H0Z M1440 590H1134L1100 740H1440Z" fill="#172d3b" stroke="#3a829b" strokeWidth="10"/>
        {[60,140,220,1220,1300,1380].map((x,i)=><g key={i}><rect x={x-25} y="618" width="50" height="21" rx="3" fill="#0a1824" stroke="#55b1cb" strokeWidth="3"/><path d={"M"+(x-17)+" 628h34"} stroke={i%3===0?"#e6ab79":"#8ee2e9"} strokeWidth="3"/></g>)}
        <path d="M520 895 652 606H788L920 895" fill="#163849" stroke="#63d7ed" strokeOpacity=".7" strokeWidth="5"/>
      </g>;
    case "fantasy":
      return <g>
        <path d="M280 240V162Q280 18 420 18H1020Q1160 18 1160 162V240" fill="none" stroke="#7f795e" strokeWidth="42"/>
        <path d="M292 238V164Q292 30 430 30H1010Q1148 30 1148 164V240" fill="none" stroke="#d0ba83" strokeOpacity=".7" strokeWidth="5"/>
        {[92,1260].map((x,i)=><g key={i}><path d={"M"+x+" 128h100v230h-100Z"} fill="#212f33" stroke="#867b61" strokeWidth="12"/><path d={"M"+(x+10)+" 144h80v180h-80Z"} fill="#35634d"/><path d={"M"+(x+50)+" 145v183M"+(x+10)+" 236h80"} stroke="#bf9e5d" strokeWidth="8"/><circle cx={x+50} cy="238" r="35" fill="#92ba8d" opacity=".35"/></g>)}
        {[72,1360].map((x,i)=><g key={i}><path d={"M"+x+" 280v128"} stroke="#957b53" strokeWidth="12"/><path d={"M"+x+" 295q-38-55 0-103q38 48 0 103"} fill="#ffb452" opacity=".75" filter={"url(#bloom-"+uid+")"}/><path d={"M"+x+" 274q-24-37 0-72q24 35 0 72"} fill="#ffe2a6"/></g>)}
        <path d="M140 0v420l52-42 52 42V0M1190 0v420l52-42 52 42V0" fill="#6e2636" stroke="#af8b64" strokeWidth="8"/>
        {[210,320,1120,1250].map((x,i)=><circle key={i} cx={x} cy={125+i%3*77} r="3" fill="#ffeaa9" opacity=".65"/>)}
      </g>;
    case "action":
      return <g>
        <path d="M0 85 1440 85M0 190 1440 190" stroke="#56636b" strokeWidth="27"/>
        {[110,330,560,850,1090,1340].map((x,i)=><path key={i} d={"M"+x+" 0l"+(i%2?110:-110)+" 200"} stroke="#283137" strokeWidth="30"/> )}
        <path d="M1100 240l108-32 61 30 75 11-8 24-65 5-45 46-21-3 10-52-116-9Z" fill="#10171a" stroke="#74828b" strokeWidth="3"/>
        <path d="M1160 211h130M1220 176v45" stroke="#6e7980" strokeWidth="6"/>
        <rect x="58" y="466" width="165" height="134" fill="#535044" stroke="#252b29" strokeWidth="15"/><path d="M75 487h125v25H75z" fill="#bb9545"/><path d="M70 575l120-83" stroke="#333632" strokeWidth="13"/>
        <rect x="1225" y="473" width="167" height="135" fill="#4b4b40" stroke="#272a29" strokeWidth="15"/><path d="M1240 496h120v25h-120z" fill="#bc924a"/><path d="M1240 586l120-84" stroke="#32372f" strokeWidth="13"/>
        <path d="M0 605l270 0M1170 605h270" stroke="#e9ad4d" strokeWidth="16" strokeDasharray="31 18"/>
        <path d="M315 103l-29 70 20-21 9 43 18-71" stroke="#f6a55d" strokeWidth="5" fill="none" filter={"url(#bloom-"+uid+")"}/>
      </g>;
    default:
      return <g>
        <path d="M55 120Q190 40 300 160M1385 120Q1250 40 1140 160" stroke="#9c334a" strokeWidth="36" fill="none"/>
        <path d="M55 120Q190 40 300 160M1385 120Q1250 40 1140 160" stroke="#f7c38a" strokeOpacity=".3" strokeWidth="3" fill="none"/>
        {[130,1300].map((x,i)=><g key={i}><path d={"M"+x+" 300v110"} stroke="#b38d5f" strokeWidth="10"/><ellipse cx={x} cy="285" rx="48" ry="61" fill="#ffe0aa" opacity=".2" filter={"url(#bloom-"+uid+")"}/><path d={"M"+x+" 265l25 30-25 30-25-30Z"} fill="#e6a75f" stroke="#f4d19d" strokeWidth="4"/><circle cx={x} cy="293" r="13" fill="#ffedba"/></g>)}
      </g>;
  }
}

export default function CinematicScenery({ theme="classic", mode="room" }) {
  const uid=useId().replace(/:/g,"");
  const p=LOOKS[theme] || LOOKS.classic;
  const screenId="screen-"+uid;
  return (
    <svg className={"cinematic-scenery cinematic-scenery--"+mode+" cinematic-scenery--"+theme}
      viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={"wall-"+uid} x2="0" y2="1"><stop stopColor={p.wall}/><stop offset=".62" stopColor={p.ceiling}/><stop offset="1" stopColor={p.wall}/></linearGradient>
        <linearGradient id={"floor-"+uid} x2="0" y2="1"><stop stopColor="#070b11"/><stop offset=".4" stopColor={p.floor}/><stop offset="1" stopColor="#08070a"/></linearGradient>
        <linearGradient id={"panel-"+uid} x2="1" y2=".2"><stop stopColor="#050a10"/><stop offset=".5" stopColor={p.wall}/><stop offset="1" stopColor="#07080c"/></linearGradient>
        <linearGradient id={"seat-"+uid} x2="1" y2=".5"><stop stopColor="#160f16"/><stop offset=".22" stopColor={p.seat}/><stop offset=".48" stopColor={p.seat}/><stop offset=".82" stopColor="#281620"/><stop offset="1" stopColor="#0d0c12"/></linearGradient>
        <linearGradient id={"seatSide-"+uid} x2="0" y2="1"><stop stopColor={p.seat}/><stop offset=".55" stopColor="#261820"/><stop offset="1" stopColor="#0c0a0d"/></linearGradient>
        <radialGradient id={"glow-"+uid}><stop stopColor={p.light} stopOpacity=".45"/><stop offset=".27" stopColor={p.light} stopOpacity=".15"/><stop offset="1" stopColor={p.light} stopOpacity="0"/></radialGradient>
        <linearGradient id={"projector-"+uid} x1=".5" y1="0" x2=".5" y2="1"><stop stopColor="#e2edf0" stopOpacity=".14"/><stop offset="1" stopColor="#e2edf0" stopOpacity="0"/></linearGradient>
        <filter id={"bloom-"+uid} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="14"/></filter>
        <filter id={"grain-"+uid} x="0" y="0" width="100%" height="100%"><feTurbulence baseFrequency=".38" numOctaves="2" seed="7" type="fractalNoise" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".06"/></feComponentTransfer></filter>
        <clipPath id={screenId}><rect x="330" y="193" width="780" height="385" rx="4"/></clipPath>
      </defs>
      <rect width="1440" height="900" fill={p.ceiling}/>
      <path d="M0 0H1440L1230 290H210Z" fill={"url(#wall-"+uid+")"}/>
      {[0,1,2,3,4].map(i=><path key={i} d={"M"+(210+i*260)+" 0L"+(282+i*202)+" 290"} stroke={p.trim} strokeOpacity=".18" strokeWidth="16"/>)}
      <path d="M0 0H220L372 651 0 900Z" fill={"url(#panel-"+uid+")"}/>
      <path d="M1440 0H1220L1068 651 1440 900Z" fill={"url(#panel-"+uid+")"}/>
      {[0,1,2].map(i=><g key={i} opacity=".55"><path d={"M"+(40+i*70)+" 85L"+(115+i*55)+" 630"} stroke={p.trim} strokeOpacity=".36" strokeWidth="10"/><path d={"M"+(1400-i*70)+" 85L"+(1325-i*55)+" 630"} stroke={p.trim} strokeOpacity=".36" strokeWidth="10"/></g>)}
      <rect x="273" y="135" width="894" height="503" rx="18" fill="#030609" stroke="#080a0c" strokeWidth="35"/>
      <rect x="288" y="145" width="864" height="479" rx="9" fill="#05070b" stroke={p.trim} strokeOpacity=".8" strokeWidth="9"/>
      <rect x="316" y="178" width="808" height="416" rx="4" fill="#070a0f" stroke="#19212a" strokeWidth="18"/>
      <g clipPath={"url(#"+screenId+")"}><rect x="330" y="193" width="780" height="385" fill="#080a0d"/><ellipse cx="720" cy="570" rx="370" ry="250" fill={"url(#glow-"+uid+")"} opacity=".36"/></g>
      <path d="M316 178h808" stroke="#f3e3cc" strokeOpacity=".17" strokeWidth="6"/>
      <path d="M316 590h808" stroke="#000" strokeWidth="16"/>
      <path d="M0 607Q720 550 1440 607V900H0Z" fill={"url(#floor-"+uid+")"}/>
      <path d="M382 600 0 900M1058 600 1440 900" stroke={p.trim} strokeOpacity=".18" strokeWidth="8"/>
      <path d="M660 620 510 900H930L780 620Z" fill="#10131b" opacity=".68"/>
      <path d="M675 633 560 900M765 633 880 900" stroke={p.light} strokeOpacity=".28" strokeWidth="4"/>
      <VenueProps theme={theme} uid={uid}/>
      {[175,1265].map((x,i)=><g key={i} className="cinematic-sconce">
        <ellipse cx={x} cy="420" rx="160" ry="220" fill={"url(#glow-"+uid+")"}/>
        <rect x={x-17} y="371" width="34" height="104" rx="8" fill={p.trim} opacity=".58" stroke="#07090c" strokeWidth="8"/>
        <ellipse cx={x} cy="405" rx="29" ry="47" fill={p.light} opacity=".18" filter={"url(#bloom-"+uid+")"}/>
        <path d={"M"+(x-22)+" 390Q"+x+" 360 "+(x+22)+" 390L"+x+" 434Z"} fill={p.light} opacity=".8"/>
      </g>)}
      <path d="M0 720Q720 700 1440 720" fill="none" stroke={p.trim} strokeOpacity=".13" strokeWidth="6"/>
      {[0,1,2].map(row=><g key={row} opacity={row===0?.63:row===1?.83:1}>
        {Array.from({length:13},(_,i)=>{
          const scale=.53+row*.2, span=100+row*19;
          return <Seat key={i} uid={uid} x={720+(i-6)*span} y={686+row*94} scale={scale}/>;
        })}
      </g>)}
      <path d="M0 0H1440V900H0Z" fill="white" opacity=".27" filter={"url(#grain-"+uid+")"}/>
      <path d="M0 0H1440V900H0Z" fill="none" stroke="#000" strokeWidth="80" opacity=".35"/>
      <ellipse cx="720" cy="790" rx="880" ry="650" fill={"url(#glow-"+uid+")"} opacity=".13"/>
    </svg>
  );
}

