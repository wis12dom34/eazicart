"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "./map.css";

type Place = { name:string; area:string; x:number; y:number; kind:string; distance:string };
const places: Place[] = [
  {name:"Nike Official",area:"Victoria Island",x:63,y:53,kind:"Fashion",distance:"1.2 km"},
  {name:"EaziMart",area:"Lekki Phase 1",x:75,y:39,kind:"Groceries",distance:"2.4 km"},
  {name:"TechHub NG",area:"Ikeja",x:38,y:27,kind:"Electronics",distance:"4.8 km"},
  {name:"HomeStyle NG",area:"Yaba",x:49,y:63,kind:"Home",distance:"3.1 km"},
];

export function ExploreMap(){
  const [selected,setSelected]=useState<Place|null>(places[0]);
  const [locating,setLocating]=useState(false);
  const [location,setLocation]=useState<{lat:number;lng:number}|null>(null);
  const [query,setQuery]=useState("");
  const [tilt,setTilt]=useState(true);
  const mapRef=useRef<HTMLDivElement>(null);

  const locate=()=>{
    if(!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      p=>{setLocation({lat:p.coords.latitude,lng:p.coords.longitude});setLocating(false)},
      ()=>setLocating(false),
      {enableHighAccuracy:true,timeout:10000,maximumAge:30000}
    );
  };
  useEffect(()=>{ /* Location remains opt-in; user taps the location button. */ },[]);
  const visible=places.filter(p=>(p.name+p.area+p.kind).toLowerCase().includes(query.toLowerCase()));

  return <main className="mapPage">
    <div ref={mapRef} className={`mapWorld ${tilt?"is3d":""}`}>
      <div className="water" />
      <div className="land" />
      <div className="road r1"/><div className="road r2"/><div className="road r3"/><div className="road r4"/>
      <div className="district d1">IKEJA</div><div className="district d2">YABA</div><div className="district d3">VICTORIA ISLAND</div><div className="district d4">LEKKI</div>
      {Array.from({length:34}).map((_,i)=><i key={i} className="building" style={{left:`${12+(i*17)%78}%`,top:`${16+(i*29)%64}%`,height:`${12+(i*11)%38}px`}}/>)}
      {visible.map(p=><button key={p.name} className={`pin ${selected?.name===p.name?"active":""}`} style={{left:`${p.x}%`,top:`${p.y}%`}} onClick={()=>setSelected(p)} aria-label={p.name}><span>●</span><b>{p.name}</b></button>)}
      <div className="you" style={{left:"55%",top:"46%"}}><i/><span>{location?"Your live location":"You"}</span></div>
      <div className="car car1">➤</div><div className="car car2">➤</div><div className="car car3">➤</div>
    </div>

    <header className="mapHeader">
      <Link href="/explore" className="round" aria-label="Back">‹</Link>
      <div className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search stores or places"/></div>
      <button className="round avatar">E</button>
    </header>

    <div className="chips"><button className="selected">Nearby</button><button>Stores</button><button>Food</button><button>Fashion</button><button>Electronics</button></div>
    <div className="controls"><button onClick={()=>setTilt(v=>!v)}>{tilt?"2D":"3D"}</button><button onClick={locate} aria-label="Use my location">{locating?"…":"⌖"}</button></div>
    <div className="liveBadge"><i/> LIVE COMMERCE</div>

    {selected && <section className="storeCard">
      <button className="close" onClick={()=>setSelected(null)}>×</button>
      <div className="storeIcon">{selected.name.slice(0,1)}</div>
      <div className="storeInfo"><div><strong>{selected.name}</strong><span className="verified">✓</span></div><p>{selected.kind} · {selected.area}</p><small>★ 4.9 &nbsp; · &nbsp; {selected.distance} away &nbsp; · &nbsp; Open</small></div>
      <Link href="/explore" className="shop">View store</Link>
    </section>}
    <nav className="mapBottom"><Link href="/">⌂<span>Home</span></Link><Link className="active" href="/explore">⌕<span>Explore</span></Link><Link href="/reels">▣<span>Reels</span></Link><Link href="/cart">▱<span>Cart</span></Link><Link href="/chat">◯<span>Chat</span></Link></nav>
  </main>;
}
