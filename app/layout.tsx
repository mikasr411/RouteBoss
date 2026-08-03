import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Route Boss",
  description: "Manage your solar panel client routes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-dvh">
      <body
        className={`${inter.className} flex h-dvh flex-col overflow-hidden bg-slate-900`}
      >
        <Navbar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-slate-900 w-full max-w-[100vw]">
          {children}
        </main>
      </body>
    </html>
  );
}

