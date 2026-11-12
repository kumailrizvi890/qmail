import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle,
  Send,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEmail,
  useGenerateUnsubscribe,
  useSendEmail,
  useUpdateEmail,
} from "@/hooks/use-emails";
import { useInboxState } from "@/lib/inbox-state";
import {
  draftReply,
  senderDisplayName,
  senderInitials,
  toTriageInput,
  triageMessage,
  TRIAGE_PILE_LABELS,
} from "@shared/triage";
import type { Email } from "@/types/email";
import { cn } from "@/lib/utils";

function readParam(search: string, name: string): string | null {
  const match = search.match(new RegExp(`[?&]${name}=([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Reveal a draft a few characters at a time, like it is being written.
function useStreamingText(text: string | null) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    if (!text) return;
    const timer = window.setInterval(() => {
      setShown((count) => Math.min(count + 4, text.length));
    }, 24);
    return () => window.clearInterval(timer);
  }, [text]);
  return text ? text.slice(0, shown) : "";
}

type DraftStatus = "idle" | "writing" | "ready" | "refused" | "error";

function EmailDetailBody({ email }: { email: Email }) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { triaged } = useInboxState();
  const updateEmail = useUpdateEmail();
  const sendEmail = useSendEmail();
  const generateUnsubscribe = useGenerateUnsubscribe();

  const triage = triageMessage(email);
  const isScam =
    email.aiAnalysis?.isScam ||
    (email.aiAnalysis?.scamProbability ?? 0) > 0.7;
  const reasons = email.aiAnalysis?.reasons ?? [];

  const [draft, setDraft] = useState<string | null>(null);
  const [draftSource, setDraftSource] = useState<"openai" | "local" | null>(
    null
  );
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [unsubscribeText, setUnsubscribeText] = useState<string | null>(null);
  const [unsubscribeFailed, setUnsubscribeFailed] = useState(false);
  const visibleDraft = useStreamingText(draft);

  const generateDraft = async () => {
    setDraftStatus("writing");
    setDraftError(null);
    setDraft(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toTriageInput(email)),
      });
      const data = (await res.json()) as {
        draft?: unknown;
        source?: unknown;
        reason?: unknown;
        error?: unknown;
      };
      if (res.status === 409) {
        setDraftStatus("refused");
        setDraftError(
          typeof data.reason === "string"
            ? data.reason
            : "This message looks like a scam, so no draft was written."
        );
        return;
      }
      if (!res.ok || typeof data.draft !== "string" || !data.draft) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "The draft request failed."
        );
      }
      setDraft(data.draft);
      setDraftSource(data.source === "openai" ? "openai" : "local");
      setDraftStatus("ready");
    } catch {
      // The endpoint is unavailable: fall back to the local draft, the
      // same one the endpoint itself would have used.
      const local = draftReply(toTriageInput(email));
      if (local) {
        setDraft(local);
        setDraftSource("local");
        setDraftStatus("ready");
      } else {
        setDraftStatus("refused");
        setDraftError("This message looks like a scam, so no draft was written.");
      }
    }
  };

  // The draft writes itself in when a message that needs a reply is
  // opened; anything else gets a button instead.
  const didAutoDraft = useRef(false);
  useEffect(() => {
    if (didAutoDraft.current) return;
    didAutoDraft.current = true;
    if (!isScam && triage.pile === "needs-reply") void generateDraft();
  }, []);

  const closeDetail = () => {
    const params = new URLSearchParams(search);
    params.delete("email");
    const query = params.toString();
    setLocation(query ? `/?${query}` : "/");
  };

  const insertDraft = () => {
    if (!draft) return;
    setReplyText((prev) =>
      prev.trim() ? `${prev.trim()}\n\n${draft}` : draft
    );
  };

  const sendReply = () => {
    const body = replyText.trim();
    if (!body) return;
    setSendError(false);
    sendEmail.mutate(
      {
        to: email.from,
        subject: `Re: ${email.subject ?? "(no subject)"}`,
        body,
      },
      {
        onSuccess: () => {
          setSent(true);
          setReplyText("");
        },
        onError: () => setSendError(true),
      }
    );
  };

  const markDone = () => {
    updateEmail.mutate(
      { id: email.id, data: { folder: "archive" } },
      { onSuccess: () => closeDetail() }
    );
  };

  const handleUnsubscribe = () => {
    setUnsubscribeFailed(false);
    generateUnsubscribe.mutate(
      {
        to: email.from,
        fromName: senderDisplayName(email.from),
        serviceDescription: email.subject ?? "this newsletter",
      },
      {
        onSuccess: (result) => {
          const text = (result as { email?: unknown })?.email;
          setUnsubscribeText(
            typeof text === "string" ? text : "Unsubscribe email generated."
          );
        },
        onError: () => setUnsubscribeFailed(true),
      }
    );
  };

  const received = email.receivedAt
    ? new Date(email.receivedAt).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold leading-snug">
            {email.subject ?? "(no subject)"}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={email.isFlagged ? "Remove star" : "Star"}
              onClick={() =>
                updateEmail.mutate({
                  id: email.id,
                  data: { isFlagged: !email.isFlagged },
                })
              }
              className="rounded p-1.5 text-amber-400 hover:bg-accent"
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  email.isFlagged && "fill-amber-400"
                )}
              />
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={closeDetail}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
            {senderInitials(email.from)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {senderDisplayName(email.from)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {email.from}
            </p>
          </div>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {received}
          </span>
        </div>
        {triaged && (
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {TRIAGE_PILE_LABELS[triage.pile]}
            </span>
            <span className="text-xs text-muted-foreground">
              Priority {triage.priorityScore}
            </span>
          </div>
        )}
      </div>

      {isScam && (
        <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-4 w-4" /> This looks like a scam
          </p>
          <p className="mt-1">{triage.nextAction}</p>
          {reasons.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mx-5 mt-4 rounded-lg border bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          <Sparkles className="h-3.5 w-3.5" /> AI summary
        </p>
        <p className="mt-1">{triage.summary}</p>
        <p className="mt-1 text-muted-foreground">
          <span className="font-medium text-foreground">Next: </span>
          {triage.nextAction}
        </p>
      </div>

      <div className="px-5 py-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {email.body ?? ""}
        </p>
      </div>

      {email.aiAnalysis?.unsubscribeRecommended && (
        <div className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
          <p className="font-semibold">Unsubscribe?</p>
          <p className="mt-1 text-muted-foreground">
            {email.aiAnalysis.unsubscribeReason ??
              "You have not opened mail from this sender in a while."}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={generateUnsubscribe.isPending}
            onClick={handleUnsubscribe}
          >
            {generateUnsubscribe.isPending
              ? "Writing it…"
              : "Generate an unsubscribe email"}
          </Button>
          {unsubscribeFailed && (
            <p className="mt-2 text-red-600 dark:text-red-400">
              Could not generate it. Try again.
            </p>
          )}
          {unsubscribeText && (
            <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-2 text-xs dark:bg-zinc-900">
              {unsubscribeText}
            </pre>
          )}
        </div>
      )}

      {!isScam && (
        <div className="mx-5 mb-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bot className="h-3.5 w-3.5" /> AI draft reply
              {draftSource === "openai" && (
                <span className="normal-case">· Drafted by AI</span>
              )}
              {draftSource === "local" && (
                <span className="normal-case">· Drafted on this device</span>
              )}
            </p>
            <Button
              size="sm"
              variant="ghost"
              disabled={draftStatus === "writing"}
              onClick={() => void generateDraft()}
            >
              {draftStatus === "ready" ? "Regenerate" : "Generate draft"}
            </Button>
          </div>
          {draftStatus === "writing" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Writing in your voice…
            </p>
          )}
          {draftStatus === "refused" && draftError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {draftError}
            </p>
          )}
          {draftStatus === "error" && draftError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {draftError}{" "}
              <button
                type="button"
                onClick={() => void generateDraft()}
                className="font-medium underline"
              >
                Try again
              </button>
            </p>
          )}
          {draft && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {visibleDraft}
              {visibleDraft.length < draft.length && (
                <span className="animate-pulse">▍</span>
              )}
            </p>
          )}
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              disabled={!draft}
              onClick={insertDraft}
            >
              Insert draft
            </Button>
          </div>
        </div>
      )}

      {!isScam && (
        <div className="mx-5 mb-4">
          <label
            htmlFor="reply"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Your reply
          </label>
          <textarea
            id="reply"
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            rows={5}
            placeholder={
              draft
                ? "Edit the draft, or write your own reply…"
                : "Write a reply…"
            }
            className="mt-1 flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {sent && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" /> Reply sent — it is in your
              Sent folder.
            </p>
          )}
          {sendError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Could not send the reply. Try again.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={sendReply}
              disabled={!replyText.trim() || sendEmail.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendEmail.isPending ? "Sending…" : "Send reply"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Replies stay in this demo mailbox — nothing is sent for real.
          </p>
        </div>
      )}

      {email.folder !== "archive" && (
        <div className="mx-5 mb-5">
          <Button
            variant="outline"
            onClick={markDone}
            disabled={updateEmail.isPending}
          >
            <Archive className="mr-2 h-4 w-4" />
            {updateEmail.isPending ? "Archiving…" : "Mark done & archive"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function EmailDetail() {
  const search = useSearch();
  const emailId = readParam(search, "email");
  const { data: email, isLoading, error, refetch } = useEmail(emailId ?? "");

  if (!emailId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Select an email to read it — the summary and a draft reply show up
          here.
        </p>
      </div>
    );
  }

  if (isLoading) return <EmailDetailSkeleton />;

  if (error || !email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Could not load that email.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return <EmailDetailBody key={email.id} email={email} />;
}

function EmailDetailSkeleton() {
  return (
    <div className="space-y-4 p-5">
      <Skeleton className="h-6 w-2/3" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
