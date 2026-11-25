import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile, isFullAdmin } from "@/lib/auth";
import { v2Rows } from "@/lib/v2-explorer";

export const dynamic = "force-dynamic";

type Params = { tab?: string; date?: string; meeting?: string; race?: string; runner?: string; snapshot?: string; page?: string };
type Row = Record<string, unknown>;

function val(row: Row, key: string): string { return String(row[key] ?? "—"); }
function str(value: unknown): string { return value == null ? "" : String(value); }
function safeId(value: string | undefined): string { return value && /^\d{1,18}$/.test(value) ? value : ""; }
function safeDate(value: string | undefined): string { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""; }
function qs(base: Params, patch: Params) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...base, ...patch })) if (value) params.set(key, value);
  return `/admin/v2-data-explorer?${params.toString()}`;
}
function JsonView({ label, data }: { label: string; data: unknown }) {
  return <details className="rounded-xl border border-white/15 bg-black/40 p-3">
    <summary className="cursor-pointer font-semibold text-amber-200">{label}</summary>
    <pre className="mt-3 max-h-[600px] overflow-auto whitespace-pre-wrap break-all text-xs text-zinc-200">{JSON.stringify(data, null, 2) ?? "No data"}</pre>
  </details>;
}
function DataTable({ rows, columns }: { rows: Row[]; columns: { key: string; label: string }[] }) {
  return <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-sm">
    <thead className="bg-white/10 text-amber-200"><tr>{columns.map(c => <th key={c.key} className="p-3">{c.label}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-white/10">{columns.map(c => <td key={c.key} className="p-3">{val(r,c.key)}</td>)}</tr>)}</tbody>
  </table></div>;
}

export default async function V2DataExplorer({ searchParams }: { searchParams?: Promise<Params> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isFullAdmin(profile)) redirect("/");

  const p = (await searchParams) ?? {};
  const tab = p.tab === "api" ? "api" : "races";
  const date = safeDate(p.date);
  const meeting = safeId(p.meeting);
  const race = safeId(p.race);
  const runner = safeId(p.runner);
  const snapshot = safeId(p.snapshot);
  const page = Math.min(Math.max(Number.parseInt(p.page ?? "0", 10) || 0, 0), 1000);
  const base: Params = { tab, date, meeting, race, runner, snapshot };
  const box = "rounded-2xl border border-white/10 bg-zinc-900/80 p-5";
  const link = "inline-block rounded-xl border border-amber-300/30 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-300/10";

  let meetings: Row[] = [], races: Row[] = [], runners: Row[] = [], results: Row[] = [], raceResult: Row[] = [];
  let snapshots: Row[] = [], runs: Row[] = [], chosenSnapshot: Row | null = null;
  let error = "";
  try {
    if (tab === "races") {
      meetings = await v2Rows("meetings", { select: "meeting_id,meeting_date,track_name,state,country", filters: date ? { meeting_date: date } : {}, order: "meeting_date.desc,meeting_id.desc", limit: 50, offset: page * 50 });
      if (meeting) races = await v2Rows("races", { filters: { meeting_id: meeting }, order: "race_number.asc", limit: 30 });
      if (race) {
        [runners, raceResult] = await Promise.all([
          v2Rows("runners", { filters: { race_id: race }, order: "tab_number.asc", limit: 100 }),
          v2Rows("race_results", { filters: { race_id: race }, limit: 1 }),
        ]);
        results = await v2Rows("runner_results", { filters: { race_id: race }, limit: 100 });
      }
    } else {
      [snapshots, runs] = await Promise.all([
        v2Rows("api_response_snapshots", { select: "id,collection_run_id,endpoint,meeting_id,request_started_utc,http_status,provider_status_code", order: "id.desc", limit: 50, offset: page * 50 }),
        v2Rows("collection_runs", { select: "id,collection_date,collection_started_utc,collection_complete,recorded_request_count,reported_failure_count", order: "id.desc", limit: 20 }),
      ]);
      if (snapshot) chosenSnapshot = (await v2Rows("api_response_snapshots", { filters: { id: snapshot }, limit: 1 }))[0] ?? null;
    }
  } catch (e) { error = e instanceof Error ? e.message : "Unable to read V2 data"; }
  const selectedRunner = runner ? runners.find(r => str(r.runner_id) === runner) : null;
  const resultByRunner = new Map(results.map(r => [str(r.runner_id), r]));

  return <main className="min-h-screen bg-[linear-gradient(160deg,#171717,#050505)] p-4 text-white lg:p-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-amber-300/25 bg-black/60 p-6">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">SmartPunt Intelligence · Private Admin</p>
          <h1 className="mt-2 text-3xl font-bold">V2 Data Explorer</h1>
          <p className="mt-2 text-sm text-zinc-400">Read-only historical racing data and original Punting Form API snapshots</p></div>
        <Link href="/" className={link}>Back to Admin</Link>
      </header>
      <nav className="flex gap-2"><Link className={link} href={qs({}, {tab:"races"})}>Race Browser</Link><Link className={link} href={qs({}, {tab:"api"})}>API Inspector</Link></nav>
      {error ? <section className="rounded-xl border border-red-400/40 bg-red-950/30 p-4 text-red-200"><b>Connection / query error:</b> {error}<p className="mt-2 text-sm">Check V2 environment variables and that the pf schema is exposed in the V2 Supabase Data API.</p></section> : null}
      {tab === "races" ? <>
        <section className={box}><h2 className="mb-3 text-lg font-bold text-amber-200">Find a meeting</h2>
          <form method="get" className="flex flex-wrap gap-3"><input type="hidden" name="tab" value="races"/><input name="date" type="date" defaultValue={date} className="rounded-lg bg-zinc-800 p-3 text-white"/><button className="rounded-lg bg-amber-300 px-4 py-2 font-bold text-black">Filter date</button><Link className={link} href={qs({}, {tab:"races"})}>All dates</Link></form>
          <p className="mt-3 text-xs text-zinc-400">Showing up to 50 meetings per page. Choose a meeting to browse its races.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{meetings.map(m => <Link key={str(m.meeting_id)} href={qs({tab:"races",date}, {meeting:str(m.meeting_id),race:"",runner:"",page:""})} className={`rounded-xl border p-3 hover:border-amber-300/70 ${meeting === str(m.meeting_id) ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-black/40"}`}><b>{val(m,"track_name")}</b><p className="text-sm text-zinc-400">{val(m,"meeting_date")} · {val(m,"state")} · {val(m,"country")}</p><p className="text-xs text-zinc-500">Meeting #{val(m,"meeting_id")}</p></Link>)}</div>
          {!error && meetings.length === 0 ? <p className="mt-3 text-zinc-400">No meetings found for this selection.</p> : null}
          <div className="mt-4 flex gap-3">{page > 0 ? <Link className={link} href={qs(base,{page:String(page-1)})}>Previous meetings</Link> : null}{meetings.length === 50 ? <Link className={link} href={qs(base,{page:String(page+1)})}>Next meetings</Link> : null}</div>
        </section>
        {meeting ? <section className={box}><h2 className="mb-3 text-lg font-bold text-amber-200">Races · Meeting #{meeting}</h2><div className="flex flex-wrap gap-2">{races.map(r => <Link key={str(r.race_id)} className={`${link} ${race === str(r.race_id) ? "bg-amber-300/20" : ""}`} href={qs(base,{race:str(r.race_id),runner:"",page:""})}>R{val(r,"race_number")} · {val(r,"race_name")}</Link>)}</div>{races.length === 0 ? <p className="text-zinc-400">No races found.</p> : null}</section> : null}
        {race ? <section className={box}><h2 className="mb-3 text-lg font-bold text-amber-200">Runners · Race #{race}</h2>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-amber-200">{["Horse","TAB","Barrier","Position","Margin","SP","Inspect"].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{runners.map(r => { const result = resultByRunner.get(str(r.runner_id)); return <tr key={str(r.runner_id)} className="border-t border-white/10"><td className="p-2 font-semibold">{val(r,"horse_name")}</td><td className="p-2">{val(r,"tab_number")}</td><td className="p-2">{val(r,"barrier")}</td><td className="p-2">{result ? val(result,"position") : "—"}</td><td className="p-2">{result ? val(result,"margin") : "—"}</td><td className="p-2">{result ? val(result,"starting_price") : "—"}</td><td className="p-2"><Link className={link} href={qs(base,{runner:str(r.runner_id),page:""})}>View raw</Link></td></tr>; })}</tbody></table></div>
          <p className="mt-3 text-xs text-zinc-400">Recorded positions are source data, not a guarantee of verified official finality.</p>
          {raceResult[0] ? <div className="mt-4"><JsonView label="Raw race result" data={raceResult[0].raw_record}/></div> : null}
          {selectedRunner ? <div className="mt-4 space-y-3"><h3 className="font-bold text-amber-200">{val(selectedRunner,"horse_name")} · Original data</h3><JsonView label="Raw runner record" data={selectedRunner.raw_record}/><JsonView label="Raw runner result" data={resultByRunner.get(runner)?.raw_record ?? null}/></div> : null}
        </section> : null}
      </> : <>
        <section className={box}><h2 className="mb-3 text-lg font-bold text-amber-200">Collection history</h2><DataTable rows={runs} columns={[{key:"id",label:"Run"},{key:"collection_date",label:"Date"},{key:"collection_complete",label:"Complete"},{key:"recorded_request_count",label:"Requests"},{key:"reported_failure_count",label:"Failures"}]}/></section>
        <section className={box}><h2 className="mb-3 text-lg font-bold text-amber-200">Saved API responses</h2><div className="space-y-2">{snapshots.map(s => <Link key={str(s.id)} href={qs({tab:"api"},{snapshot:str(s.id)})} className="block rounded-xl border border-white/10 bg-black/40 p-3 hover:border-amber-300/60"><b className="text-amber-200">#{val(s,"id")} · {val(s,"endpoint")}</b><p className="text-sm text-zinc-400">Meeting {val(s,"meeting_id")} · HTTP {val(s,"http_status")} · {val(s,"request_started_utc")}</p></Link>)}</div>
          {snapshots.length === 0 && !error ? <p className="text-zinc-400">No API snapshots stored.</p> : null}
          <div className="mt-4 flex gap-3">{page > 0 ? <Link className={link} href={qs({tab:"api"},{page:String(page-1)})}>Previous</Link> : null}{snapshots.length === 50 ? <Link className={link} href={qs({tab:"api"},{page:String(page+1)})}>Next</Link> : null}</div></section>
        {chosenSnapshot ? <section className={`${box} space-y-3`}><h2 className="text-lg font-bold text-amber-200">API response #{val(chosenSnapshot,"id")}</h2><p className="text-sm text-zinc-400">{val(chosenSnapshot,"endpoint")} · HTTP {val(chosenSnapshot,"http_status")}</p><JsonView label="Original API response JSON" data={chosenSnapshot.raw_response}/><JsonView label="Request parameters" data={chosenSnapshot.request_parameters}/><JsonView label="Full snapshot metadata" data={Object.fromEntries(Object.entries(chosenSnapshot).filter(([k]) => k !== "raw_response"))}/></section> : null}
      </>}
    </div>
  </main>;
}
