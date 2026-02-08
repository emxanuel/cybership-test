import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FetchClient, FetchError } from "../../infra/http/fetch-client.js";

describe("FetchClient", () => {
  let client: FetchClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    client = new FetchClient({
      baseUrl: "https://api.example.com",
      defaultHeaders: { "X-Custom": "header" },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("buildUrl", () => {
    it("should build URL from path and query", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '{"data": "ok"}',
      });

      await client.get("test", { query: { foo: "bar", baz: "qux" } });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/test?foo=bar&baz=qux",
        expect.any(Object)
      );
    });

    it("should handle full URLs", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });

      await client.get("https://other.api.com/resource");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://other.api.com/resource",
        expect.any(Object)
      );
    });

    it("should append query to existing query params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });

      await client.get("test?existing=param", { query: { new: "value" } });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/test?existing=param&new=value",
        expect.any(Object)
      );
    });
  });

  describe("headers", () => {
    it("should merge default and request headers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });

      await client.get("test", { headers: { Authorization: "Bearer token" } });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            "X-Custom": "header",
            Authorization: "Bearer token",
          },
        })
      );
    });

    it("should allow override of default headers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });

      await client.get("test", { headers: { "X-Custom": "override" } });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            "X-Custom": "override",
          },
        })
      );
    });

    it("should add Content-Type for JSON body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });

      await client.post("test", { data: "value" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("HTTP methods", () => {
    it("should perform GET request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '{"result": "data"}',
      });

      const result = await client.get<{ result: string }>("test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual({ result: "data" });
    });

    it("should perform POST request with body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '{"id": 1}',
      });

      const result = await client.post<{ id: number }>("test", {
        name: "test",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: '{"name":"test"}',
        })
      );
      expect(result).toEqual({ id: 1 });
    });

    it("should perform PUT request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });

      await client.put("test/1", { name: "updated" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "PUT" })
      );
    });

    it("should perform PATCH request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });

      await client.patch("test/1", { name: "patched" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("should perform DELETE request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });

      await client.delete("test/1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("error handling", () => {
    it("should throw FetchError on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "Resource not found",
      });

      await expect(client.get("test")).rejects.toThrow(FetchError);
      await expect(client.get("test")).rejects.toThrow(
        "Request failed: 404 Not Found"
      );
    });

    it("should include response body in error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => '{"error": "Invalid input"}',
      });

      try {
        await client.get("test");
      } catch (error) {
        expect(error).toBeInstanceOf(FetchError);
        expect((error as FetchError).status).toBe(400);
        expect((error as FetchError).body).toBe('{"error": "Invalid input"}');
      }
    });

    it("should throw FetchError on invalid JSON", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "not json",
      });

      await expect(client.get("test")).rejects.toThrow(FetchError);
      await expect(client.get("test")).rejects.toThrow("Invalid JSON response");
    });

    it("should return undefined for empty response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "",
      });

      const result = await client.delete("test");

      expect(result).toBeUndefined();
    });
  });

  describe("body handling", () => {
    it("should stringify object body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });

      await client.post("test", { key: "value" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: '{"key":"value"}',
        })
      );
    });

    it("should pass string body as-is", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });

      await client.post("test", "raw string body");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: "raw string body",
        })
      );
    });
  });
});
