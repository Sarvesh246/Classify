import { SavedPageIntro } from "@/components/saved/saved-page-intro";
import { SavedHubShell } from "@/components/saved/saved-hub-shell";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Saved",
  description: "Professors and courses you saved on Classify.",
};

export default function SavedPage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-4 pb-16 md:pt-10">
        <section className="soft-panel rounded-[30px] p-5 sm:rounded-[34px] sm:p-8">
          <p className="eyebrow">Your library</p>
          <h1 className="app-page-title mt-3 font-semibold text-ink">Saved</h1>
          <SavedPageIntro />
        </section>
        <div className="mt-6 sm:mt-8">
          <SavedHubShell />
        </div>
      </div>
    </main>
  );
}
