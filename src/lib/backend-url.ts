/** Resolve the upstream Express API origin across local dev and shared hosting. */
export function backendServerUrl(): string {
  return (
    process.env.API_SERVER_URL ??
    (process.env.NODE_ENV === "production" ? "http://195.35.46.243:4000" : "http://127.0.0.1:4000")
  );
}
