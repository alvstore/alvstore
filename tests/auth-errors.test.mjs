import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/auth-errors.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { signInFailure } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("only a credentials rejection is described as an invalid password", () => {
  assert.deepEqual(signInFailure("CredentialsSignin", "credentials"), {
    code: "AUTH_INVALID_CREDENTIALS", message: "Invalid email or password.",
  });
});

test("missing CSRF reports a browser security/cookie failure with a safe fallback", () => {
  const error = signInFailure("MissingCSRF");
  assert.equal(error.code, "AUTH_COOKIES_BLOCKED");
  assert.match(error.message, /security check/);
  assert.match(error.message, /new tab/);
  assert.doesNotMatch(error.message, /invalid|password/i);
});

test("provider, network and unknown failures do not blame the password or leak details", () => {
  for (const error of [signInFailure("CredentialsSignin", "service_unavailable"), signInFailure("Configuration"), signInFailure("CallbackRouteError"), signInFailure("private internal exception"), signInFailure()]) {
    assert.equal(error.code, "AUTH_UNAVAILABLE");
    assert.match(error.message, /temporarily unavailable/);
    assert.doesNotMatch(error.message, /invalid|password|private|exception/i);
  }
});

test("a successful callback without a retained session is not a successful login", () => {
  const error = signInFailure("SessionUnavailable");
  assert.equal(error.code, "AUTH_SESSION_UNAVAILABLE");
  assert.match(error.message, /session could not be saved/);
  assert.match(error.message, /new tab/);
});
