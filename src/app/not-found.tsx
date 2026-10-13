import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/AppShell";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 text-center text-ink">
      <Logo size={40} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-attn-text">404</p>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">This page does not exist</h1>
        <p className="max-w-[44ch] text-ink-2">The link may be mistyped or out of date. Your workspace is safe in this browser.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/app" className="raised inline-flex h-11 items-center gap-2 rounded-xl px-5 font-semibold hover:brightness-105">
          Open the workspace <ArrowRight size={16} />
        </Link>
        <Link href="/" className="glass lift inline-flex h-11 items-center rounded-xl px-5 font-medium">
          Home
        </Link>
      </div>
    </main>
  );
}
