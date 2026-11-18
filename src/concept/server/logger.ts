import { randomUUID } from "node:crypto";

// Structured logging for /api/concept/*. One JSON line per request with a
// fixed set of fields. Request bodies, query strings, keys, error messages and
// anything that could be personal data have no way into the line: the logger
// only accepts the fields below and copies them one by one.

export interface RequestLogFields {
  requestId: string;
  /** The route pattern, e.g. "/api/concept/ai/[task]", never the real URL. */
  route: string;
  method: string;
  status: number;
  durationMs: number;
  /** Name of an AI task from the registry. */
  task?: string;
  /** Name of a concept tool called over MCP. */
  tool?: string;
  /** Class name of an unexpected error, never its message. */
  error?: string;
}

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const NAME = /^[a-z][a-z0-9-]{0,39}$/;
const TOOL = /^[a-z][a-z0-9_]{0,39}$/;
const ERROR_NAME = /^[A-Za-z][A-Za-z0-9]{0,39}$/;

/** A caller's own id when it looks like one, otherwise a new one. */
export function requestIdFor(request: Request): string {
  const given = request.headers.get("x-request-id");
  return given && ID.test(given) ? given : randomUUID();
}

export function formatLogLine(fields: RequestLogFields): string {
  const level = fields.status >= 500 ? "error" : fields.status >= 400 ? "warn" : "info";
  return JSON.stringify({
    level,
    msg: "request",
    requestId: ID.test(fields.requestId) ? fields.requestId : "invalid",
    route: fields.route,
    method: fields.method,
    status: fields.status,
    durationMs: Math.round(fields.durationMs),
    ...(fields.task && NAME.test(fields.task) ? { task: fields.task } : {}),
    ...(fields.tool && TOOL.test(fields.tool) ? { tool: fields.tool } : {}),
    ...(fields.error && ERROR_NAME.test(fields.error) ? { error: fields.error } : {}),
  });
}

/** What a handler can add to its log line. */
export interface RequestLogContext {
  task?: string;
  tool?: string;
}

type Handler<Context> = (request: Request, context: Context, log: RequestLogContext) => Response | Promise<Response>;

/** Wraps a route handler: request id in, `x-request-id` out, one log line per call. */
export function withRequestLog<Context>(route: string, handler: Handler<Context>, write: (line: string) => void = (line) => console.log(line)) {
  return async (request: Request, context: Context): Promise<Response> => {
    const requestId = requestIdFor(request);
    const started = performance.now();
    const log: RequestLogContext = {};
    let response: Response;
    let error: string | undefined;
    try {
      response = await handler(request, context, log);
    } catch (caught) {
      error = caught instanceof Error ? caught.constructor.name : "Error";
      response = Response.json({ error: "Unable to handle the request" }, { status: 500 });
    }
    response.headers.set("x-request-id", requestId);
    write(formatLogLine({ requestId, route, method: request.method, status: response.status, durationMs: performance.now() - started, task: log.task, tool: log.tool, error }));
    return response;
  };
}
