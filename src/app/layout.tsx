import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BumbaClaude - Mission Control",
  description: "Mission control for Claude Code multi-agent workflows",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
