import {
  findActiveReviewSession,
  getReviewSession,
  REVIEW_GUIDE,
  ReviewSessionError,
  refreshReviewHealthContext,
  saveReviewAnswer,
  setReviewStepState,
  startReviewSession,
  transitionReviewSession,
  type ReviewInputKind,
  type ReviewResponseKind,
  type ReviewStepState
} from "./review-sessions";
import type { Env } from "./types";
import { createReviewPacket, latestReviewPacket } from "./review-packet";

const json = (value: unknown, status = 200): Response =>
  Response.json(value, { status, headers: { "cache-control": "no-store" } });

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* handled below */ }
  throw new ReviewSessionError("invalid_request", "invalid_json");
}

const requiredString = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new ReviewSessionError("invalid_request", `${name} is required`);
  }
  return value;
};

function errorResponse(error: unknown): Response {
  if (error instanceof ReviewSessionError) {
    const status = error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 400;
    return json({ error: error.message }, status);
  }
  throw error;
}

/** Thin authenticated HTTP adapter; session behavior lives in review-sessions.ts. */
export async function reviewApi(request: Request, env: Env, url: URL): Promise<Response | null> {
  const pathname = url.pathname;
  if (!pathname.startsWith("/api/reviews")) return null;

  try {
    if (request.method === "GET" && pathname === "/api/reviews/guide") {
      return json(REVIEW_GUIDE);
    }

    if (request.method === "POST" && pathname === "/api/reviews") {
      const payload = await body(request);
      const session = await startReviewSession(env.DB, {
        week_start: requiredString(payload.week_start, "week_start"),
        week_end: requiredString(payload.week_end, "week_end"),
        timezone: requiredString(payload.timezone, "timezone")
      });
      return json(session, 201);
    }

    if (request.method === "GET" && pathname === "/api/reviews/active") {
      const session = await findActiveReviewSession(
        env.DB,
        requiredString(url.searchParams.get("week_start"), "week_start"),
        requiredString(url.searchParams.get("week_end"), "week_end"),
        requiredString(url.searchParams.get("timezone"), "timezone")
      );
      return json(session);
    }

    const sessionMatch = pathname.match(/^\/api\/reviews\/([^/]+)$/);
    if (request.method === "GET" && sessionMatch) {
      return json(await getReviewSession(env.DB, decodeURIComponent(sessionMatch[1])));
    }

    const healthMatch = pathname.match(/^\/api\/reviews\/([^/]+)\/health-context$/);
    if (request.method === "PUT" && healthMatch) {
      return json(await refreshReviewHealthContext(env.DB, decodeURIComponent(healthMatch[1])));
    }

    const packetMatch = pathname.match(/^\/api\/reviews\/([^/]+)\/packet$/);
    if (packetMatch && request.method === "GET") {
      return json(await latestReviewPacket(env.DB, decodeURIComponent(packetMatch[1])));
    }
    if (packetMatch && request.method === "POST") {
      return json(await createReviewPacket(env.DB, decodeURIComponent(packetMatch[1])), 201);
    }

    const answerMatch = pathname.match(/^\/api\/reviews\/([^/]+)\/answers\/(\d+)\/([^/]+)$/);
    if (request.method === "PUT" && answerMatch) {
      const payload = await body(request);
      return json(await saveReviewAnswer(env.DB, decodeURIComponent(answerMatch[1]), {
        step: Number(answerMatch[2]),
        field_key: decodeURIComponent(answerMatch[3]),
        response_kind: requiredString(payload.response_kind, "response_kind") as ReviewResponseKind,
        input_kind: payload.input_kind === undefined
          ? undefined
          : requiredString(payload.input_kind, "input_kind") as ReviewInputKind,
        raw_input: payload.raw_input === undefined ? undefined : payload.raw_input as string | null
      }));
    }

    const stepMatch = pathname.match(/^\/api\/reviews\/([^/]+)\/steps\/(\d+)$/);
    if (request.method === "PUT" && stepMatch) {
      const payload = await body(request);
      return json(await setReviewStepState(
        env.DB,
        decodeURIComponent(stepMatch[1]),
        Number(stepMatch[2]),
        requiredString(payload.state, "state") as ReviewStepState
      ));
    }

    const actionMatch = pathname.match(/^\/api\/reviews\/([^/]+)\/actions$/);
    if (request.method === "POST" && actionMatch) {
      const payload = await body(request);
      return json(await transitionReviewSession(
        env.DB,
        decodeURIComponent(actionMatch[1]),
        requiredString(payload.action, "action") as "complete" | "abandon" | "archive" | "restart"
      ), payload.action === "restart" ? 201 : 200);
    }

    return json({ error: "not_found" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
