import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";

// Vercel serverless entry point.
//
// The original app was a long-running Express process (server/index.ts,
// server.listen on port 5000) - that shape doesn't exist on Vercel, where
// each request is routed to a stateless function. This wraps the same
// Express app/routes in a handler Vercel can invoke per request instead of
// a process that listens forever. Static frontend assets are served
// separately by Vercel from the Vite build output (see vercel.json) - this
// function only needs to answer /api/*.

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

// registerRoutes is async (it awaits setupAuth) but only needs to run once
// per cold start - cache the promise so warm invocations skip straight to
// the already-configured app.
let readyPromise: Promise<unknown> | null = null;
function ready() {
  if (!readyPromise) {
    readyPromise = registerRoutes(app);
  }
  return readyPromise;
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

export default async function handler(req: Request, res: Response) {
  await ready();
  app(req, res);
}
