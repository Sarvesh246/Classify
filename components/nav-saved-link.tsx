import Link from "next/link";

/** Always visible — `/saved` explains sign-in for cloud sync when needed (no nav layout shift). */
export function NavSavedLink({ className }: { className?: string }) {
  return (
    <Link href="/saved" className={className}>
      Saved
    </Link>
  );
}
