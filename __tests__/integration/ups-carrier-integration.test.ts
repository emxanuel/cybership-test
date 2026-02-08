/**
 * Integration tests for UPS carrier with realistic API payloads
 * Tests end-to-end flow: request building → HTTP → response parsing
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UpsCarrier } from "../../infra/carriers/ups/ups-carrier.js";
import { clearUpsTokenCache, type UpsAuthConfig } from "../../infra/auth/ups-auth.js";
import { FetchError } from "../../infra/http/fetch-client.js";

describe("UPS Carrier Integration", () => {
  const mockFetch = vi.fn();
  const mockConfig = {
    auth: {
      clientId: "test-client-id",
      clientSecret: "test-secret",
      baseUrl: "https://wwwcie.ups.com",
    } as UpsAuthConfig,
    shipperNumber: "123456",
  };

  beforeEach(() => {
    global.fetch = mockFetch;
    clearUpsTokenCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearUpsTokenCache();
    vi.clearAllMocks();
  });

  describe("End-to-end rate request flow", () => {
    it("should handle complete successful rate request with OAuth and parsing", async () => {
      clearUpsTokenCache();
      
      // Mock OAuth token request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
            token_type: "Bearer",
            expires_in: 14400,
            issued_at: "2024-01-01T00:00:00Z",
            status: "approved",
          }),
      });

      // Mock rate API request with realistic UPS response from documentation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            RateResponse: {
              Response: {
                ResponseStatus: {
                  Code: "1",
                  Description: "Success",
                },
                Alert: {
                  Code: "110971",
                  Description: "Your invoice may vary from the displayed reference rates",
                },
              },
              RatedShipment: {
                Service: {
                  Code: "03",
                  Description: "UPS Ground",
                },
                RatedShipmentAlert: {
                  Code: "110971",
                  Description: "Your invoice may vary from the displayed reference rates",
                },
                BillingWeight: {
                  UnitOfMeasurement: {
                    Code: "LBS",
                    Description: "Pounds",
                  },
                  Weight: "1.0",
                },
                TransportationCharges: {
                  CurrencyCode: "USD",
                  MonetaryValue: "11.63",
                },
                ServiceOptionsCharges: {
                  CurrencyCode: "USD",
                  MonetaryValue: "0.00",
                },
                TotalCharges: {
                  CurrencyCode: "USD",
                  MonetaryValue: "11.63",
                },
                NegotiatedRateCharges: {
                  ItemizedCharges: [
                    {
                      Code: "375",
                      Description: "Fuel Surcharge",
                      CurrencyCode: "USD",
                      MonetaryValue: "1.09",
                    },
                  ],
                  TotalCharge: {
                    CurrencyCode: "USD",
                    MonetaryValue: "10.88",
                  },
                },
                RatedPackage: {
                  TransportationCharges: {
                    CurrencyCode: "USD",
                    MonetaryValue: "11.63",
                  },
                  ServiceOptionsCharges: {
                    CurrencyCode: "USD",
                    MonetaryValue: "0.00",
                  },
                  TotalCharges: {
                    CurrencyCode: "USD",
                    MonetaryValue: "11.63",
                  },
                  Weight: "1.0",
                  BillingWeight: {
                    UnitOfMeasurement: {
                      Code: "LBS",
                      Description: "Pounds",
                    },
                    Weight: "1.0",
                  },
                },
              },
            },
          }),
      });

      const carrier = new UpsCarrier(mockConfig);
      const quote = await carrier.getRates("21093", "30005", 1);

      // Verify OAuth request was made correctly
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        "https://wwwcie.ups.com/security/v1/oauth/token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            "Content-Type": "application/x-www-form-urlencoded",
            "x-merchant-id": "test-client-id",
          }),
          body: "grant_type=client_credentials",
        })
      );

      // Verify rate request was made with proper structure
      const rateCall = mockFetch.mock.calls[1];
      expect(rateCall[0]).toBe(
        "https://wwwcie.ups.com/api/rating/v2403/rate?additionalinfo="
      );
      expect(rateCall[1].method).toBe("POST");
      expect(rateCall[1].headers.Authorization).toBe("Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...");

      const requestBody = JSON.parse(rateCall[1].body);
      expect(requestBody.RateRequest.Shipment.ShipFrom.Address.PostalCode).toBe("21093");
      expect(requestBody.RateRequest.Shipment.ShipTo.Address.PostalCode).toBe("30005");
      expect(requestBody.RateRequest.Shipment.Package.PackageWeight.Weight).toBe("1");
      expect(requestBody.RateRequest.Shipment.Shipper.ShipperNumber).toBe("123456");

      // Verify response was parsed correctly into normalized quote
      expect(quote).toEqual({
        serviceCode: "03",
        serviceName: "UPS Ground",
        totalPrice: 10.88, // Uses negotiated rate
        currency: "USD",
        breakdown: {
          basePrice: 11.63, // Standard rate
          fuelSurcharge: 1.09,
          other: 10.88, // Negotiated total
        },
      });
    });

    it("should reuse cached OAuth token for multiple requests", async () => {
      clearUpsTokenCache();
      
      // Mock OAuth token request once
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "cached-token",
            token_type: "Bearer",
            expires_in: 14400,
          }),
      });

      // Mock two rate requests
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              RateResponse: {
                RatedShipment: {
                  Service: { Code: "03" },
                  TotalCharges: {
                    CurrencyCode: "USD",
                    MonetaryValue: "10.00",
                  },
                },
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              RateResponse: {
                RatedShipment: {
                  Service: { Code: "01" },
                  TotalCharges: {
                    CurrencyCode: "USD",
                    MonetaryValue: "50.00",
                  },
                },
              },
            }),
        });

      const carrier = new UpsCarrier(mockConfig);

      await carrier.getRates("12345", "67890", 5);
      await carrier.getRates("11111", "22222", 10);

      // OAuth should only be called once, rates called twice
      const oauthCalls = mockFetch.mock.calls.filter((call) =>
        call[0].includes("/oauth/token")
      );
      const rateCalls = mockFetch.mock.calls.filter((call) =>
        call[0].includes("/rating/")
      );

      expect(oauthCalls).toHaveLength(1);
      expect(rateCalls).toHaveLength(2);
      expect(rateCalls[1][1].headers.Authorization).toBe("Bearer cached-token");
    });
  });

  describe("Error handling", () => {
    it("should handle 401 Unauthorized with structured error", async () => {
      clearUpsTokenCache();
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () =>
          JSON.stringify({
            response: {
              errors: [
                {
                  code: "10400",
                  message: "Invalid/Missing Authorization Header",
                },
              ],
            },
          }),
      });

      const carrier = new UpsCarrier(mockConfig);

      await expect(carrier.getRates("12345", "67890", 5)).rejects.toThrow(
        /401 Unauthorized/
      );
    });

    it("should handle 400 Bad Request with validation errors", async () => {
      clearUpsTokenCache();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "token-for-400-test",
            expires_in: 14400,
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () =>
          JSON.stringify({
            response: {
              errors: [
                {
                  code: "250003",
                  message: "Invalid Shipper Number",
                },
              ],
            },
          }),
      });

      const carrier = new UpsCarrier(mockConfig);

      try {
        await carrier.getRates("12345", "67890", 5);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(FetchError);
        expect((error as Error).message).toMatch(/400 Bad Request/);
      }
    });

    it("should handle 500 Internal Server Error", async () => {
      clearUpsTokenCache();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "token",
            expires_in: 14400,
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Internal server error occurred",
      });

      const carrier = new UpsCarrier(mockConfig);

      await expect(carrier.getRates("12345", "67890", 5)).rejects.toThrow(
        /500 Internal Server Error/
      );
    });

    it("should handle malformed JSON response", async () => {
      clearUpsTokenCache();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "token",
            expires_in: 14400,
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "not valid json {",
      });

      const carrier = new UpsCarrier(mockConfig);

      try {
        await carrier.getRates("12345", "67890", 5);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(FetchError);
        expect((error as Error).message).toMatch(/Invalid JSON response/);
      }
    });

    it("should handle network timeout/failure", async () => {
      clearUpsTokenCache();
      
      mockFetch.mockRejectedValueOnce(new Error("Network request failed"));

      const carrier = new UpsCarrier(mockConfig);

      await expect(carrier.getRates("12345", "67890", 5)).rejects.toThrow(
        /Network request failed/
      );
    });

    it("should handle missing RatedShipment in response", async () => {
      clearUpsTokenCache();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "token",
            expires_in: 14400,
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            RateResponse: {
              Response: {
                ResponseStatus: {
                  Code: "1",
                  Description: "Success",
                },
              },
              // No RatedShipment
            },
          }),
      });

      const carrier = new UpsCarrier(mockConfig);
      const quote = await carrier.getRates("12345", "67890", 5);

      // Should return default quote when no rated shipment
      expect(quote).toEqual({
        serviceCode: "ups",
        serviceName: "UPS",
        totalPrice: 0,
        currency: "USD",
      });
    });
  });

  describe("Request payload validation", () => {
    it("should build correct request with all required UPS fields", async () => {
      clearUpsTokenCache();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "token",
            expires_in: 14400,
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            RateResponse: {
              RatedShipment: {
                Service: { Code: "03" },
                TotalCharges: {
                  CurrencyCode: "USD",
                  MonetaryValue: "10.00",
                },
              },
            },
          }),
      });

      const carrier = new UpsCarrier(mockConfig);
      await carrier.getRates("21093", "30005", 10);

      const rateCall = mockFetch.mock.calls[1];
      const requestBody = JSON.parse(rateCall[1].body);

      // Verify all required UPS API fields are present
      expect(requestBody.RateRequest).toBeDefined();
      expect(requestBody.RateRequest.Request).toBeDefined();
      expect(requestBody.RateRequest.Request.TransactionReference).toBeDefined();
      expect(requestBody.RateRequest.Shipment).toBeDefined();
      expect(requestBody.RateRequest.Shipment.Shipper).toBeDefined();
      expect(requestBody.RateRequest.Shipment.Shipper.ShipperNumber).toBe("123456");
      expect(requestBody.RateRequest.Shipment.ShipFrom).toBeDefined();
      expect(requestBody.RateRequest.Shipment.ShipTo).toBeDefined();
      expect(requestBody.RateRequest.Shipment.PaymentDetails).toBeDefined();
      expect(requestBody.RateRequest.Shipment.Service).toBeDefined();
      expect(requestBody.RateRequest.Shipment.Package).toBeDefined();
      expect(requestBody.RateRequest.Shipment.Package.PackagingType).toBeDefined();
      expect(requestBody.RateRequest.Shipment.Package.Dimensions).toBeDefined();
      expect(requestBody.RateRequest.Shipment.Package.PackageWeight).toBeDefined();
    });

    it("should include proper headers for UPS API", async () => {
      clearUpsTokenCache();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "test-token",
            expires_in: 14400,
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            RateResponse: {
              RatedShipment: {
                Service: { Code: "03" },
                TotalCharges: { CurrencyCode: "USD", MonetaryValue: "10.00" },
              },
            },
          }),
      });

      const carrier = new UpsCarrier(mockConfig);
      await carrier.getRates("12345", "67890", 5);

      const rateCall = mockFetch.mock.calls[1];
      expect(rateCall[1].headers).toEqual(
        expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
          transactionSrc: "testing",
          transId: expect.any(String),
        })
      );
      expect(rateCall[1].headers.transId).toHaveLength(32);
    });
  });

  describe("Response normalization", () => {
    it("should normalize multiple rated shipments (Shop response)", async () => {
      clearUpsTokenCache();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "token",
            expires_in: 14400,
          }),
      });

      // UPS Shop API returns multiple services
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            RateResponse: {
              RatedShipment: [
                {
                  Service: {
                    Code: "03",
                    Description: "UPS Ground",
                  },
                  TotalCharges: {
                    CurrencyCode: "USD",
                    MonetaryValue: "11.63",
                  },
                },
                {
                  Service: {
                    Code: "02",
                    Description: "UPS 2nd Day Air",
                  },
                  TotalCharges: {
                    CurrencyCode: "USD",
                    MonetaryValue: "35.50",
                  },
                },
                {
                  Service: {
                    Code: "01",
                    Description: "UPS Next Day Air",
                  },
                  TotalCharges: {
                    CurrencyCode: "USD",
                    MonetaryValue: "78.25",
                  },
                },
              ],
            },
          }),
      });

      const carrier = new UpsCarrier(mockConfig);
      const quote = await carrier.getRates("12345", "67890", 5);

      // Should return first (cheapest/ground) service
      expect(quote.serviceCode).toBe("03");
      expect(quote.serviceName).toBe("UPS Ground");
      expect(quote.totalPrice).toBe(11.63);
      expect(quote.currency).toBe("USD");
    });

    it("should handle international shipment with different currency", async () => {
      clearUpsTokenCache();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "token",
            expires_in: 14400,
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            RateResponse: {
              RatedShipment: {
                Service: {
                  Code: "11",
                  Description: "UPS Standard",
                },
                TotalCharges: {
                  CurrencyCode: "EUR",
                  MonetaryValue: "45.80",
                },
              },
            },
          }),
      });

      const carrier = new UpsCarrier(mockConfig);
      const quote = await carrier.getRates("10115", "12345", 5);

      expect(quote.serviceCode).toBe("11");
      expect(quote.serviceName).toBe("UPS Standard");
      expect(quote.currency).toBe("EUR");
      expect(quote.totalPrice).toBe(45.8);
    });
  });
});
