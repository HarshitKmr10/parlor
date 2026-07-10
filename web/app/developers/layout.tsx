import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { DevSidebar } from "@/components/developers/DevSidebar";

export default function DevelopersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-[1100px] px-5 py-12 sm:px-8 lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
          <div className="mb-10 lg:mb-0">
            <DevSidebar />
          </div>
          <div className="max-w-2xl">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
