// The serverless function for the main API. It re-exports the handler
// from api-src so Vercel builds it from source on every deploy instead
// of serving a bundle committed to the repo.
export { default } from "../api-src/index.ts";
