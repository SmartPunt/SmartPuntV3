"use client";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  addHorseToVaultAction,
  searchVaultHorsesAction,
  type VaultHorseSearchResult,
} from "@/lib/vault-actions";
import VaultDoorIcon from "@/components/vault-door-icon";

export default function VaultHorseSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<VaultHorseSearchResult[]>([]);
  const [selectedHorse, setSelectedHorse] =
    useState<VaultHorseSearchResult | null>(null);
  const [alertName, setAlertName] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [isSearching, startSearchTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const searchRequestId = useRef(0);
  const preselectedHorseHandled = useRef(false);

  useEffect(() => {
    if (preselectedHorseHandled.current) {
      return;
    }

    const horseIdValue = searchParams.get("horseId");
    const horseNameValue = searchParams
      .get("horseName")
      ?.trim();

    if (!horseIdValue || !horseNameValue) {
      return;
    }

    const horseId = Number(horseIdValue);

    if (!Number.isFinite(horseId) || horseId <= 0) {
      return;
    }

    preselectedHorseHandled.current = true;

    chooseHorse({
      id: horseId,
      horse_name: horseNameValue,
      age: null,
      sex: null,
    } as VaultHorseSearchResult);

    window.setTimeout(() => {
      document
        .getElementById("add-to-vault")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  }, [searchParams]);

  useEffect(() => {
    const cleanedSearch = search.trim();

    setMessage("");
    setErrorMessage("");

    if (selectedHorse && cleanedSearch === selectedHorse.horse_name) {
      return;
    }

    setSelectedHorse(null);

    if (cleanedSearch.length < 2) {
      setResults([]);
      return;
    }

    const currentRequestId = searchRequestId.current + 1;
    searchRequestId.current = currentRequestId;

    const timeout = window.setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const rows = await searchVaultHorsesAction(cleanedSearch);

          if (searchRequestId.current !== currentRequestId) {
            return;
          }

          setResults(rows);
        } catch (error) {
          if (searchRequestId.current !== currentRequestId) {
            return;
          }

          setResults([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not search horses.",
          );
        }
      });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [search, selectedHorse]);

  function chooseHorse(horse: VaultHorseSearchResult) {
    searchRequestId.current += 1;
    setSelectedHorse(horse);
    setSearch(horse.horse_name);
    setResults([]);
    setMessage("");
    setErrorMessage("");
    setAlertName(`${horse.horse_name} Alert`);
  }

  function saveHorse() {
    if (!selectedHorse) {
      setErrorMessage("Choose a horse from the search results first.");
      return;
    }

    setMessage("");
    setErrorMessage("");

    startSaveTransition(async () => {
      const result = await addHorseToVaultAction({
        horseId: selectedHorse.id,
        alertName,
      });

      if (!result.success) {
        setErrorMessage(
          result.error || "Could not add this horse to your Vault.",
        );
        return;
      }

      setMessage(
        result.message || "Horse added to your Vault.",
      );

      setSearch("");
      setResults([]);
      setSelectedHorse(null);
      setAlertName("");

      router.replace("/the-vault#add-to-vault");
      router.refresh();
    });
  }

  return (
    <section
      id="add-to-vault"
      className="overflow-hidden rounded-[2rem] border border-amber-300/30 bg-[linear-gradient(145deg,rgba(0,0,0,0.94),rgba(24,24,27,0.9),rgba(120,53,15,0.18))] p-4 shadow-2xl shadow-black/40 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">
            Add To Vault
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Save a horse
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Search SmartPunt’s horse database and add a horse to your
            personal Vault. For now, you will be notified whenever that
            horse appears in a current or upcoming published race.
          </p>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-2xl">
          🔐
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="relative">
          <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Find horse
          </label>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Start typing a horse name..."
            autoComplete="off"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
          />

          <div className="mt-2 min-h-5 text-xs font-semibold text-zinc-500">
            {isSearching
              ? "Searching SmartPunt horses..."
              : search.trim().length === 1
                ? "Type at least 2 characters."
                : null}
          </div>

          {results.length > 0 ? (
            <div className="absolute left-0 right-0 top-[92px] z-30 max-h-80 overflow-y-auto rounded-2xl border border-amber-300/25 bg-zinc-950 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
              {results.map((horse) => (
                <button
                  key={horse.id}
                  type="button"
                  onClick={() => chooseHorse(horse)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-amber-300/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">
                      {horse.horse_name}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {horse.age ? `${horse.age}yo` : "Age unknown"}
                      {horse.sex ? ` · ${horse.sex}` : ""}
                    </p>
                  </div>

                  <span className="shrink-0 text-xs font-black uppercase tracking-[0.12em] text-amber-300">
                    Select
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {!isSearching &&
          search.trim().length >= 2 &&
          !selectedHorse &&
          results.length === 0 &&
          !errorMessage ? (
            <p className="mt-2 text-xs font-semibold text-zinc-500">
              No matching horses found.
            </p>
          ) : null}
        </div>

        <div>
          <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Alert name
          </label>

          <input
            type="text"
            value={alertName}
            onChange={(event) => setAlertName(event.target.value)}
            disabled={!selectedHorse}
            maxLength={120}
            placeholder="Choose a horse first"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-500 focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <p className="mt-2 text-xs font-semibold text-zinc-500">
            You can give the alert a personal name.
          </p>
        </div>
      </div>

      {selectedHorse ? (
        <div className="mt-5 rounded-[1.5rem] border border-emerald-300/25 bg-emerald-400/[0.08] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                Selected Horse
              </p>

              <h3 className="mt-2 text-xl font-black text-white">
                {selectedHorse.horse_name}
              </h3>

              <p className="mt-1 text-sm text-zinc-400">
                Alert on every published current or upcoming race.
              </p>
            </div>

            <span className="text-3xl">🏇</span>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={saveHorse}
        disabled={!selectedHorse || isSaving}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <VaultDoorIcon className="h-6 w-6 shrink-0" />

        <span>
          {isSaving
            ? "Adding To Vault..."
            : "Add Horse To Vault"}
        </span>
      </button>

      {message ? (
        <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">
          {errorMessage}
        </div>
      ) : null}
    </section>
  );
}
