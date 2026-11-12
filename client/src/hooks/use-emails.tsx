import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Email } from "@/types/email";

// Hook to fetch emails, optionally filtered by folder
export function useEmails(folder?: string) {
  const url = folder
    ? `/api/emails?folder=${encodeURIComponent(folder)}`
    : "/api/emails";

  return useQuery<Email[]>({
    queryKey: [url],
    retry: 1,
  });
}

// Hook to fetch a single email by id
export function useEmail(id: string | number) {
  return useQuery<Email>({
    queryKey: [`/api/emails/${id}`],
    enabled: !!id,
  });
}

// Every query that reads email data starts with "/api/emails": the full
// list, the folder lists ("/api/emails?folder=inbox") and single messages
// ("/api/emails/seed-1"). Invalidating by one exact key missed the folder
// lists, so marking a message read never showed up there.
function invalidateEmailQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === "string" && key.startsWith("/api/emails");
    },
  });
}

// Hook to update an email
export function useUpdateEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string | number;
      data: Partial<Email>;
    }) => {
      const res = await apiRequest("PATCH", `/api/emails/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateEmailQueries(queryClient);
    },
  });
}

// Hook to send an email. It lands in Sent; the demo mailbox never sends
// real mail.
export function useSendEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { to: string; subject: string; body: string }) => {
      const res = await apiRequest("POST", "/api/emails", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateEmailQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["/api/security-stats"] });
    },
  });
}

// Type definition for security stats
export interface SecurityStats {
  scamBlocked: number;
  encrypted: number;
  unsubscribeCount: number;
}

// Hook to fetch security stats
export function useSecurityStats() {
  return useQuery<SecurityStats>({
    queryKey: ["/api/security-stats"],
  });
}

// Hook for email analysis
export function useAnalyzeEmail() {
  return useMutation({
    mutationFn: async (emailData: {
      from: string;
      subject: string;
      body: string;
    }) => {
      const res = await apiRequest("POST", "/api/emails/analyze", emailData);
      return res.json();
    },
  });
}

// Hook to generate unsubscribe emails
export function useGenerateUnsubscribe() {
  return useMutation({
    mutationFn: async (data: {
      to: string;
      fromName: string;
      serviceDescription: string;
    }) => {
      const res = await apiRequest("POST", "/api/generate-unsubscribe", data);
      return res.json();
    },
  });
}
