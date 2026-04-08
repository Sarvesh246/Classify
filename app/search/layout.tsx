import type { ReactNode } from "react";
import { connection } from "next/server";

export default async function SearchLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Direct mobile opens were still tripping a production-only insertion error under PPR.
  // Holding the whole /search subtree behind the request boundary keeps the streamed tree stable.
  await connection();
  return children;
}
