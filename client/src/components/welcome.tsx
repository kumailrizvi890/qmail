import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, Layers, Shield } from "lucide-react";

export default function Welcome() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setIsLoading(true);
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950 animate-fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">Your inbox, already triaged.</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Open it and the mail has sorted itself into piles, with one line
            on each message and a draft reply waiting when you open one.
          </p>
        </div>
        <div className="space-y-4 mb-8">
          <Card className="p-4 bg-neutral-100 dark:bg-neutral-900">
            <div className="flex items-center mb-2">
              <Layers className="h-5 w-5 text-primary mr-2" />
              <h3 className="font-semibold">Triages itself</h3>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Run triage and the inbox sorts into piles: needs a reply,
              worth a read, low priority. Every message gets a one-line
              summary and a next step.
            </p>
          </Card>
          <Card className="p-4 bg-neutral-100 dark:bg-neutral-900">
            <div className="flex items-center mb-2">
              <Bot className="h-5 w-5 text-primary mr-2" />
              <h3 className="font-semibold">Drafts the reply</h3>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Open a message that needs an answer and a draft reply is
              already writing itself. Use it, edit it, send it.
            </p>
          </Card>
          <Card className="p-4 bg-neutral-100 dark:bg-neutral-900">
            <div className="flex items-center mb-2">
              <Shield className="h-5 w-5 text-primary mr-2" />
              <h3 className="font-semibold">Still flags the scams</h3>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              The scam detection is still here: spoofed senders and phishing
              get flagged before you ever reply.
            </p>
          </Card>
        </div>
        <Button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-6 font-medium"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-b-transparent rounded-full animate-spin mr-2"></div>
              Loading demo...
            </>
          ) : (
            <>Enter the Demo</>
          )}
        </Button>
        <div className="mt-4 text-center">
          <p className="text-xs text-neutral-500">By continuing, you agree to our <a href="#" className="text-primary">Terms of Service</a> and <a href="#" className="text-primary">Privacy Policy</a></p>
        </div>
        <p className="mt-6 text-center text-xs text-neutral-500">
          Built as a team project for the WSU Hackathon 2025, where it placed
          5th.{" "}
          <a
            href="https://github.com/garv-seth/qmail"
            target="_blank"
            rel="noreferrer"
            className="text-primary"
          >
            See the original team repo
          </a>
          .
        </p>
      </div>
    </div>
  );
}
