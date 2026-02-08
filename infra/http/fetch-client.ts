export interface FetchClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export class FetchClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: FetchClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.defaultHeaders = config.defaultHeaders ?? {};
  }

  private buildUrl(pathOrUrl: string, query?: Record<string, string>): string {
    const path = pathOrUrl.startsWith("http") ? pathOrUrl : `${this.baseUrl}/${pathOrUrl.replace(/^\//, "")}`;
    if (!query || Object.keys(query).length === 0) return path;
    const search = new URLSearchParams(query).toString();
    return `${path}${path.includes("?") ? "&" : "?"}${search}`;
  }

  private mergeHeaders(overrides?: Record<string, string>): Record<string, string> {
    return { ...this.defaultHeaders, ...overrides };
  }

  async request<T>(
    method: string,
    pathOrUrl: string,
    options: RequestOptions & { body?: unknown } = {}
  ): Promise<T> {
    const { headers = {}, query, body } = options;
    const url = this.buildUrl(pathOrUrl, query);
    const mergedHeaders = this.mergeHeaders(headers);

    const init: RequestInit = {
      method,
      headers: mergedHeaders,
    };
    if (body !== undefined) {
      init.body = typeof body === "string" ? body : JSON.stringify(body);
      if (typeof body !== "string" && !mergedHeaders["Content-Type"]) {
        (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      }
    }

    const res = await fetch(url, init);
    const text = await res.text();

    if (!res.ok) {
      throw new FetchError(
        `Request failed: ${res.status} ${res.statusText}`,
        res.status,
        res.statusText,
        text
      );
    }

    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new FetchError(
        "Invalid JSON response",
        res.status,
        res.statusText,
        text
      );
    }
  }

  async get<T>(pathOrUrl: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", pathOrUrl, options);
  }

  async post<T>(pathOrUrl: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("POST", pathOrUrl, { ...options, body });
  }

  async put<T>(pathOrUrl: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("PUT", pathOrUrl, { ...options, body });
  }

  async patch<T>(pathOrUrl: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("PATCH", pathOrUrl, { ...options, body });
  }

  async delete<T>(pathOrUrl: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("DELETE", pathOrUrl, options);
  }
}
