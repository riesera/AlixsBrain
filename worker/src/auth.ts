import { secretsMatch } from "./telegram";
import type { Env } from "./types";

export function isDashboardAuthorized(request: Request, env: Env): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return false;

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return secretsMatch(username, env.DASHBOARD_USERNAME) &&
      secretsMatch(password, env.DASHBOARD_PASSWORD);
  } catch {
    return false;
  }
}

export function authenticationRequired(): Response {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="AlixsBrain", charset="UTF-8"',
      "cache-control": "no-store"
    }
  });
}
