export interface SignInFailure {
  code: "AUTH_INVALID_CREDENTIALS" | "AUTH_COOKIES_BLOCKED" | "AUTH_SESSION_UNAVAILABLE" | "AUTH_UNAVAILABLE";
  message: string;
}

/** Only an actual credentials rejection should tell someone their password is wrong. */
export function signInFailure(error?: string, code?: string): SignInFailure {
  if (error === "MissingCSRF") {
    return {
      code: "AUTH_COOKIES_BLOCKED",
      message: "Your browser could not complete the sign-in security check. Reload and try again, or open sign-in in a new tab if cookies are blocked.",
    };
  }
  if (error === "SessionUnavailable") {
    return {
      code: "AUTH_SESSION_UNAVAILABLE",
      message: "Sign-in completed, but the session could not be saved. Open sign-in in a new tab or allow cookies for this site, then try again.",
    };
  }
  if (error === "CredentialsSignin" && code !== "service_unavailable") {
    return { code: "AUTH_INVALID_CREDENTIALS", message: "Invalid email or password." };
  }
  // Do not expose provider exceptions, submitted credentials or internal URLs.
  return { code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable. Please try again shortly." };
}
