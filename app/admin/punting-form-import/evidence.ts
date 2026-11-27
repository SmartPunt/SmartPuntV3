import { translateMeeting } from './translate';
type Row = Record<string, unknown>;
function object(v: unknown): Row { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid evidence object'); return v as Row; }
function payload(row: Row | undefined, endpoint: string): {entries: Row[]; collected: string} | null {
 if (!row) return null;
 const d=object(typeof row.raw_response==='string'?JSON.parse(row.raw_response):row.raw_response);
 const time=new Date(String(row.saved_at_utc));
 if(row.endpoint!==endpoint || row.meeting_id!=null || d.statusCode!==200 || d.error || d.errors || !Array.isArray(d.payLoad) || !Number.isFinite(time.getTime())) throw new Error('Invalid '+endpoint+' snapshot');
 return {entries:d.payLoad.map(object),collected:time.toISOString()};
}
export function attachEvidence(p: ReturnType<typeof translateMeeting>, scratch?: Row, condition?: Row) {
 const mid=p.meeting.provider_meeting_id, date=p.meeting.meeting_date, track=p.meeting.meeting_name;
 const warnings:string[]=[];
 let rating:string|null=null, scratchTime:string|null=null, conditionTime:string|null=null, providerUpdate:string|null=null;
 try {
 const c=payload(condition,'conditions');
 if(c){conditionTime=c.collected; const matches=c.entries.filter(x=>String(x.meetingId)===mid);
 if(matches.length!==1) throw new Error('No unique meeting condition in latest snapshot');
 const x=matches[0]; if(String(x.meetingDate).slice(0,10)!==date||x.track!==track) throw new Error('Condition identity mismatch');
 if(x.abandonded!==false) throw new Error('Meeting abandoned or abandonment status unknown');
 const kind=String(x.trackCondition), num=String(x.trackConditionNumber);
 if(!['Good','Soft','Heavy','Synthetic','Firm'].includes(kind)) throw new Error('Unknown track rating');
 rating=kind+(/^[1-9]|10$/.test(num)&&/^(?:[1-9]|10)$/.test(num)?' '+num:'');
 providerUpdate=typeof x.lastUpdate==='string'?x.lastUpdate:null;
 } else warnings.push('No conditions snapshot available');
 } catch(e){warnings.push(e instanceof Error?e.message:'Invalid conditions evidence');}
 try {
 const a=payload(scratch,'scratchings');
 if(a){scratchTime=a.collected; const matched=new Set<string>(); const updates:Record<string,unknown>[]=[];
 for(const x of a.entries.filter(x=>String(x.meetingId)===mid)){
 const r=p.races.find(r=>r.race.provider_race_id===String(x.raceId));
 if(!r||x.track!==track||String(x.meetingDate)!==date.split('-').reverse().join('-')||Number(x.raceNo)!==r.race.race_number) {warnings.push('Unmatched scratching race or meeting identity');continue;}
 const groups=[[r.provenance,r.runners_json_preview],[r.emergency_provenance,r.emergency_runners_preview]];
 let found=false;
 for(const [prov,entries] of groups){const i=prov.findIndex(v=>String(v.provider_runner_id)===String(x.runnerId)&&Number(v.runner_number)===Number(x.tabNo)); if(i>=0){const key=String(x.raceId)+':'+String(x.runnerId); if(!matched.has(key)){matched.add(key);updates.push(entries[i]);}found=true;}}
 if(!found)warnings.push('Unmatched scratching runner '+String(x.runnerId));
 }
 for(const u of updates)u.scratching_status_preview='SCRATCHED (snapshot)';
 }else warnings.push('No scratchings snapshot available');
 }catch(e){warnings.push(e instanceof Error?e.message:'Invalid scratching evidence');}
 return {...p,meeting:{...p.meeting,track_condition:rating,scratchings_collected_utc:scratchTime,conditions_collected_utc:conditionTime,condition_provider_update:providerUpdate},blockers:[...p.blockers,...warnings]};
}
