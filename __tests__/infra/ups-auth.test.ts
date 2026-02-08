import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchUpsAccessToken,
  getUpsAccessToken,
  clearUpsTokenCache,
  type UpsAuthConfig,
} from "../../infra/auth/ups-auth.js";
import { FetchError } from "../../infra/http/fetch-client.js";

describe("UPS OAuth", () => {
  const mockConfig: UpsAuthConfig = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    baseUrl: "https://wwwcie.ups.com",
  };

  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    clearUpsTokenCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    clearUpsTokenCache();
  });

  describe("fetchUpsAccessToken", () => {
    it("should request token with correct credentials", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "test-token",
            token_type: "Bearer",
            expires_in: 14400,
            issued_at: "2024-01-01T00:00:00Z",
            status: "approved",
          }),
      });

      const result = await fetchUpsAccessToken(mockConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://wwwcie.ups.com/security/v1/oauth/token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            "Content-Type": "application/x-www-form-urlencoded",
            "x-merchant-id": "test-client-id",
          }),
        })
      );

      expect(result).toEqual({
        access_token: "test-token",
        token_type: "Bearer",
        expires_in: 14400,
        issued_at: "2024-01-01T00:00:00Z",
        status: "approved",
      });
    });

    it("should encode credentials in Basic auth header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "token",
            expires_in: 14400,
          }),
      });

      await fetchUpsAccessToken(mockConfig);

      const call = mockFetch.mock.calls[0];
      const authHeader = call[1].headers.Authorization;

      expect(authHeader).toMatch(/^Basic /);
    });

    it("should send grant_type=client_credentials", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({ access_token: "token", expires_in: 14400 }),
      });

      await fetchUpsAccessToken(mockConfig);

      const call = mockFetch.mock.calls[0];
      const body = call[1].body;
      expect(body).toContain("grant_type=client_credentials");
    });

    it("should throw FetchError on failed request", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid credentials",
      });

      await expect(fetchUpsAccessToken(mockConfig)).rejects.toThrow(FetchError);
      await expect(fetchUpsAccessToken(mockConfig)).rejects.toThrow(
        /401 Unauthorized/
      );
    });

    it("should throw on invalid response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ invalid: "response" }),
      });

      await expect(fetchUpsAccessToken(mockConfig)).rejects.toThrow(
        "Invalid UPS token response: missing access_token"
      );
    });
  });

  describe("getUpsAccessToken", () => {
    it("should return cached token when still valid", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "cached-token",
            expires_in: 14400,
          }),
      });

      const token1 = await getUpsAccessToken(mockConfig);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const token2 = await getUpsAccessToken(mockConfig);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(token2).toBe(token1);
    });

    it("should refresh token when near expiry", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              access_token: "first-token",
              expires_in: 400,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              access_token: "refreshed-token",
              expires_in: 14400,
            }),
        });

      const token1 = await getUpsAccessToken(mockConfig);
      expect(token1).toBe("first-token");

      vi.advanceTimersByTime(200 * 1000);

      const token2 = await getUpsAccessToken(mockConfig);
      expect(token2).toBe("refreshed-token");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should refresh token when expired", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              access_token: "expired-token",
              expires_in: 100,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              access_token: "new-token",
              expires_in: 14400,
            }),
        });

      const token1 = await getUpsAccessToken(mockConfig);
      expect(token1).toBe("expired-token");

      vi.advanceTimersByTime(200 * 1000);

      const token2 = await getUpsAccessToken(mockConfig);
      expect(token2).toBe("new-token");
    });
  });

  describe("clearUpsTokenCache", () => {
    it("should clear cached token", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "token",
            expires_in: 14400,
          }),
      });

      await getUpsAccessToken(mockConfig);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      clearUpsTokenCache();

      await getUpsAccessToken(mockConfig);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
