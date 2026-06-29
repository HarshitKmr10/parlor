"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "@/components/ui/icons";

type Props = {
  initialQuery?: string;
  autoFocus?: boolean;
};

export function SearchBox({ initialQuery = "", autoFocus = false }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (q.length >= 2) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={submit} role="search" className="relative">
      <SearchIcon
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
        aria-hidden="true"
      />
      <input
        type="search"
        name="q"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search every meeting…"
        aria-label="Search meetings"
        className="w-full rounded-md border border-border-default bg-surface-0 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-border-strong"
      />
    </form>
  );
}
