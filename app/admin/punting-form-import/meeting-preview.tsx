"use client";
import Link from "next/link";
import { useState } from "react";
import { validatePuntingFormMeeting } from "./import-actions";

type Row = Record<string, unknown>;
function row(v: unknown): Row {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid preview object");
  return v as Row;
}
function rows(v: unknown): Row[] {
  if (!Array.isArray(v)) throw new Error("Missing preview rows");
  return v.map(row);
}
function text(v: unknown): string { if(typeof v === "boolean") return v ? "Yes" : "No"; return typeof v === "string" || typeof v === "number" ? String(v) : "—"; }
function messages(v: unknown): string[] { return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; }
type Preview = { meeting: Row; races: { race: Row; ordinary: Row[]; emergency: Row[]; warnings: string[] }[]; blockers: string[] };
function parse(v: unknown): Preview {
  const p = row(v);
  if (p.mode !== "OFFLINE_MEETING_PREVIEW" || p.import_ready !== false) throw new Error("Select a Stage 2 offline meeting preview.");
  const meeting = row(p.meeting);
  const races = rows(p.races).map(r => ({ race: row(r.race), ordinary: rows(r.runners_json_preview), emergency: rows(r.emergency_runners_preview), warnings: messages(r.warnings) }));
  if (!races.length || races.length > 50) throw new Error("Invalid race count");
  const ids = new Set<string>();
  for (const r of races) {
    const id = text(r.race.provider_race_id);
    if (id === "—" || ids.has(id) || text(r.race.provider_meeting_id) !== text(meeting.provider_meeting_id)) throw new Error("Race identity mismatch");
    ids.add(id);
    if (r.ordinary.length + r.emergency.length > 100) throw new Error("Invalid runner count");
  }
  const counts = row(p.counts);
  if (counts.races !== races.length || counts.ordinary_entries !== races.reduce((n,r)=>n+r.ordinary.length,0) || counts.emergency_entries !== races.reduce((n,r)=>n+r.emergency.length,0)) throw new Error("Preview counts do not reconcile");
  return { meeting, races, blockers: messages(p.blockers) };
}
export default function MeetingPreview({initialPreview, options, selected, serverError}: {initialPreview: unknown; options: {id:string;label:string}[]; selected:string; serverError:string}) {
  const [preview, setPreview] = useState<Preview | null>(() => initialPreview ? parse(initialPreview) : null);
const [error, setError] = useState("");
const [validating, setValidating] = useState(false);
const [validationResult, setValidationResult] = useState("");
const [validationError, setValidationError] = useState("");

async function handleValidateMeeting() {
  if (!selected || validating) return;

  setValidating(true);
  setValidationResult("");
  setValidationError("");

  try {
    const response = await validatePuntingFormMeeting(selected);

    if (response.success) {
      setValidationResult(
        JSON.stringify(response.result, null, 2)
      );
    } else {
      setValidationError(
        response.error || "Validation failed"
      );
    }
  } catch {
    setValidationError("Unable to validate meeting");
  } finally {
    setValidating(false);
  }
}
  return <main className="min-h-screen bg-zinc-950 p-4 text-white lg:p-8"><div className="mx-auto max-w-6xl space-y-5">
    <Link href="/admin/race-builder" className="text-sm text-amber-300">Back to Race Builder</Link>
    <h1 className="text-2xl font-bold text-amber-200">Import from Punting Form</h1>
    <p className="text-sm text-zinc-300">Stage 3E.2 — meeting validation · Read-only validation against SmartPunt V1. No race imports or publishing.</p>
    <form method="get" className="rounded-xl border border-white/15 p-4 space-y-3"><label className="block">Select V2 meeting (today + four days)<select name="meeting" defaultValue={selected} className="mt-2 block w-full rounded bg-zinc-800 p-3"><option value="">Choose meeting</option>{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label><button className="rounded bg-amber-300 px-4 py-2 font-semibold text-black">Load preview</button>{!options.length && <p>No available meetings.</p>}</form>
    {serverError && <p role="alert" className="text-red-300">{serverError}</p>}
    <label className="block rounded-xl border border-white/15 p-4">Select meeting_preview.json (legacy offline preview; form may be truncated)<input className="mt-3 block w-full text-sm" type="file" accept=".json,application/json" onChange={async e => { const file = e.target.files?.[0]; setPreview(null); setError(""); if (!file) return; try { if(file.size > 5_000_000) throw new Error("File exceeds 5 MB"); setPreview(parse(JSON.parse(await file.text()))); } catch(err) { setError(err instanceof Error ? err.message : "Invalid preview"); } }} /></label>
{error && <p role="alert" className="text-red-300">{error}</p>}

{selected && initialPreview != null && (
  <section className="rounded-xl border border-amber-300/30 p-4 space-y-3">
    <h2 className="text-lg font-semibold text-amber-200">
      SmartPunt V1 Import Validation
    </h2>

    <p className="text-sm text-zinc-300">
      Validate the selected V2 meeting against existing
      SmartPunt races and runners. No records will be created.
    </p>

    <button
      type="button"
      disabled={validating}
      onClick={handleValidateMeeting}
      className="rounded bg-amber-300 px-4 py-2 font-semibold text-black disabled:opacity-50"
    >
      {validating ? "Validating meeting..." : "Validate V1 meeting"}
    </button>

    {validationResult && (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <p className="font-semibold text-emerald-300">
          Validation successful
        </p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-sm">
          {validationResult}
        </pre>
      </div>
    )}

    {validationError && (
      <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300">
        {validationError}
      </div>
    )}
  </section>
)}
    {preview && <><section className="rounded-xl border border-amber-300/30 p-4"><h2 className="text-xl font-semibold">{text(preview.meeting.meeting_name)} · {text(preview.meeting.meeting_date)}</h2><p>{preview.races.length} races · {preview.races.reduce((n,r)=>n+r.ordinary.length,0)} ordinary · {preview.races.reduce((n,r)=>n+r.emergency.length,0)} emergencies</p><p>Track condition (stored evidence): {text(preview.meeting.track_condition)}</p><p className="text-sm">Conditions collected (UTC): {text(preview.meeting.conditions_collected_utc)}</p><p className="text-sm">Provider condition update: {text(preview.meeting.condition_provider_update)}</p><p className="text-sm">Scratchings collected (UTC): {text(preview.meeting.scratchings_collected_utc)}</p><p className="text-sm">Unverified entries are not confirmed starters. Evidence may be stale.</p><p className="mt-2 font-semibold text-amber-300">NOT IMPORT READY</p>{preview.blockers.map((b,i)=><p key={i} className="text-sm text-zinc-300">{b}</p>)}</section>
    {preview.races.map(r=><details key={text(r.race.provider_race_id)} className="rounded-xl border border-white/15 p-4"><summary className="cursor-pointer font-semibold">Race {text(r.race.race_number)} · {text(r.race.distance_m)}m · {r.ordinary.length} ordinary / {r.emergency.length} emergencies</summary><p className="mt-2 text-sm">{text(r.race.race_name)} · UTC {text(r.race.start_time_utc)}</p>{r.warnings.map((w,i)=><p key={i} className="text-sm text-amber-300">{w}</p>)}{[ {label:"Ordinary entries", entries:r.ordinary}, {label:"Emergencies — not confirmed starters",entries:r.emergency} ].map(group=><div key={group.label} className="mt-4 overflow-x-auto"><h3 className="font-semibold">{group.label}</h3><table className="w-full text-left text-sm"><thead><tr>{["No.","Horse","Barrier","Weight","Claim","Apprentice","Jockey","Trainer","Prize money","Form (source)","Scratchings","Track","Distance","Good","Soft","Heavy","Synthetic"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{group.entries.map((runner,i)=><tr key={i} className="border-t border-white/10">{["runner_number","horse_name","barrier","weight_kg","apprentice_claim_kg","is_apprentice","jockey_name","trainer_name","prize_money","form_last_6","scratching_status_preview","track_form_last_6","distance_form_last_6","good_track_record","soft_track_record","heavy_track_record","synthetic_track_record"].map(k=><td key={k} className="whitespace-nowrap p-2">{text(runner[k])}</td>)}</tr>)}</tbody></table></div>)}</details>)}
    </>}
  </div></main>;
}
