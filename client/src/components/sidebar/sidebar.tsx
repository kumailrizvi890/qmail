import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { useEmails } from "@/hooks/use-emails";
import { setComposeOpen, useInboxState } from "@/lib/inbox-state";
import { triageMessage, TRIAGE_PILE_LABELS } from "@shared/triage";
import type { TriagePile } from "@shared/triage";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Archive,
  Inbox,
  Mail,
  PenLine,
  Send,
  ShoppingBag,
  Tag,
  Trash,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const FOLDERS: { folder: string; label: string; icon: LucideIcon }[] = [
  { folder: "inbox", label: "Inbox", icon: Inbox },
  { folder: "suspicious", label: "Suspicious", icon: AlertTriangle },
  { folder: "newsletters", label: "Newsletters", icon: Mail },
  { folder: "promotions", label: "Promotions", icon: ShoppingBag },
  { folder: "social", label: "Social", icon: Users },
  { folder: "sent", label: "Sent", icon: Send },
  { folder: "archive", label: "Archive", icon: Archive },
  { folder: "trash", label: "Trash", icon: Trash },
  { folder: "spam", label: "Spam", icon: Tag },
];

const PILES: TriagePile[] = ["needs-reply", "fyi", "low"];

export default function Sidebar() {
  const search = useSearch();
  const { triaged } = useInboxState();
  const { data: emails = [] } = useEmails();
  const folderParam = search.match(/folder=([^&]+)/)?.[1];
  const folder = folderParam ? decodeURIComponent(folderParam) : "inbox";
  const pileParam = search.match(/pile=([^&]+)/)?.[1];
  const activePile = pileParam ? decodeURIComponent(pileParam) : null;

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const email of emails) {
      counts.set(email.folder, (counts.get(email.folder) ?? 0) + 1);
    }
    return counts;
  }, [emails]);

  // Piles are counted inside the folder on screen; before triage the
  // redesign shows a dash instead of a number.
  const pileCounts = useMemo(() => {
    if (!triaged) return null;
    const counts: Record<TriagePile, number> = {
      "needs-reply": 0,
      fyi: 0,
      low: 0,
    };
    for (const email of emails) {
      if (email.folder !== folder) continue;
      counts[triageMessage(email).pile] += 1;
    }
    return counts;
  }, [triaged, emails, folder]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-white dark:bg-zinc-900">
      <div className="p-3">
        <Button
          className="w-full justify-start gap-2"
          onClick={() => setComposeOpen(true)}
        >
          <PenLine className="h-4 w-4" />
          New Email
        </Button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <div>
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Folders
          </p>
          <ul className="space-y-0.5">
            {FOLDERS.map(({ folder: folderName, label, icon: Icon }) => {
              const active = folder === folderName;
              const count = folderCounts.get(folderName) ?? 0;
              return (
                <li key={folderName}>
                  <Link
                    href={
                      folderName === "inbox" ? "/" : `/?folder=${folderName}`
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      active
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{label}</span>
                    <span className="text-xs tabular-nums">{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Triage piles
          </p>
          <ul className="space-y-0.5">
            {PILES.map((pile) => {
              const active = activePile === pile;
              const count = pileCounts ? pileCounts[pile] : null;
              return (
                <li key={pile}>
                  <Link
                    href={`/?folder=${folder}&pile=${pile}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      active
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <span className="flex-1">{TRIAGE_PILE_LABELS[pile]}</span>
                    <span className="text-xs tabular-nums">
                      {count ?? "–"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {!triaged && (
            <p className="px-2 pt-1 text-xs text-muted-foreground">
              Run triage to sort this folder into piles.
            </p>
          )}
        </div>
      </nav>
    </aside>
  );
}
