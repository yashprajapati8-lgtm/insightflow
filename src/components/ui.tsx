"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Sentiment, Severity } from "@/lib/types";

type BtnVariant = "primary" | "secondary" | "ghost";
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[background,color,border-color,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none";
const btnSize = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-[15px]" };
const btnVariant: Record<BtnVariant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90 font-semibold",
  secondary: "bg-surface text-ink border border-line hover:border-ink-3 hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: BtnVariant; size?: keyof typeof btnSize }) {
  return <button type="button" className={clsx(btnBase, btnSize[size], btnVariant[variant], className)} {...rest} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: keyof typeof btnSize }) {
  return <Link className={clsx(btnBase, btnSize[size], btnVariant[variant], className)} {...rest} />;
}

export function Panel({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={clsx("rounded-xl border border-line bg-surface shadow-card", className)} {...rest}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  actions,
  id,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-ink-2">{icon}</span>}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={id} className="text-base font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {subtitle && <p className="text-[13px] text-ink-2">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "sm",
}: {
  options: readonly T[] | { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const opts = (options as (T | { value: T; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-surface-2 p-0.5">
      {opts.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={clsx(
              "rounded-[5px] font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
              on ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const SENT_STYLE: Record<Sentiment, string> = {
  negative: "bg-neg-bg text-neg-fg",
  positive: "bg-pos-bg text-pos-fg",
  mixed: "bg-mix-bg text-mix-fg",
  neutral: "bg-line-soft text-ink-2",
};
const SENT_LABEL: Record<Sentiment, string> = { negative: "Negative", positive: "Positive", mixed: "Mixed", neutral: "Neutral" };

export function SentimentChip({ value }: { value: Sentiment }) {
  return (
    <span className={clsx("inline-flex h-6 items-center rounded px-2 text-xs font-semibold", SENT_STYLE[value])}>
      {SENT_LABEL[value]}
    </span>
  );
}

export function ActNow() {
  return (
    <span className="inline-flex h-5 items-center rounded bg-attn px-1.5 text-[11px] font-bold text-on-attn">Act now</span>
  );
}

const SEV_DOT: Record<Severity, string> = {
  critical: "bg-neg",
  high: "bg-attn",
  medium: "bg-bar-2",
  low: "bg-bar-3",
  none: "bg-line",
};
export function SeverityDot({ value }: { value: Severity }) {
  return <span aria-hidden className={clsx("inline-block size-2 rounded-full", SEV_DOT[value])} />;
}

export function Stat({
  label,
  value,
  note,
  onOpen,
  accent,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  onOpen?: () => void;
  accent?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-5 py-4">
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className="flex items-center gap-2">
        {onOpen ? (
          <button type="button" onClick={onOpen} className="proof text-[28px] leading-tight font-semibold tracking-[-0.02em]">
            {value}
          </button>
        ) : (
          <span className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">{value}</span>
        )}
        {accent}
      </span>
      {note && <span className="text-[13px] text-ink-2">{note}</span>}
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-[48ch] text-[13px] text-ink-2">{body}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function fmt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}
export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
