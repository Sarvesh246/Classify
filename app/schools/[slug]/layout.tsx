/**
 * Direct hits to school routes were tripping a production-only client insertion error
 * under partial prerendering. Serve this segment as full dynamic responses for launch.
 */
import { connection } from "next/server";

export default async function SchoolLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  return children;
}
