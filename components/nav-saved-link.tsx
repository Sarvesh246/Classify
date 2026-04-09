import Link from "next/link";

/** Always visible — `/saved` explains sign-in for cloud sync when needed (no nav layout shift). */
export function NavSavedLink({
  className,
  prefetch,
}: {
  className?: string;
  prefetch?: boolean;
}) {
  return (
    <Link href="/saved" prefetch={prefetch} className={className}>
      Saved
    </Link>
  );
}
