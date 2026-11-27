import { redirect } from 'next/navigation';
import { getCurrentProfile, isRacingOpsAdmin } from '@/lib/auth';
import { v2Rows } from '@/lib/v2-explorer';
import MeetingPreview from './meeting-preview';
import { translateMeeting } from './translate';
export const dynamic = 'force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{meeting?:string}>}) {
 const profile=await getCurrentProfile(); if(!profile) redirect('/login'); if(!isRacingOpsAdmin(profile)) redirect('/');
 const p=await searchParams; const selected=typeof p.meeting==='string'?p.meeting:'';
 const dates=Array.from({length:5},(_,i)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Perth',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+i*86400000)));
 let options:{id:string;label:string}[]=[], preview:unknown=null, error='';
 try {
 for(const date of dates){const ms=await v2Rows('meetings',{select:'meeting_id,meeting_date,track_name,state',filters:{meeting_date:date},order:'meeting_id.asc',limit:100}); if(ms.length===100) throw new Error('Meeting list limit reached'); options.push(...ms.map(m=>({id:String(m.meeting_id),label:`${date} · ${m.track_name} (${m.state})` })));}
 if(selected){if(!/^\d{1,18}$/.test(selected)||!options.some(m=>m.id===selected)) throw new Error('Meeting outside available date range'); const ms=await v2Rows('meetings',{filters:{meeting_id:selected},limit:2}); if(ms.length!==1) throw new Error('Meeting identity mismatch'); const races=await v2Rows('races',{filters:{meeting_id:selected},order:'race_number.asc',limit:51}); if(races.length>50) throw new Error('Race limit reached'); const runners=[]; for(const r of races){const entries=await v2Rows('runners',{filters:{race_id:String(r.race_id)},order:'tab_number.asc',limit:100}); if(entries.length===100) throw new Error('Runner limit reached'); runners.push(...entries);} preview=translateMeeting(ms[0],races,runners); }
 } catch(e){console.error('Punting Form preview failed',e);error='Unable to load or validate V2 meeting. Check Vercel logs for details.';}
 return <MeetingPreview key={selected} initialPreview={preview} options={options} selected={selected} serverError={error}/>;
}
