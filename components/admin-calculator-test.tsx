"use client";
                <input
                  value={conditionOverride}
                  onChange={(e) => setConditionOverride(e.target.value)}
                  placeholder="e.g. 75"
                  className="mt-2 w-full rounded-2xl border border-amber-200/30 px-4 py-3"
                />
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Score output</h2>

              {scoredRunner ? (
                <>
                  <div className="rounded-[24px] border border-amber-200/30 bg-amber-50 p-5">
                    <p className="text-sm text-zinc-500">Overall score</p>

                    <p className="mt-2 text-5xl font-bold text-zinc-950">
                      {roundScore(scoredRunner.score)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone="green">
                        Win {scoredRunner.winPercent}%
                      </Badge>

                      <Badge tone="blue">
                        Place {scoredRunner.placePercent}%
                      </Badge>

                      <Badge tone="amber">
                        {scoredRunner.verdict}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {componentRows.map(([label, score]) => (
                      <div
                        key={String(label)}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          {label}
                        </p>

                        <p className="mt-2 text-2xl font-bold text-zinc-950">
                          {roundScore(Number(score))}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500">
                  Enter test inputs to calculate a score.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
