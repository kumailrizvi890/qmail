import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Bot, Lock } from "lucide-react";

export default function Welcome() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setIsLoading(true);
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950 animate-fade-in">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 dark:bg-primary/20 mb-6">
            <svg 
              className="h-8 w-8 text-primary" 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to QMail</h1>
          <p className="text-neutral-600 dark:text-neutral-400">Your Quantum Shield for Smarter Email</p>
        </div>
        
        <div className="space-y-4 mb-8">
          <Card className="p-4 bg-neutral-100 dark:bg-neutral-900">
            <div className="flex items-center mb-2">
              <Shield className="h-5 w-5 text-primary mr-2" />
              <h3 className="font-semibold">Privacy-Focused</h3>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Your emails never leave your device. All processing happens locally.</p>
          </Card>
          
          <Card className="p-4 bg-neutral-100 dark:bg-neutral-900">
            <div className="flex items-center mb-2">
              <Bot className="h-5 w-5 text-primary mr-2" />
              <h3 className="font-semibold">AI-Powered Protection</h3>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Advanced AI scans for scams, phishing, and unwanted subscriptions.</p>
          </Card>
          
          <Card className="p-4 bg-neutral-100 dark:bg-neutral-900">
            <div className="flex items-center mb-2">
              <Lock className="h-5 w-5 text-primary mr-2" />
              <h3 className="font-semibold">Quantum-Enhanced Security</h3>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Azure Quantum integration for next-level encryption and protection.</p>
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
      </div>
    </div>
  );
}
