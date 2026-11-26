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

function numeric(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  if (!s(v)) return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
}
function decimal(v: unknown, suffix = "") { const n = numeric(v); return n === null ? "—" : `${n.toFixed(2)}${suffix}`; }
function money(v: unknown) { const n = numeric(v); return n === null ? "—" : `$${n.toLocaleString("en-AU")}`; }
function stamp(v: unknown) { const d = new Date(s(v)); return Number.isNaN(d.getTime()) ? "Unavailable" : new Intl.DateTimeFormat("en-AU", {timeZone:"Australia/Perth", dateStyle:"medium", timeStyle:"short"}).format(d) + " Perth"; }
function evidenceText(v: unknown): string { if (v == null || v === "") return "—"; return typeof v === "object" ? JSON.stringify(v) : show(v); }
function Facts({items}:{items:[string,unknown][]}) { return <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{items.map(([label,value])=><div key={label} className="rounded-lg bg-black/30 p-2"><dt className="text-xs text-zinc-400">{label}</dt><dd className="break-words text-sm font-semibold">{evidenceText(value)}</dd></div>)}</dl>; }
function Table({headers,data}:{headers:string[];data:unknown[][]}) { return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{headers.map(h=><th key={h} className="whitespace-nowrap p-2 text-amber-200">{h}</th>)}</tr></thead><tbody>{data.map((r,i)=><tr key={i} className="border-t border-white/10">{r.map((v,j)=><td key={j} className="p-2">{evidenceText(v)}</td>)}</tr>)}</tbody></table></div>; }
function Section({title,children,initial=false}:{title:string;children:React.ReactNode;initial?:boolean}) { return <details open={initial || undefined} className="rounded-lg border border-white/10 bg-black/20"><summary className="cursor-pointer p-3 font-semibold text-amber-200">{title}</summary><div className="space-y-3 border-t border-white/10 p-3">{children}</div></details>; }
function recordLine(v:unknown) { const r=obj(v); return [r.starts,r.firsts,r.seconds,r.thirds].map(show).join(" / "); }
function rate(v:unknown,place=false) { const r=obj(v), n=numeric(r.starts), w=numeric(r.firsts), a=numeric(r.seconds), b=numeric(r.thirds); if(n===0)return "Untried"; if(n===null||n<0||w===null||(place&&(a===null||b===null)))return "—"; return decimal(100*(w+(place?(a!+b!):0))/n,"%"); }
function pairs(v:unknown) { return s(v).split(";").filter(Boolean).map(x=>x.replace(",",": ")).join(" · ") || "—"; }
type SavedFeed = { records: Row[]; freshness: string };
async function savedFeed(endpoint: "scratchings" | "conditions"): Promise<SavedFeed | undefined> {
  const snapshots = await v2Rows("api_response_snapshots", {select:"raw_response,request_started_utc",filters:{endpoint},order:"request_started_utc.desc,id.desc",limit:1});
  const snap = snapshots[0], raw = obj(snap?.raw_response);
  if (!snap || numeric(raw.statusCode)!==200 || !Array.isArray(raw.payLoad) || !s(snap.request_started_utc)) return undefined;
  return {records:rows(raw.payLoad),freshness:s(snap.request_started_utc)};
}
function evidenceDate(v:unknown) {
  const raw=s(v); if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw.slice(6)+"-"+raw.slice(3,5)+"-"+raw.slice(0,2);
  return raw.slice(0,10);
}
type RaceEvidence = { record: Row; runners: Row[]; freshness: string; updated: unknown };
async function savedResults(meeting: string, race: string, date: string): Promise<RaceEvidence | undefined> {
  const snapshots = await v2Rows("api_response_snapshots", {select:"raw_response,request_started_utc",filters:{endpoint:"results",meeting_id:meeting},order:"request_started_utc.desc,id.desc",limit:1});
  const snap=snapshots[0], raw=obj(snap?.raw_response);
  if (!snap || numeric(raw.statusCode)!==200 || !Array.isArray(raw.payLoad)) return undefined;
  const matches=rows(raw.payLoad).filter(m=>id(m.meetingId)===meeting && evidenceDate(m.meetingDate)===date);
  if(matches.length!==1) return undefined;
  const m=matches[0], races=rows(m.raceResults).filter(r=>id(r.raceId)===race);
  if(races.length!==1) return undefined;
  const record=races[0], resultRows=rows(record.runners);
  const ids=resultRows.map(r=>id(r.runnerId));
  if(!ids.length || ids.some(x=>!x) || new Set(ids).size!==ids.length) return undefined;
  return {record,runners:resultRows,freshness:s(snap.request_started_utc),updated:m.resultsUpdated};
}
function normalPosition(r:Row, count:number) { const n=numeric(r.position); return n!==null && Number.isInteger(n) && n>=1 && n<=count && n!==99 ? n : null; }
function RaceResults({evidence,field,failed,start}:{evidence:RaceEvidence|undefined;field:Row[];failed:boolean;start:unknown}) {
  const startMs=new Date(s(start)).getTime();
  const upcoming=Number.isFinite(startMs)&&startMs>Date.now();
  const resultRows=evidence?.runners??[];
  const placed=resultRows.filter(r=>normalPosition(r,resultRows.length)!==null).sort((a,b)=>Number(a.position)-Number(b.position));
  const unplaced=resultRows.filter(r=>normalPosition(r,resultRows.length)===null);
  const raceTime=s(evidence?.record.officialRaceTime);
  const hasTime=/^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raceTime)&&/[1-9]/.test(raceTime);
  const fieldIds=new Set(field.map(r=>id(r.runner_id)));
  const unknown=resultRows.filter(r=>!fieldIds.has(id(r.runnerId))).length;
  const missing=field.filter(r=>!resultRows.some(x=>id(x.runnerId)===id(r.runner_id))).length;
  return <section className={panel}><h2 className="mb-2 font-bold text-amber-200">Race results</h2>
  {failed?<p className="text-sm text-red-200">Results evidence could not be loaded.</p>:!placed.length?<p className="text-sm text-zinc-400">{upcoming?"Upcoming — no saved finishing positions":"Awaiting results — no usable saved finishing positions"}</p>:<><p className="mb-2 text-sm font-semibold text-amber-200">Provisional results — reconciliation not established</p>
  {(!hasTime||!placed.some(r=>numeric(r.position)===1)||unplaced.length>0||unknown>0)&&<p className="mb-2 text-xs text-amber-200">Incomplete or unusual results evidence — review required.</p>}
  <Facts items={[["Race time",hasTime?(evidence?.record.officialRaceTimeString??raceTime):"Unavailable"],["Result track condition",`${s(evidence?.record.trackConditionLabel)} ${s(evidence?.record.trackConditionNumber)}`.trim()],["Provider update",stamp(evidence?.updated)]]}/>
  <Table headers={["Finish","No.","Horse","SP (saved price)","Provider margin"]} data={[...placed,...unplaced].map(r=>[normalPosition(r,resultRows.length)??`Unconfirmed (${show(r.position)})`,r.tabNo,r.runner,(numeric(r.price)??0)>0?decimal(r.price):"—",r.margin])}/>
  {missing>0&&<p className="text-xs text-zinc-400">{missing} stored runners absent from this results snapshot; absence does not establish scratching status.</p>}
  {unknown>0&&<p className="text-xs text-amber-200">{unknown} result runners not matched to stored field.</p>}
  </>}
  {evidence&&<p className="mt-2 text-xs text-zinc-400">Results source: {stamp(evidence.freshness)} · Saved provider evidence only; not official finality or settlement.</p>}</section>;
}

function HorseProfile({record,form,freshness}:{record:Row|undefined;form:Row[];freshness:string}) {
 if(!record) return <p className="text-sm text-zinc-400">No matching saved horse profile available.</p>;
 const r=record;
 const suitability:[string,string][]=[["Track","trackRecord"],["Distance","distanceRecord"],["Track & distance","trackDistRecord"],["Firm","firmRecord"],["Good","goodRecord"],["Soft","softRecord"],["Heavy","heavyRecord"],["Synthetic","syntheticRecord"],["First-up","firstUpRecord"],["Second-up","secondUpRecord"],["Group 1","group1Record"],["Group 2","group2Record"],["Group 3","group3Record"]];
 const periods=[["Career","career"],["Last 12 months","last12Months"],["Last 50","last50"]];
 const runLabel=(f:Row)=>`${s(f.meetingDate).slice(0,10)} · ${show(obj(f.track).name)} · ${show(f.raceName)}${f.isBarrierTrial===true?" · Trial":""}`;
 return <div className="space-y-3"><h4 className="font-bold text-amber-200">Saved horse profile</h4><p className="text-xs text-zinc-400">Source request: {stamp(freshness)} · Provider snapshot, not live data</p>
 <Facts items={[["Career (starts / W / 2 / 3)",[r.careerStarts,r.careerWins,r.careerSeconds,r.careerThirds].map(show).join(" / ")],["Win rate",decimal(r.winPct,"%")],["Place rate",decimal(r.placePct,"%")],["Handicap rating",r.handicap]]}/>
 <Section title="Career & Suitability" initial><Facts items={[["Age",r.age],["Sex",r.sex],["Sire",r.sire],["Dam",r.dam],["Dam sire",r.sireofDam],["Prize money",money(r.prizeMoney)],["Preparation runs",r.prepRuns],["Snapshot barrier",r.barrier],["Original barrier",r.originalBarrier],["Snapshot jockey",obj(r.jockey).fullName],["Snapshot trainer",obj(r.trainer).fullName],["Snapshot weight (kg)",r.weight]]}/><Table headers={["Record","Starts / W / 2 / 3","Win %","Place %"]} data={suitability.map(([label,key])=>[label,recordLine(r[key]),rate(r[key]),rate(r[key],true)])}/><p className="text-xs text-zinc-400">Place rates count first, second and third; not race-specific betting terms. Snapshot barrier may differ from stored race field.</p></Section>
 <Section title={`Detailed Race History (${form.length} saved runs)`}><Table headers={["Date","Track","Race","Finish","Distance","Going","Margin","Jockey","Weight kg","Barrier","SP","Class"]} data={form.map(f=>[s(f.meetingDate).slice(0,10),obj(f.track).name,`${show(f.raceName)}${f.isBarrierTrial===true?" (Trial)":""}`,`${show(f.position)}/${show(f.starters)}`,f.distance,f.trackCondition,f.margin,obj(f.jockey).fullName,f.weight,f.barrier,decimal(f.priceSP),f.raceClass])}/>{form.map((f,i)=><details key={i} className="rounded border border-white/10 p-2"><summary className="cursor-pointer text-sm">{runLabel(f)}</summary><div className="mt-2"><Facts items={[["Prize money",money(f.prizeMoney)],["Official race time",f.officialRaceTime],["PF race time",f.pfRaceTime],["Rail",f.rail],["Weight allocated",f.weightAllocated],["Jockey claim",f.jockeyClaim],["Trainer",obj(f.trainer).fullName],["Weight type",f.weightType],["Preparation runs",f.prepRuns]]}/></div></details>)}</Section>
 <Section title="Jockey & Trainer">{[["Jockey", "jockeyStats"],["Trainer","trainerStats"]].map(([label,key])=><div key={key}><h5 className="mb-2 font-semibold">{label}: {show(obj(r[label.toLowerCase()]).fullName)}</h5><Table headers={["Period","Starts","Wins","Win %","Place %","ROI %"]} data={periods.map(([period,k])=>{const a=obj(obj(r[key])[k]);return [period,a.starts,a.wins,decimal(a.winPercent,"%"),decimal(a.placePercent,"%"),decimal(a.roiPercent,"%")];})}/></div>)}<h5 className="font-semibold">Provider A2E statistics</h5><Table headers={["Sample","Runners","Wins","Strike %","A2E","POT %"]} data={[["Jockey career","jockeyA2E_Career"],["Jockey last 100","jockeyA2E_Last100"],["Trainer career","trainerA2E_Career"],["Trainer last 100","trainerA2E_Last100"],["Combination career","trainerJockeyA2E_Career"],["Combination last 100","trainerJockeyA2E_Last100"]].map(([label,key])=>{const a=obj(r[key]);return [label,a.runners,a.wins,decimal(a.strikeRate,"%"),decimal(a.a2E),decimal(a.poT,"%")];})}/><p className="text-xs text-zinc-400">Provider statistics use different samples. Historical returns do not predict future returns.</p></Section>
 <Section title="Racing Patterns & Market"><Table headers={["Run","In-running positions","Fluctuations","SP","Betfair","TAB"]} data={form.map(f=>[runLabel(f),pairs(f.inRun),pairs(f.flucs),decimal(f.priceSP),decimal(f.priceBF),decimal(f.priceTAB)])}/></Section>
 <Section title="Additional Race Evidence"><Facts items={[["Snapshot gear changes",r.gearChanges]]}/>{form.map((f,i)=><details key={i} className="rounded border border-white/10 p-2"><summary className="cursor-pointer text-sm">{runLabel(f)}</summary><div className="mt-2 space-y-2"><Facts items={[["Gear changes",f.gearChanges],["Stewards report",f.stewardsReport],["Extended report",f.stewardsReportExt],["Sectional availability flag",f.hasSectionalData===true?"Yes — splits not shown":f.hasSectionalData===false?"No":"Unavailable"]]}/><Table headers={["Position","Horse","Weight kg"]} data={rows(f.top4Finishers).map(x=>[x.position,x.runnerName,x.weight])}/></div></details>)}</Section>
 {!form.length&&<p className="text-sm text-zinc-400">No saved historical runs for this profile.</p>}</div>;
}

export default async function RacingCentre({searchParams}:{searchParams?:Promise<Params>}) {
 const profile=await getCurrentProfile(); if(!profile) redirect("/login"); if(!isFullAdmin(profile)) redirect("/");
 const p=(await searchParams)??{}; const today=perthDate();
 const days=Array.from({length:5},(_,i)=>{const d=new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+i-1); return d.toISOString().slice(0,10);});
 const date=days.includes(s(p.date))?s(p.date):today;
 let meetings:Row[]=[], races:Row[]=[], runners:Row[]=[], form:Row[]=[], error=false;
 let meeting="", race="", runner="", freshness="";
 let horseProfile: Row | undefined;
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
   horseProfile=record;
   form=rows(record?.forms);
  }
 } catch { error=true; }
 let scratches: SavedFeed | undefined, conditions: SavedFeed | undefined;
 let evidenceError=false;
 if(meeting) {
   const feeds=await Promise.allSettled([savedFeed("scratchings"),savedFeed("conditions")]);
   if(feeds[0].status==="fulfilled") scratches=feeds[0].value; else evidenceError=true;
   if(feeds[1].status==="fulfilled") conditions=feeds[1].value; else evidenceError=true;
 }
 const conditionMatches=conditions?.records.filter(c=>id(c.meetingId)===meeting && evidenceDate(c.meetingDate)===date) ?? [];
 const condition=conditionMatches.length===1?conditionMatches[0]:undefined;
 const raceScratches=scratches?.records.filter(c=>id(c.meetingId)===meeting && id(c.raceId)===race && evidenceDate(c.meetingDate)===date) ?? [];
 const scratchIds=new Set(raceScratches.map(c=>id(c.runnerId)).filter(Boolean));
 const matchedCount=runners.filter(r=>scratchIds.has(id(r.runner_id))).length;
 const unmatchedCount=[...scratchIds].filter(rid=>!runners.some(r=>id(r.runner_id)===rid)).length;
 const selected=races.find(r=>id(r.race_id)===race);
 let resultEvidence: RaceEvidence | undefined, resultError=false;
 if(meeting && race && date<=today) { try { resultEvidence=await savedResults(meeting,race,date); } catch { resultError=true; } }
 return <main className="min-h-screen bg-neutral-950 p-3 text-white md:p-6"><div className="mx-auto max-w-6xl space-y-4">
 <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-amber-300">SMARTPUNT V2 · PRIVATE ADMIN</p><h1 className="text-2xl font-bold">Racing Centre</h1></div><Link href="/" className={button}>Dashboard</Link></header>
 <p className="text-xs text-zinc-400">Saved warehouse fields and latest saved update evidence · Perth times · Not a live or officially resulted feed</p>
 <nav className="grid grid-cols-5 gap-1 sm:gap-2">{days.map((d,i)=><Link key={d} href={href({date:d})} className={`rounded-lg px-1 py-2 text-center text-xs sm:text-sm ${date===d?"bg-amber-300 font-bold text-black":"bg-zinc-800"}`}>{i===0?"Yesterday":i===1?"Today":i===2?"Tomorrow":new Intl.DateTimeFormat("en-AU",{weekday:"short",timeZone:"UTC"}).format(new Date(d))}<span className="block text-xs">{d.slice(8)}/{d.slice(5,7)}</span></Link>)}</nav>
 {error&&<p className="rounded-lg bg-red-950 p-3 text-red-200">Some V2 data could not be loaded. Refresh or check the Data Explorer.</p>}
 <section className={panel}><h2 className="mb-2 font-bold text-amber-200">Meetings</h2><div className="flex flex-wrap gap-2">{meetings.map(m=><Link key={id(m.meeting_id)} href={href({date,meeting:id(m.meeting_id)})} className={`${button} ${meeting===id(m.meeting_id)?"bg-amber-300/20":""}`}>{show(m.track_name)} <span className="text-xs text-zinc-400">{show(m.state)}</span></Link>)}</div>{!meetings.length&&!error&&<p>No stored meetings for this date.</p>}</section>
 {meeting&&<section className={panel}><nav className="flex flex-wrap gap-2">{races.map(r=><Link key={id(r.race_id)} href={href({date,meeting,race:id(r.race_id)})} className={`${button} ${race===id(r.race_id)?"bg-amber-300/20":""}`}>R{show(r.race_number)}</Link>)}</nav>{selected&&<><h2 className="mt-4 text-xl font-bold">R{show(selected.race_number)} · {show(selected.race_name)}</h2><p className="text-sm text-zinc-400">{show(selected.distance_m)} m · {time(selected.start_time_utc)} Perth · {runners.length} stored runners</p></>}</section>}
 {meeting&&<section className={panel}><h2 className="mb-2 font-bold text-amber-200">Saved meeting conditions</h2>
 {evidenceError&&<p className="text-sm text-red-200">Some update evidence could not be loaded.</p>}
 {condition?<><div className="mb-3 flex flex-wrap items-center gap-3"><span className="rounded-lg bg-amber-300/15 px-3 py-2 font-bold text-amber-200">{show(condition.trackCondition)} {s(condition.trackConditionNumber)}</span><span>{show(condition.weather)}</span>{condition.abandonded===true&&<span className="font-bold text-red-300">ABANDONED — saved provider status</span>}</div><Facts items={[["Rail",condition.rail],["Rainfall",condition.rainfall],["Irrigation",condition.irrigation],["Penetrometer",condition.penetrometer],["Provider update",stamp(condition.lastUpdate)],["Abandoned",condition.abandonded===true?"Yes":condition.abandonded===false?"No":"Unknown"]]}/>{s(condition.comment)&&<p className="mt-2 text-xs text-zinc-300">{s(condition.comment)}</p>}</>:<p className="text-sm text-zinc-400">No unique matching meeting conditions in latest saved feed.</p>}
 <p className="mt-2 text-xs text-zinc-400">Conditions source: {conditions?stamp(conditions.freshness):"Unavailable"} · Meeting-level evidence only</p></section>}
 {race&&<RaceResults evidence={resultEvidence} field={runners} failed={resultError} start={selected?.start_time_utc}/>}
 {race&&<section className="space-y-2"><h2 className="font-bold text-amber-200">Stored race field</h2><div className="rounded-lg border border-white/10 p-3 text-xs text-zinc-300"><p>{scratches?`${matchedCount} stored runners listed scratched in latest saved feed`:"Scratching evidence unavailable"}</p><p>Scratchings source: {scratches?stamp(scratches.freshness):"Unavailable"} · Unlisted runners are not confirmed starters.</p>{unmatchedCount>0&&<p className="text-amber-200">{unmatchedCount} scratching IDs not in stored field.</p>}</div>{runners.map(r=>{const raw=obj(r.raw_record);const rid=id(r.runner_id);const scratched=scratchIds.has(rid);return <article key={rid} className={panel}><div className="flex items-start gap-3"><span className="text-xl font-bold text-amber-300">{show(r.tab_number)}</span><div className="min-w-0 flex-1"><h3 className={`font-bold ${scratched?"line-through text-zinc-500":""}`}>{show(r.horse_name)}</h3>{scratched&&<p className="text-xs font-bold text-red-300">SCRATCHED — saved evidence</p>}<p className="text-sm text-zinc-300">{show(obj(raw.jockey).fullName)} · {show(raw.weight)} kg · Barrier {show(r.barrier)}</p><p className="text-xs text-zinc-400">Trainer: {show(obj(raw.trainer).fullName)} · Form: {show(raw.last10)}</p></div><Link className={button} href={href({date,meeting,race,runner:runner===rid?"":rid})}>{runner===rid?"Close":"Form"}</Link></div>
 {runner===rid&&<div className="mt-4 border-t border-white/10 pt-3"><HorseProfile record={horseProfile} form={form} freshness={freshness}/></div>}
 </article>;})}{!runners.length&&!error&&<p>No stored runners.</p>}</section>}
 <Link href="/admin/v2-data-explorer" className={button}>Open technical Data Explorer</Link>
 </div></main>;
}
