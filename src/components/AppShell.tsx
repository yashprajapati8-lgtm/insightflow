"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard,
  MessageSquareText,
  ListOrdered,
  KanbanSquare,
  Workflow,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Map as MapIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { ThemeToggle } from "./ThemeToggle";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { fmt } from "./ui";

const NAV = [
  { href: "/app/map", label: "Map", icon: MapIcon },
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/feedback", label: "Feedback", icon: MessageSquareText },
  { href: "/app/priorities", label: "Priorities", icon: ListOrdered },
  { href: "/app/tracker", label: "Tracker and report", short: "Tracker", icon: KanbanSquare },
  { href: "/app/pipeline", label: "Pipeline", icon: Workflow },
];

function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setH(true));
    if (useStore.persist.hasHydrated()) setH(true);
    return unsub;
  }, []);
  return h;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const meta = useStore((s) => s.meta);
  const tracker = useStore((s) => s.tracker);
  const resetToSample = useStore((s) => s.resetToSample);
  const toast = useToast();
  const open = Object.values(tracker).filter((t) => t.status !== "Resolved").length;
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-6 border-r border-white/[0.06] bg-sidebar px-4 py-5 text-sidebar-ink backdrop-blur-xl lg:flex">
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[17px] font-bold tracking-[-0.01em]">InsightFlow</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="rounded-[14px] border border-white/10 bg-sidebar-2 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <p className="text-[11px] text-sidebar-ink-2">Dataset</p>
          <p className="truncate text-[13px] font-semibold">{meta.name}</p>
          <p className="text-xs text-sidebar-ink-2">
            {fmt(meta.rows)} rows, {fmt(meta.distinct)} distinct
          </p>
        </div>

        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex h-[42px] items-center gap-3 rounded-xl border px-3 text-sm transition-[background,color,border-color] duration-200",
                  active
                    ? "border-white/[0.14] bg-gradient-to-b from-white/[0.14] to-white/[0.07] font-semibold text-sidebar-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_16px_-6px_rgba(0,0,0,0.5)]"
                    : "border-transparent text-sidebar-ink-2 hover:bg-white/[0.05] hover:text-sidebar-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute top-2.5 bottom-2.5 -left-[17px] w-[3px] rounded-full bg-attn"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon size={17} strokeWidth={1.8} />
                <span className="flex-1">{label}</span>
                {href === "/app/tracker" && hydrated && open > 0 && (
                  <span className="rounded-full bg-sidebar-ink/10 px-2 text-xs font-semibold">{open}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <Link
            href="/app/add"
            className="btn-attn flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-[filter] hover:brightness-105"
          >
            <Upload size={16} /> Add feedback
          </Link>
          {meta.name !== "Build Battle sample" && (
            <button
              type="button"
              onClick={() => {
                resetToSample();
                toast.show("Sample dataset restored");
              }}
              className="flex h-9 items-center justify-center gap-2 rounded-xl text-[13px] text-sidebar-ink-2 hover:bg-sidebar-2 hover:text-sidebar-ink"
            >
              <RotateCcw size={14} /> Back to the sample
            </button>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-sidebar px-4 text-sidebar-ink backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-bold">InsightFlow</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/app/add" className="btn-attn inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold">
            <Upload size={14} /> Add
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="min-w-0 flex-1 pb-24 lg:pb-0">
        {hydrated ? children : <PageSkeleton />}
      </main>

      {/* Mobile bottom nav */}
      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-sidebar text-sidebar-ink backdrop-blur-xl lg:hidden">
        {NAV.map(({ href, label, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex h-16 min-w-0 flex-col items-center justify-center gap-1 text-[10.5px]",
                active ? "font-semibold text-sidebar-ink" : "text-sidebar-ink-2",
              )}
            >
              <Icon size={18} strokeWidth={1.8} />
              {short ?? label}
            </Link>
          );
        })}
      </nav>

      <EvidenceDrawer />

      <AnimatePresence>
        {toast.message && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed right-4 bottom-20 z-50 flex raised max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium lg:bottom-6"
          >
            {toast.tone === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#1b2230" stroke="#2c3546" />
      <rect x="7" y="9" width="18" height="3" rx="1.5" fill="#f2b544" />
      <rect x="7" y="15" width="13" height="3" rx="1.5" fill="#e6eaf1" />
      <rect x="7" y="21" width="9" height="3" rx="1.5" fill="#8e98aa" />
    </svg>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-5 py-7 lg:px-8">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-24 w-full" />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="skeleton h-64" />
        <div className="skeleton h-64" />
      </div>
    </div>
  );
}

export function PageHeader({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-[78ch] flex-col gap-1.5">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
        {children && <p className="text-ink-2">{children}</p>}
      </div>
      {actions}
    </div>
  );
}
