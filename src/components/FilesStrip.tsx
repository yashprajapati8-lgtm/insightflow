"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { FileSpreadsheet, Plus, X, Download, Trash2, Check, ShieldCheck } from "lucide-react";
import { Button, fmt } from "./ui";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { detectRoles, type Role } from "@/lib/csv";
import { listFiles, getFile, deleteFile, formatBytes, type FileSummary } from "@/lib/files";

const SAMPLE_ID = "sample";
const ROLE_LABEL: Record<Role, string> = {
  text: "Feedback text",
  category: "Category",
  date: "Date",
  source: "Source",
  state: "State",
  city: "City",
  ignore: "Not used",
};

type Preview = {
  id: string;
  name: string;
  rows: number;
  size: number;
  when: string;
  demo: boolean;
  headers: string[];
  sample: Record<string, string>[];
  roles: Record<string, Role>;
  empty: number;
  distinct: number;
};

/** The files behind this workspace, like attachments in a chat. Click one to look inside or switch to it. */
export function FilesStrip() {
  const meta = useStore((s) => s.meta);
  const loadDataset = useStore((s) => s.loadDataset);
  const resetToSample = useStore((s) => s.resetToSample);
  const toast = useToast((s) => s.show);
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listFiles().then(setFiles).catch(() => setFiles([]));
  }, []);
  useEffect(refresh, [refresh]);

  const activeId = meta.fileId ?? (meta.name === "Build Battle sample" ? SAMPLE_ID : null);

  async function open(id: string) {
    setLoading(id);
    try {
      if (id === SAMPLE_ID) {
        const raw = await fetch("/sample.csv").then((r) => r.text());
        setPreview(build(SAMPLE_ID, "sample.csv", raw, raw.length, "Shipped with the app", true));
      } else {
        const f = await getFile(id);
        if (!f) throw new Error("gone");
        const p = build(f.id, f.name, f.raw, f.size, new Date(f.importedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }), false);
        p.roles = { ...p.roles, ...f.roles };
        setPreview(p);
      }
    } catch {
      toast("This file is no longer in this browser.", "error");
      refresh();
    } finally {
      setLoading(null);
    }
  }

  async function use(id: string) {
    if (id === SAMPLE_ID) {
      resetToSample();
      toast("Switched to the demo sample");
    } else {
      const f = await getFile(id);
      if (!f) return;
      loadDataset(f.meta, f.reviews);
      toast(`Switched to ${f.name}`);
    }
    setPreview(null);
  }

  async function remove(id: string) {
    await deleteFile(id);
    if (activeId === id) resetToSample();
    setPreview(null);
    refresh();
    toast("Removed from this browser");
  }

  const chips = useMemo(
    () => [
      { id: SAMPLE_ID, name: "sample.csv", detail: "7,000 rows · demo", demo: true },
      ...files.map((f) => ({ id: f.id, name: f.name, detail: `${fmt(f.rows)} rows · ${formatBytes(f.size)}`, demo: false })),
    ],
    [files],
  );

  return (
    <section aria-label="Files" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Files</h2>
        <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
          <ShieldCheck size={13} className="text-pos" /> Kept in this browser only
        </span>
      </div>
      <ul className="flex flex-wrap gap-2.5">
        {chips.map((c) => {
          const on = c.id === activeId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => open(c.id)}
                className={clsx(
                  "glass lift flex items-center gap-3 rounded-2xl py-2.5 pr-4 pl-2.5 text-left transition-colors",
                  on && "!border-attn/60",
                )}
              >
                <span className={clsx("flex size-10 items-center justify-center rounded-xl", c.demo ? "bg-attn-soft text-attn-text" : "bg-pos-bg text-pos-fg")}>
                  <FileSpreadsheet size={19} />
                </span>
                <span className="flex flex-col">
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    {c.name}
                    {on && <span className="rounded bg-attn px-1.5 py-px text-[10px] font-bold text-on-attn">In use</span>}
                  </span>
                  <span className="text-[12px] text-ink-2">{loading === c.id ? "Opening…" : c.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <Link
            href="/app/add"
            className="flex h-full min-h-[60px] items-center gap-2 rounded-2xl border border-dashed border-line px-4 text-[13px] font-medium text-ink-2 hover:border-ink-3 hover:text-ink"
          >
            <Plus size={16} /> Upload a CSV
          </Link>
        </li>
      </ul>

      <AnimatePresence>
        {preview && (
          <PreviewModal
            p={preview}
            active={preview.id === activeId}
            onClose={() => setPreview(null)}
            onUse={() => use(preview.id)}
            onRemove={preview.demo ? undefined : () => remove(preview.id)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function build(id: string, name: string, raw: string, size: number, when: string, demo: boolean): Preview {
  const res = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });
  const headers = (res.meta.fields ?? []).filter(Boolean);
  const rows = res.data;
  const roles = detectRoles(headers, rows);
  const textCol = Object.entries(roles).find(([, r]) => r === "text")?.[0];
  const texts = textCol ? rows.map((r) => (r[textCol] ?? "").trim()) : [];
  return {
    id,
    name,
    rows: rows.length,
    size,
    when,
    demo,
    headers,
    sample: rows.slice(0, 60),
    roles,
    empty: texts.filter((t) => !t).length,
    distinct: new Set(texts.filter(Boolean).map((t) => t.toLowerCase())).size,
  };
}

function PreviewModal({
  p,
  active,
  onClose,
  onUse,
  onRemove,
}: {
  p: Preview;
  active: boolean;
  onClose: () => void;
  onUse: () => void;
  onRemove?: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  function download() {
    const a = document.createElement("a");
    if (p.demo) a.href = "/sample.csv";
    else {
      getFile(p.id).then((f) => {
        if (!f) return;
        const url = URL.createObjectURL(new Blob([f.raw], { type: "text/csv" }));
        const b = document.createElement("a");
        b.href = url;
        b.download = f.name;
        b.click();
        URL.revokeObjectURL(url);
      });
      return;
    }
    a.download = p.name;
    a.click();
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${p.name}`}
        className="fixed inset-x-3 top-[6vh] bottom-[6vh] z-50 mx-auto flex max-w-[1040px] flex-col overflow-hidden rounded-[22px] border border-line bg-[var(--bg)] shadow-pop"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex items-start gap-3">
            <span className={clsx("flex size-11 items-center justify-center rounded-xl", p.demo ? "bg-attn-soft text-attn-text" : "bg-pos-bg text-pos-fg")}>
              <FileSpreadsheet size={21} />
            </span>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="text-[13px] text-ink-2">
                {p.demo ? "Demo dataset" : "Uploaded"} · {p.when} · {formatBytes(p.size)}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="inline-flex size-9 items-center justify-center rounded-xl hover:bg-surface-2">
            <X size={18} />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
          {[
            ["Rows", fmt(p.rows)],
            ["Distinct reviews", fmt(p.distinct)],
            ["Repeats grouped", fmt(Math.max(0, p.rows - p.empty - p.distinct))],
            ["Empty, skipped", fmt(p.empty)],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 bg-[var(--bg)] px-6 py-3">
              <span className="text-[12px] text-ink-2">{k}</span>
              <span className="text-lg font-semibold tabular-nums">{v}</span>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-surface-2">
              <tr>
                <th className="w-12 border-b border-line px-3 py-2.5 text-left font-normal text-ink-3">#</th>
                {p.headers.map((h) => (
                  <th key={h} className="border-b border-line px-3 py-2.5 text-left align-top font-normal">
                    <span className="block font-semibold">{h}</span>
                    <span
                      className={clsx(
                        "mt-1 inline-block rounded px-1.5 py-px text-[11px] font-semibold",
                        p.roles[h] === "text" ? "bg-attn-soft text-attn-text" : p.roles[h] === "ignore" ? "bg-line-soft text-ink-3" : "bg-pos-bg text-pos-fg",
                      )}
                    >
                      {ROLE_LABEL[p.roles[h]]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.sample.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="border-b border-line-soft px-3 py-2 text-ink-3 tabular-nums">{i + 1}</td>
                  {p.headers.map((h) => (
                    <td key={h} className={clsx("border-b border-line-soft px-3 py-2", p.roles[h] === "text" && "quote text-[14px]")}>
                      {r[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {p.rows > p.sample.length && (
            <p className="px-6 py-3 text-[12px] text-ink-2">
              Showing the first {fmt(p.sample.length)} of {fmt(p.rows)} rows.
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
          <div className="flex gap-2">
            <Button size="sm" onClick={download}>
              <Download size={14} /> Download
            </Button>
            {onRemove && (
              <Button size="sm" onClick={onRemove}>
                <Trash2 size={14} /> Remove from this browser
              </Button>
            )}
          </div>
          {active ? (
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-pos-fg">
              <Check size={15} /> This file is in use
            </span>
          ) : (
            <Button variant="primary" onClick={onUse}>
              Use this file
            </Button>
          )}
        </footer>
      </motion.div>
    </>
  );
}
