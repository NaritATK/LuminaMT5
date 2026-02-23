import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumina MT5 Dashboard",
  description: "Operator dashboard for overview, risk, and command audit."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>Lumina MT5 Dashboard</h1>
          <nav>
            <ul>
              <li><Link href="/overview">Overview</Link></li>
              <li><Link href="/risk">Risk</Link></li>
              <li><Link href="/commands-audit">Commands Audit</Link></li>
            </ul>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
