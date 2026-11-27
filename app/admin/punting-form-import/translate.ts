type Row = Record<string, any>;
function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const s = (v: unknown) => v == null ? '' : String(v);
const raw = (r: Row): Row => typeof r.raw_record === 'string' ? JSON.parse(r.raw_record) : r.raw_record;
function record(v: any) { if(v == null) return ''; const a = [v.starts,v.firsts,v.seconds,v.thirds]; check(a.every(x=>Number.isInteger(x)&&x>=0)&&a[1]+a[2]+a[3]<=a[0],'Invalid statistical record'); return `${a[0]}:${a.slice(1).join(',')}`; }
export function translateMeeting(m: Row, races: Row[], runners: Row[]) {
 const d=raw(m), t=d.track, mid=s(m.meeting_id), date=m.meeting_date instanceof Date ? m.meeting_date.toISOString().slice(0,10) : s(m.meeting_date).slice(0,10);
 check(s(d.meetingId)===mid && s(d.meetingDate).slice(0,10)===date && s(t.trackId)===s(m.track_id)&&t.name===m.track_name&&t.state===m.state&&t.country===m.country,'Meeting identity mismatch');
 const ids=new Set(races.map(r=>s(r.race_id))); check(races.length>0&&races.length<=50&&ids.size===races.length&&new Set(races.map(r=>Number(r.race_number))).size===races.length&&races.every(r=>s(r.meeting_id)===mid)&&runners.every(u=>ids.has(s(u.race_id))),'Duplicate or foreign race/runner');
 const horses=new Map<string,string>();
 const previews=races.slice().sort((a,b)=>Number(a.race_number)-Number(b.race_number)).map(r=>{
 const x=raw(r), rid=s(r.race_id), start=new Date(r.start_time_utc); check(s(x.raceId)===rid&&x.number===Number(r.race_number)&&x.distance===Number(r.distance_m)&&Number.isFinite(start.getTime()),'Race identity or time mismatch');
 const ordinary:Row[]=[], emergency:Row[]=[], provenance:Row[]=[], emergencyProvenance:Row[]=[], warnings:string[]=[]; const seen=[new Set<string>(),new Set<string>(),new Set<string>(),new Set<string>()];
 const entries=runners.filter(u=>s(u.race_id)===rid).sort((a,b)=>Number(a.tab_number)-Number(b.tab_number)); check(entries.length>0&&entries.length<=100,'Invalid runner count');
 for(const u of entries){ const v=raw(u), name=v.name, n=Number(u.tab_number), b=Number(u.barrier), id=s(u.runner_id); check(typeof name==='string'&&name.trim()&&s(v.raceId)===rid&&s(v.runnerId)===id&&name===u.horse_name&&n===v.tabNo&&b===v.barrier&&Number.isInteger(n)&&n>0&&Number.isInteger(b)&&b>0, 'Runner identity mismatch');
 [id,s(n),s(b),name.toLowerCase().trim().replace(/\s+/g,' ')].forEach((k,i)=>{if(seen[i].has(k)){if(i===2) warnings.push(`${name}: duplicate barrier ${b}; unresolved, import blocked`); else throw new Error(`${name}: duplicate identity or number`);} seen[i].add(k);});
 check(v.emergencyIndicator===true||v.emergencyIndicator===false,`${name}: unsupported runner status`); check(!horses.has(id)||horses.get(id)===name,'Conflicting provider horse identity'); horses.set(id,name);
 const f=(v.last10||'').trim(); check(/^[0-9xX\s]*$/.test(f),'Unsupported form'); const form=f.replace(/[^0-9]/g,''); check(Number.isInteger(v.careerStarts)&&form.length<=v.careerStarts,'Invalid career starts');
 const [w,c,a]=['weightAllocated','jockeyClaim','weight'].map(k=>{check(v[k]!=null&&s(v[k]).trim()!=='','Missing weight');return Number(v[k]);}); check(Number.isFinite(w)&&Number.isFinite(c)&&Number.isFinite(a)&&w>0&&c>=0&&Math.abs(w-c-a)<1e-8,'Weight reconciliation failed');
 const j=v.jockey||{}, tr=v.trainer||{}; const unallocated=s(j.jockeyId)==='0'&&['','null'].includes(s(u.jockey_id))&&!(j.fullName||'').trim()&&!(j.name||'').trim()&&c===0; check((unallocated||s(j.jockeyId)===s(u.jockey_id))&&s(tr.trainerId)===s(u.trainer_id),'Jockey/trainer mismatch'); if(unallocated) warnings.push(`${name}: jockey unallocated`);
 const p:Row={horse_name:name,runner_number:n,barrier:s(b),weight_kg:s(w),apprentice_claim_kg:s(c),is_apprentice:!!j.isApprentice,jockey_name:(j.fullName||j.name||'').trim(),trainer_name:tr.fullName||tr.name||'',form_last_6:f.replace(/\s+/g,''),recent_finishes_preview:form.slice(-6),scratching_status_preview:'UNVERIFIED',market_price:'',prize_money:s(v.prizeMoney)};
 for(const [dest,src] of Object.entries({track_form_last_6:'trackRecord',distance_form_last_6:'distanceRecord',good_track_record:'goodRecord',soft_track_record:'softRecord',heavy_track_record:'heavyRecord',synthetic_track_record:'syntheticRecord'})){p[dest]=record(v[src]);if(!p[dest])warnings.push(`${name}: missing ${src}`);}
 const prov={runner_number:n,provider_runner_id:id,provider_jockey_id:s(u.jockey_id),provider_trainer_id:s(u.trainer_id),career_starts:v.careerStarts,effective_weight_kg:s(a),source_file_id:s(u.source_file_id)}; (v.emergencyIndicator?emergency:ordinary).push(p); (v.emergencyIndicator?emergencyProvenance:provenance).push(prov);
 }
 return {race:{provider_race_id:rid,provider_meeting_id:mid,race_number:Number(r.race_number),race_name:r.race_name,distance_m:Number(r.distance_m),start_time_utc:start.toISOString(),source_file_id:s(r.source_file_id)},runners_json_preview:ordinary,emergency_runners_preview:emergency,provenance,emergency_provenance:emergencyProvenance,warnings};
 });
 const ordinary=previews.reduce((n,r)=>n+r.runners_json_preview.length,0), emergency=previews.reduce((n,r)=>n+r.emergency_runners_preview.length,0); check(ordinary+emergency===runners.length,'Runner count mismatch');
 return {mode:'OFFLINE_MEETING_PREVIEW',import_ready:false,meeting:{provider_meeting_id:mid,meeting_name:m.track_name,meeting_date:date,track_condition:null},races:previews,counts:{races:previews.length,ordinary_entries:ordinary,emergency_entries:emergency},blockers:['Live scratching and emergency promotion status not verified','Track condition and place terms not verified','V1 horse identity and distance record semantics not verified','V1 importer and calculator not executed','Source completeness not independently verified']};
}
