
export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Extract a readable error message from an API response.
 */
function getErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const body = data as Record<string, unknown>;

  if (typeof body.error === "string") {
    return body.error;
  }

  if (
    body.error &&
    typeof body.error === "object" &&
    "message" in body.error
  ) {
    const nestedMessage = (
      body.error as Record<string, unknown>
    ).message;

    if (typeof nestedMessage === "string") {
      return nestedMessage;
    }
  }

  if (typeof body.message === "string") {
    return body.message;
  }

  return null;
}

/**
 * Shared HTTP client for Discord Link Hunter.
 *
 * Relative /api URLs use the current website origin.
 * Next.js may forward them to a separate backend
 * through a rewrite configured in next.config.mjs.
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const targetUrl = /^https?:\/\//i.test(endpoint)
    ? endpoint
    : endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;

  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  // Add JSON Content-Type only for string request bodies.
  // Do not override FormData or other body formats.
  if (
    typeof options.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(targetUrl, {
      ...options,
      headers,
    });

    const status = response.status;
    const contentType = (
      response.headers.get("content-type") || ""
    ).toLowerCase();

    // Successful responses that intentionally have no body.
    if (status === 204 || status === 205) {
      return {
        ok: true,
        status,
      };
    }

    const responseText = await response.text();

    if (!responseText.trim()) {
      return {
        ok: false,
        status,
        error: response.ok
          ? `API returned an empty response from ${targetUrl}.`
          : `HTTP ${status}: ${
              response.statusText || "Request failed"
            }. The server returned an empty response.`,
      };
    }

    // Detect an HTML response before attempting JSON parsing.
    const isJson =
      contentType.includes("application/json") ||
      contentType.includes("+json");

    if (!isJson) {
      const isHtml =
        contentType.includes("text/html") ||
        /^\s*<!doctype html/i.test(responseText) ||
        /^\s*<html/i.test(responseText);

      return {
        ok: false,
        status,
        error: isHtml
          ? `HTTP ${status}: The API returned HTML instead of JSON. Check the API route, Next.js proxy, and backend server logs.`
          : `HTTP ${status}: Unexpected response format (${contentType || "unknown"}). Expected JSON.`,
      };
    }

    let parsedData: unknown;

    try {
      parsedData = JSON.parse(responseText);
    } catch {
      return {
        ok: false,
        status,
        error: `HTTP ${status}: The server returned malformed JSON.`,
      };
    }

    if (!response.ok) {
      const serverError = getErrorMessage(parsedData);

      return {
        ok: false,
        status,
        data: parsedData as T,
        error:
          serverError ||
          `HTTP ${status}: ${
            response.statusText || "Request failed"
          }`,
      };
    }

    return {
      ok: true,
      status,
      data: parsedData as T,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown network error";

    return {
      ok: false,
      status: 0,
      error: `Unable to reach ${targetUrl}. Check that the frontend, API server, and proxy are running correctly. Details: ${message}`,
    };
  }
}
