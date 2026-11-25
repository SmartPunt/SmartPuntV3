import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile, isFullAdmin } from "@/lib/auth";
import { v2Rows } from "@/lib/v2-explorer";

export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;
type Params = { date?: string; meeting?: string; race?: string; runner?: string };
const obj = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const rows = (v: unknown): Row[] => Array.isArray(v) ? v.map(obj) : [];
const s = (v: unknown) => v == null ? "" : String(v).trim();
const show = (v: unknown) => s(v) || "—";
const id = (v: unknown) => /^\d{1,18}$/.test(s(v)) ? s(v) : "";
const panel = "rounded-xl border border-white/10 bg-zinc-900 p-4";
const button = "rounded-lg border border-amber-300/30 px-3 py-2 text-sm text-amber-200";
function href(p: Params) { const q = new URLSearchParams(); for (const [k,v] of Object.entries(p)) if(v) q.set(k,v); return `/admin/v2-racing-centre?${q}`; }
function perthDate() { const p = new Intl.DateTimeFormat("en-CA", {timeZone:"Australia/Perth",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()); return ["year","month","day"].map(k=>p.find(x=>x.type===k)?.value).join("-"); }
function time(v: unknown) { const raw=s(v); if(!raw) return "—"; const d=new Date(raw); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Perth",hour:"numeric",minute:"2-digit"}).format(d); }
export default async function RacingCentre({searchParams}:{searchParams?:Promise<Params>}) {
 const profile=await getCurrentProfile(); if(!profile) redirect("/login"); if(!isFullAdmin(profile)) redirect("/");
 const p=(await searchParams)??{}; const today=perthDate();
 const days=Array.from({length:4},(_,i)=>{const d=new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+i); return d.toISOString().slice(0,10);});
 const date=days.includes(s(p.date))?s(p.date):today;
 let meetings:Row[]=[], races:Row[]=[], runners:Row[]=[], form:Row[]=[], error=false;
 let meeting="", race="", runner="", freshness="";
 try {
  meetings=await v2Rows("meetings",{select:"meeting_id,meeting_date,track_name,state,country",filters:{meeting_date:date},order:"track_name.asc,meeting_id.asc",limit:100});
  meeting=id(meetings.find(m=>id(m.meeting_id)===id(p.meeting))?.meeting_id ?? meetings[0]?.meeting_id);
  if(meeting) races=await v2Rows("races",{select:"race_id,race_number,race_name,distance_m,start_time_utc",filters:{meeting_id:meeting},order:"race_number.asc",limit:30});
  race=id(races.find(r=>id(r.race_id)===id(p.race))?.race_id ?? races[0]?.race_id);
  if(race) runners=await v2Rows("runners",{filters:{race_id:race},order:"tab_number.asc",limit:100});
  runner=id(runners.find(r=>id(r.runner_id)===id(p.runner))?.runner_id);
  if(meeting && runner) {
   const snapshots=await v2Rows("api_response_snapshots",{select:"raw_response,request_started_utc",filters:{meeting_id:meeting,endpoint:"form"},order:"request_started_utc.desc,id.desc",limit:1});
   const snap=snapshots[0]; freshness=s(snap?.request_started_utc);
   const record=rows(obj(snap?.raw_response).payLoad).find(r=>id(r.runnerId)===runner && id(r.raceId)===race);
   form=rows(record?.forms);
  }
 } catch { error=true; }
 const selected=races.find(r=>id(r.race_id)===race);
 return <main className="min-h-screen bg-neutral-950 p-3 text-white md:p-6"><div className="mx-auto max-w-6xl space-y-4">
 <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-amber-300">SMARTPUNT V2 · PRIVATE ADMIN</p><h1 className="text-2xl font-bold">Racing Centre</h1></div><Link href="/" className={button}>Dashboard</Link></header>
 <p className="text-xs text-zinc-400">Saved warehouse fields · Perth times · Not a live or officially resulted feed</p>
 <nav className="grid grid-cols-4 gap-2">{days.map((d,i)=><Link key={d} href={href({date:d})} className={`rounded-lg p-2 text-center text-sm ${date===d?"bg-amber-300 font-bold text-black":"bg-zinc-800"}`}>{i===0?"Today":i===1?"Tomorrow":new Intl.DateTimeFormat("en-AU",{weekday:"short",timeZone:"UTC"}).format(new Date(d))}<span className="block text-xs">{d.slice(8)}/{d.slice(5,7)}</span></Link>)}</nav>
 {error&&<p className="rounded-lg bg-red-950 p-3 text-red-200">Some V2 data could not be loaded. Refresh or check the Data Explorer.</p>}
 <section className={panel}><h2 className="mb-2 font-bold text-amber-200">Meetings</h2><div className="flex flex-wrap gap-2">{meetings.map(m=><Link key={id(m.meeting_id)} href={href({date,meeting:id(m.meeting_id)})} className={`${button} ${meeting===id(m.meeting_id)?"bg-amber-300/20":""}`}>{show(m.track_name)} <span className="text-xs text-zinc-400">{show(m.state)}</span></Link>)}</div>{!meetings.length&&!error&&<p>No stored meetings for this date.</p>}</section>
 {meeting&&<section className={panel}><nav className="flex flex-wrap gap-2">{races.map(r=><Link key={id(r.race_id)} href={href({date,meeting,race:id(r.race_id)})} className={`${button} ${race===id(r.race_id)?"bg-amber-300/20":""}`}>R{show(r.race_number)}</Link>)}</nav>{selected&&<><h2 className="mt-4 text-xl font-bold">R{show(selected.race_number)} · {show(selected.race_name)}</h2><p className="text-sm text-zinc-400">{show(selected.distance_m)} m · {time(selected.start_time_utc)} Perth · {runners.length} stored runners</p></>}</section>}
 {race&&<section className="space-y-2"><h2 className="font-bold text-amber-200">Stored race field</h2>{runners.map(r=>{const raw=obj(r.raw_record);const rid=id(r.runner_id);return <article key={rid} className={panel}><div className="flex items-start gap-3"><span className="text-xl font-bold text-amber-300">{show(r.tab_number)}</span><div className="min-w-0 flex-1"><h3 className="font-bold">{show(r.horse_name)}</h3><p className="text-sm text-zinc-300">{show(obj(raw.jockey).fullName)} · {show(raw.weight)} kg · Barrier {show(r.barrier)}</p><p className="text-xs text-zinc-400">Trainer: {show(obj(raw.trainer).fullName)} · Form: {show(raw.last10)}</p></div><Link className={button} href={href({date,meeting,race,runner:runner===rid?"":rid})}>{runner===rid?"Close":"Form"}</Link></div>
 {runner===rid&&<div className="mt-4 border-t border-white/10 pt-3"><h4 className="font-semibold">Saved form history</h4><p className="text-xs text-zinc-400">{freshness?`Source request: ${freshness} (UTC source timestamp)`:"No form snapshot timestamp available"}</p>{!form.length&&<p className="mt-2 text-sm text-zinc-400">No matching saved form runs available.</p>}{form.length>0&&<div className="overflow-x-auto"><table className="mt-2 w-full text-left text-xs"><thead><tr>{["Date","Track","Race","Finish","Distance","Going","Margin"].map(h=><th key={h} className="p-2 text-amber-200">{h}</th>)}</tr></thead><tbody>{form.map((f,i)=><tr key={i} className="border-t border-white/10">{[s(f.meetingDate).slice(0,10),obj(f.track).name,f.raceName,`${show(f.position)}/${show(f.starters)}`,f.distance,f.trackCondition,f.margin].map((v,j)=><td key={j} className="p-2">{show(v)}</td>)}</tr>)}</tbody></table></div>}</div>}
 </article>;})}{!runners.length&&!error&&<p>No stored runners.</p>}</section>}
 <Link href="/admin/v2-data-explorer" className={button}>Open technical Data Explorer</Link>
 </div></main>;
}
