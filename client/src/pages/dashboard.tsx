import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  LayoutList,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SecurityStats from "@/components/dashboard/security-stats";
import EmailList from "@/components/dashboard/email-list";
import EmailDetail from "@/components/email/email-item";
import { useEmails, useSendEmail } from "@/hooks/use-emails";
import {
  setComposeOpen,
  setInboxView,
  setTriaged,
  useInboxState,
} from "@/lib/inbox-state";
import { triageMessage, TRIAGE_PILE_LABELS } from "@shared/triage";
import type { TriagePile } from "@shared/triage";
import { cn } from "@/lib/utils";

function readParam(search: string, name: string): string | null {
  const match = search.match(new RegExp(`[?&]${name}=([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const inputClassName =
  "mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function ComposeDialog() {
  const [, setLocation] = useLocation();
  const sendEmail = useSendEmail();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setComposeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    if (sendEmail.isPending) return;
    setComposeOpen(false);
    setTo("");
    setSubject("");
    setBody("");
    setSent(false);
    setError(false);
  };

  const send = () => {
    if (!to.trim() || !subject.trim()) return;
    setError(false);
    sendEmail.mutate(
      { to: to.trim(), subject: subject.trim(), body },
      {
        onSuccess: () => setSent(true),
        onError: () => setError(true),
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20"
      onClick={close}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {sent ? "Sent" : "New email"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {sent ? (
          <div>
            <p className="mt-3 text-sm">It is in your Sent folder.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  close();
                  setLocation("/?folder=sent");
                }}
              >
                View Sent
              </Button>
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
            className="mt-4 space-y-3"
          >
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              To
              <input
                type="text"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="someone@example.com"
                className={inputClassName}
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subject
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What is this about?"
                className={inputClassName}
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Body
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={6}
                placeholder="Write it here…"
                className="mt-1 flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Could not send it. A recipient and a subject are required.
              </p>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                This demo mailbox does not send real mail.
              </p>
              <Button
                type="submit"
                disabled={!to.trim() || !subject.trim() || sendEmail.isPending}
              >
                {sendEmail.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const search = useSearch();
  const { triaged, view, composeOpen } = useInboxState();
  const queryClient = useQueryClient();
  const [triaging, setTriaging] = useState(false);

  const folder = readParam(search, "folder") ?? "inbox";
  const pile = readParam(search, "pile");
  const selectedId = readParam(search, "email");
  const { data: emails = [] } = useEmails(folder);

  const unread = emails.filter((email) => !email.isRead).length;
  const needsReply = useMemo(() => {
    if (!triaged) return 0;
    return emails.filter(
      (email) => triageMessage(email).pile === "needs-reply"
    ).length;
  }, [triaged, emails]);

  const runTriage = () => {
    if (triaged || triaging) return;
    setTriaging(true);
    // The sort itself is instant; the beat makes the re-sort visible.
    window.setTimeout(() => {
      setTriaged(true);
      setTriaging(false);
    }, 300);
  };

  const refresh = () => {
    void queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === "string" &&
          (key.startsWith("/api/emails") || key === "/api/security-stats")
        );
      },
    });
  };

  const title = folder.charAt(0).toUpperCase() + folder.slice(1);
  const pileName = pile ? TRIAGE_PILE_LABELS[pile as TriagePile] : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">
            {title}
            {pileName ? ` — ${pileName}` : ""}
          </h1>
          <p className="text-xs text-muted-foreground">
            {unread} unread of {emails.length}
            {triaged
              ? ` · All ${emails.length} sorted — ${needsReply} ${
                  needsReply === 1 ? "needs" : "need"
                } a reply.`
              : " · Run triage to sort them into piles."}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={runTriage} disabled={triaged || triaging}>
            <Sparkles className="mr-2 h-4 w-4" />
            {triaging ? "Triaging…" : triaged ? "Triaged" : "Run triage"}
          </Button>
          <div className="flex overflow-hidden rounded-md border">
            <button
              type="button"
              aria-label="List view"
              title="List view"
              onClick={() => setInboxView("list")}
              className={cn(
                "p-2",
                view === "list"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60"
              )}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Board view"
              title={triaged ? "Board view" : "Run triage to use the board"}
              disabled={!triaged}
              onClick={() => setInboxView("board")}
              className={cn(
                "border-l p-2",
                view === "board"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60",
                !triaged && "opacity-40"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SecurityStats />

      <div className="flex min-h-0 flex-1">
        {view === "board" && triaged ? (
          <>
            <div className="min-w-0 flex-1">
              <EmailList />
            </div>
            {selectedId && (
              <div className="w-[420px] shrink-0 border-l bg-white dark:bg-zinc-900">
                <EmailDetail />
              </div>
            )}
          </>
        ) : (
          <>
            <div
              className={cn(
                "w-full shrink-0 border-r bg-white dark:bg-zinc-900 sm:w-[400px]",
                selectedId && "hidden sm:block"
              )}
            >
              <EmailList />
            </div>
            <div
              className={cn(
                "min-w-0 flex-1",
                !selectedId && "hidden sm:block"
              )}
            >
              <EmailDetail />
            </div>
          </>
        )}
      </div>

      {composeOpen && <ComposeDialog />}
    </div>
  );
}
