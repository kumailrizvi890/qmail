import { MailX, Send, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecurityStats } from "@/hooks/use-emails";

// One slim strip of the real counts, no cards and no made-up trends.
// The backend calls the third number "encrypted", but it is just a count
// of the folder named "sent", so it is labelled as sent mail here.
export default function SecurityStats() {
  const { data: stats, isLoading, error } = useSecurityStats();

  if (isLoading) return <SecurityStatsSkeleton />;

  if (error) {
    return (
      <p className="border-b px-4 py-2 text-sm text-red-600 dark:text-red-400">
        Could not load the security numbers.
      </p>
    );
  }

  const scamBlocked = stats?.scamBlocked ?? 0;
  const unsubscribeCount = stats?.unsubscribeCount ?? 0;
  const sent = stats?.encrypted ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b px-4 py-2 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <ShieldAlert className="h-4 w-4 text-red-500" />
        <strong className="font-semibold text-foreground">{scamBlocked}</strong>
        {scamBlocked === 1 ? "scam" : "scams"} blocked
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MailX className="h-4 w-4 text-amber-500" />
        <strong className="font-semibold text-foreground">
          {unsubscribeCount}
        </strong>
        {unsubscribeCount === 1 ? "unsubscribe" : "unsubscribes"} suggested
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Send className="h-4 w-4 text-green-500" />
        <strong className="font-semibold text-foreground">{sent}</strong>
        sent
      </span>
    </div>
  );
}

function SecurityStatsSkeleton() {
  return (
    <div className="flex items-center gap-6 border-b px-4 py-2">
      {[1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-4 w-28" />
      ))}
    </div>
  );
}
