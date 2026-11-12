import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { AlertTriangle, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmails, useUpdateEmail } from "@/hooks/use-emails";
import { useInboxState } from "@/lib/inbox-state";
import {
  senderDisplayName,
  senderInitials,
  triageMessage,
  TRIAGE_PILE_LABELS,
} from "@shared/triage";
import type { TriagePile, TriageResult } from "@shared/triage";
import type { Email } from "@/types/email";
import { cn } from "@/lib/utils";

const PILES: TriagePile[] = ["needs-reply", "fyi", "low"];

const PILE_CHIP: Record<TriagePile, string> = {
  "needs-reply":
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  fyi: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

interface TriagedRow {
  email: Email;
  triage: TriageResult;
}

function readParam(search: string, name: string): string | null {
  return new URLSearchParams(search).get(name);
}

function formatListTime(receivedAt: Date | null): string {
  if (!receivedAt) return "";
  const date = new Date(receivedAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= startOfToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function EmailRow({
  row,
  selected,
  showPileChip,
  showScore,
  onSelect,
  onToggleStar,
}: {
  row: TriagedRow;
  selected: boolean;
  showPileChip: boolean;
  showScore: boolean;
  onSelect: (email: Email) => void;
  onToggleStar: (email: Email) => void;
}) {
  const { email, triage } = row;
  const isScam = email.aiAnalysis?.isScam ?? false;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(email)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(email);
        }
      }}
      className={cn(
        "animate-slide-in flex cursor-pointer gap-3 px-4 py-3 hover:bg-accent/60",
        selected && "bg-accent",
        !email.isRead && "bg-white dark:bg-zinc-900"
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
        {senderInitials(email.from)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              email.isRead ? "font-normal" : "font-semibold"
            )}
          >
            {senderDisplayName(email.from)}
          </span>
          {isScam && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
          <button
            type="button"
            aria-label={email.isFlagged ? "Remove star" : "Star"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleStar(email);
            }}
            className="shrink-0 rounded p-0.5 text-amber-400 hover:bg-accent"
          >
            <Star
              className={cn("h-4 w-4", email.isFlagged && "fill-amber-400")}
            />
          </button>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatListTime(email.receivedAt)}
          </span>
        </div>
        <p
          className={cn(
            "truncate text-sm",
            email.isRead ? "text-muted-foreground" : "font-semibold"
          )}
        >
          {email.subject ?? "(no subject)"}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {triage.summary}
        </p>
        {(showPileChip || showScore) && (
          <div className="mt-1 flex items-center gap-2">
            {showPileChip && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  PILE_CHIP[triage.pile]
                )}
              >
                {TRIAGE_PILE_LABELS[triage.pile]}
              </span>
            )}
            {showScore && (
              <span className="text-xs text-muted-foreground">
                Priority {triage.priorityScore}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmailList() {
  const [, setLocation] = useLocation();
  const queryString = useSearch();
  const { triaged, search, view } = useInboxState();
  const updateEmail = useUpdateEmail();

  const folder = readParam(queryString, "folder") ?? "inbox";
  const pile = readParam(queryString, "pile");
  const selectedId = readParam(queryString, "email");

  const { data: emails = [], isLoading, error, refetch } = useEmails(folder);

  const rows = useMemo<TriagedRow[]>(() => {
    const query = search.trim().toLowerCase();
    let list = emails.map((email) => ({
      email,
      triage: triageMessage(email),
    }));

    if (pile) {
      list = list.filter((row) => row.triage.pile === pile);
    }
    if (query) {
      list = list.filter((row) => {
        const haystack = [
          senderDisplayName(row.email.from),
          row.email.from,
          row.email.subject ?? "",
          row.triage.summary,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    list.sort((a, b) => {
      if (triaged) {
        const byScore = b.triage.priorityScore - a.triage.priorityScore;
        if (byScore !== 0) return byScore;
      }
      const at = a.email.receivedAt
        ? new Date(a.email.receivedAt).getTime()
        : 0;
      const bt = b.email.receivedAt
        ? new Date(b.email.receivedAt).getTime()
        : 0;
      return bt - at;
    });
    return list;
  }, [emails, pile, search, triaged]);

  const selectEmail = (email: Email) => {
    if (!email.isRead) {
      updateEmail.mutate({ id: email.id, data: { isRead: true } });
    }
    const params = new URLSearchParams(queryString);
    params.set("email", String(email.id));
    setLocation(`/?${params.toString()}`);
  };

  const toggleStar = (email: Email) => {
    updateEmail.mutate({
      id: email.id,
      data: { isFlagged: !email.isFlagged },
    });
  };

  if (isLoading) return <EmailListSkeleton />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Could not load this folder.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 text-sm font-medium text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {pile
            ? "Nothing in this pile."
            : search.trim()
              ? `No mail matches "${search.trim()}".`
              : "Nothing here yet."}
        </p>
      </div>
    );
  }

  if (view === "board" && triaged) {
    return (
      <div className="grid h-full grid-cols-1 gap-3 overflow-hidden p-3 sm:grid-cols-2 lg:grid-cols-3">
        {PILES.map((pileName) => {
          const pileRows = rows.filter((row) => row.triage.pile === pileName);
          return (
            <section
              key={pileName}
              className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white dark:bg-zinc-900"
            >
              <header className="flex items-center justify-between border-b px-3 py-2">
                <h3 className="text-sm font-semibold">
                  {TRIAGE_PILE_LABELS[pileName]}
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {pileRows.length}
                </span>
              </header>
              <div className="min-h-0 flex-1 divide-y overflow-y-auto">
                {pileRows.map((row) => (
                  <EmailRow
                    key={row.email.id}
                    row={row}
                    selected={String(row.email.id) === selectedId}
                    showPileChip={false}
                    showScore
                    onSelect={selectEmail}
                    onToggleStar={toggleStar}
                  />
                ))}
                {pileRows.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">
                    Nothing here.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="h-full divide-y overflow-y-auto">
      {rows.map((row) => (
        <EmailRow
          key={row.email.id}
          row={row}
          selected={String(row.email.id) === selectedId}
          showPileChip={triaged}
          showScore={triaged}
          onSelect={selectEmail}
          onToggleStar={toggleStar}
        />
      ))}
    </div>
  );
}

function EmailListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
