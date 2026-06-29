"use client";

import { useState } from "react";
import { postJson, del } from "@/lib/api/browser";
import type { SpeakerProfile } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";

export function SpeakersManager({ initial }: { initial: SpeakerProfile[] }) {
  const [profiles, setProfiles] = useState<SpeakerProfile[]>(initial);
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await postJson<SpeakerProfile>("/api/speaker-profiles", {
        displayName: name.trim(),
        aliases: aliases
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      });
      setProfiles((prev) => [...prev, created].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setName("");
      setAliases("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create profile.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const snapshot = profiles;
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    try {
      await del(`/api/speaker-profiles/${id}`);
    } catch {
      setProfiles(snapshot);
      setError("Failed to delete profile.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="text-sm text-error">{error}</p>}

      {profiles.length > 0 && (
        <ul className="flex flex-col gap-2">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm"
            >
              <div className="min-w-0">
                <p className="font-sans text-sm font-medium text-ink">{p.displayName}</p>
                {p.aliases.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {p.aliases.map((a) => (
                      <span key={a} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
                        {a}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="shrink-0 text-xs text-ink-muted hover:text-error"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-4">
        <p className="eyebrow mb-3">Add a person</p>
        <div className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name (e.g. Alice Chen)"
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <input
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="Aliases, comma-separated (e.g. Speaker 1, Alice)"
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <div className="flex justify-end">
            <Button onClick={create} disabled={busy || !name.trim()} size="sm">
              {busy ? "Saving…" : "Add person"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
