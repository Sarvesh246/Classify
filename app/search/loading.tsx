import { SiteHeader } from "@/components/site-header";

export default function SearchLoading() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell animate-pulse pt-10">
        <div className="soft-panel h-56 rounded-[34px] bg-white/50" />
        <div className="mt-8 h-72 rounded-[30px] bg-white/40" />
      </div>
    </main>
  );
}
