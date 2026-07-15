"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  searchVaultPickerOptionsAction,
  type VaultPickerResult,
  type VaultPickerType,
} from "@/lib/vault-actions";

type VaultPickerProps = {
  label: string;
  pickerType: VaultPickerType;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
};

export default function VaultPicker({
  label,
  pickerType,
  values,
  onChange,
  placeholder,
}: VaultPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRequestId = useRef(0);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<VaultPickerResult[]>(
    [],
  );
  const [errorMessage, setErrorMessage] = useState("");

  const [isSearching, startSearchTransition] =
    useTransition();

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        searchRequestId.current += 1;
        setOpen(false);
        setSearch("");
        setResults([]);
        setErrorMessage("");
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  useEffect(() => {
    const cleanedSearch = search.trim();

    setErrorMessage("");

    if (!open || cleanedSearch.length < 2) {
      setResults([]);
      return;
    }

    const currentRequestId =
      searchRequestId.current + 1;

    searchRequestId.current = currentRequestId;

    const timeout = window.setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const rows =
            await searchVaultPickerOptionsAction({
              pickerType,
              searchTerm: cleanedSearch,
            });

          if (
            searchRequestId.current !== currentRequestId
          ) {
            return;
          }

          setResults(rows);
        } catch (error) {
          if (
            searchRequestId.current !== currentRequestId
          ) {
            return;
          }

          setResults([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : `Could not search ${label.toLowerCase()}.`,
          );
        }
      });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [label, open, pickerType, search]);

  function openPicker() {
    setOpen(true);
    setErrorMessage("");
  }

  function closePicker() {
    searchRequestId.current += 1;
    setOpen(false);
    setSearch("");
    setResults([]);
    setErrorMessage("");
  }

  function selectValue(result: VaultPickerResult) {
    const alreadySelected = values.some(
      (value) =>
        value.toLowerCase() === result.value.toLowerCase(),
    );

    if (!alreadySelected) {
      onChange([...values, result.value]);
    }

    setSearch("");
    setResults([]);
    setErrorMessage("");
  }

  function removeValue(valueToRemove: string) {
    onChange(
      values.filter(
        (value) =>
          value.toLowerCase() !==
          valueToRemove.toLowerCase(),
      ),
    );
  }

  const availableResults = results.filter(
    (result) =>
      !values.some(
        (value) =>
          value.toLowerCase() ===
          result.value.toLowerCase(),
      ),
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
          {label}
        </label>

        {values.length > 0 ? (
          <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-200">
            {values.length} selected
          </span>
        ) : null}
      </div>

      <div className="mt-2 rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-3">
        {values.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {values.map((value) => (
              <div
                key={value}
                className="flex min-w-0 items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2"
              >
                <span className="max-w-[13rem] truncate text-xs font-bold text-amber-100">
                  {value}
                </span>

                <button
                  type="button"
                  onClick={() => removeValue(value)}
                  aria-label={`Remove ${value}`}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/30 text-[11px] font-black text-amber-200 transition hover:bg-black/60 hover:text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-5 text-zinc-500">
            No {label.toLowerCase()} selected. Any will
            qualify.
          </p>
        )}

        {!open ? (
          <button
            type="button"
            onClick={openPicker}
            className="mt-3 flex w-full items-center justify-center rounded-xl border border-dashed border-amber-300/30 bg-amber-300/[0.06] px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-amber-200 transition hover:border-amber-300/50 hover:bg-amber-300/10"
          >
            + Add {label.replace(/s$/, "")}
          </button>
        ) : (
          <div className="mt-3">
            <div className="flex gap-2">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder={placeholder}
                autoComplete="off"
                autoFocus
                className="min-w-0 flex-1 rounded-xl border border-amber-300/30 bg-black/45 px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-500 focus:border-amber-300"
              />

              <button
                type="button"
                onClick={closePicker}
                className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-2 min-h-5 text-xs font-semibold text-zinc-500">
              {isSearching
                ? `Searching SmartPunt ${label.toLowerCase()}...`
                : search.trim().length === 1
                  ? "Type at least 2 characters."
                  : search.trim().length === 0
                    ? `Search the full SmartPunt ${label.toLowerCase()} history.`
                    : null}
            </div>
          </div>
        )}
      </div>

      {open && availableResults.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-amber-300/25 bg-zinc-950 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.8)]">
          {availableResults.map((result) => (
            <button
              key={result.value}
              type="button"
              onClick={() => selectValue(result)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-amber-300/10"
            >
              <span className="min-w-0 truncate text-sm font-black text-white">
                {result.value}
              </span>

              <div className="flex shrink-0 items-center gap-2">
                {result.isCurrent ? (
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-200">
                    Current ★
                  </span>
                ) : null}

                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-300">
                  Add
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {open &&
      !isSearching &&
      search.trim().length >= 2 &&
      availableResults.length === 0 &&
      !errorMessage ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-2xl border border-white/10 bg-zinc-950 p-4 text-center shadow-[0_24px_70px_rgba(0,0,0,0.8)]">
          <p className="text-xs font-semibold text-zinc-500">
            No matching {label.toLowerCase()} found.
          </p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-2 rounded-xl border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-200">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
