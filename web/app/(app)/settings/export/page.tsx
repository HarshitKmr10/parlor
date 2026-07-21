import type { Metadata } from "next";
import Link from "next/link";
import { ConfigExportPanel } from "@/components/settings/ConfigExportPanel";

export const metadata: Metadata = {
  title: "Export configuration — Parlor",
};

export default function ConfigExportPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← Settings
        </Link>
        <p className="eyebrow mb-1.5 mt-3">Portability</p>
        <h1 className="font-display text-2xl text-ink">Export configuration</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Bundle this workspace&apos;s Parlor setup into a single JSON file —
          for backup, or to carry your configuration between self-hosted
          instances. Everything runs locally; nothing leaves your machine but
          the download.
        </p>
      </header>

      <ConfigExportPanel />
    </div>
  );
}
