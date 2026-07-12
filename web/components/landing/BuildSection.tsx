import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import { ArrowIcon, BracketsIcon, WebhookIcon, AgentIcon } from "./icons";

const QUICKSTART = `curl -s $API/api/v1/meetings \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Workspace-Id: $WORKSPACE_ID" \\
  | jq '.[0].summary'`;

type BuildCard = {
  icon: ReactNode;
  title: string;
  description: string;
};

const BUILD_CARDS: BuildCard[] = [
  {
    icon: <BracketsIcon />,
    title: "A real REST API",
    description:
      "Every meeting, transcript, and summary the product shows you is also a documented endpoint — self-hosted, so it never leaves your network.",
  },
  {
    icon: <WebhookIcon />,
    title: "HMAC-signed webhooks",
    description:
      "Trigger your own workflows the moment a meeting ends — push notes into Slack, Notion, or your CRM without polling.",
  },
  {
    icon: <AgentIcon />,
    title: "MCP server for agents",
    description:
      "Point Claude Desktop, Claude Code, or any MCP-compatible agent at a workspace and let it search meetings, read transcripts, and ask grounded questions directly.",
  },
];

export function BuildSection() {
  return (
    <section id="build" aria-labelledby="build-heading" className="bg-surface-1">
      <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <Reveal>
              <p className="eyebrow mb-4">For builders</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 id="build-heading" className="text-2xl text-ink">
                Not just a product. A platform your agents can use too.
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
                Parlor is open source and self-hosted from day one — so the
                same REST API, webhooks, and MCP server that power the product
                are yours to build on, run entirely inside your own network.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/developers"
                  className="group inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-base font-medium text-surface-0 shadow-soft-sm transition-[background-color,transform] duration-200 hover:bg-ink/90 active:translate-y-px"
                >
                  Read the developer docs
                  <ArrowIcon
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    width={16}
                    height={16}
                  />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {BUILD_CARDS.map((card) => (
                  <div key={card.title} className="flex items-start gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage-50 text-sage-600">
                      {card.icon}
                    </span>
                    <div>
                      <p className="text-xl leading-tight text-ink">{card.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                        {card.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={140}>
            <div className="overflow-hidden rounded-2xl border border-border-subtle bg-sage-900 shadow-soft-lg">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="ml-2 font-mono text-xs text-sage-100/70">
                  latest meeting, via the API
                </span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-sage-100">
                <code>{QUICKSTART}</code>
              </pre>
              <div className="border-t border-white/10 px-5 py-4">
                <p className="font-mono text-xs leading-relaxed text-sage-100/70">
                  {'{ "summary": "Aligned on Q3 pricing tiers; '}
                  <br />
                  {'  action item: send updated deck to Priya" }'}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
