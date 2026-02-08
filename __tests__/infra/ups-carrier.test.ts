import { describe, it, expect, beforeEach, vi } from "vitest";
import { UpsCarrier } from "../../infra/carriers/ups/ups-carrier.js";
import type { UpsAuthConfig } from "../../infra/auth/ups-auth.js";
import { FetchClient } from "../../infra/http/fetch-client.js";

vi.mock("../../infra/auth/ups-auth.js", () => ({
  getUpsAuthorizationHeader: vi.fn(async () => "Bearer mock-token"),
}));

describe("UpsCarrier", () => {
  let carrier: UpsCarrier;
  let mockClient: FetchClient;
  const mockPost = vi.fn();

  const mockConfig = {
    auth: {
      clientId: "test-client",
      clientSecret: "test-secret",
      baseUrl: "https://wwwcie.ups.com",
    } as UpsAuthConfig,
    shipperNumber: "123456",
  };

  beforeEach(() => {
    mockClient = {
      post: mockPost,
    } as unknown as FetchClient;

    carrier = new UpsCarrier({
      ...mockConfig,
      httpClient: mockClient,
    });

    vi.clearAllMocks();
  });

  describe("getRates", () => {
    it("should request rates with origin and destination", async () => {
      mockPost.mockResolvedValue({
        RateResponse: {
          RatedShipment: {
            Service: { Code: "03", Description: "Ground" },
            TotalCharges: {
              CurrencyCode: "USD",
              MonetaryValue: "25.50",
            },
          },
        },
      });

      const quote = await carrier.getRates("12345", "67890", 10);

      expect(mockPost).toHaveBeenCalledWith(
        "/api/rating/v2403/rate?additionalinfo=",
        expect.objectContaining({
          RateRequest: expect.objectContaining({
            Shipment: expect.objectContaining({
              ShipFrom: expect.objectContaining({
                Address: expect.objectContaining({
                  PostalCode: "12345",
                }),
              }),
              ShipTo: expect.objectContaining({
                Address: expect.objectContaining({
                  PostalCode: "67890",
                }),
              }),
            }),
          }),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
            transactionSrc: "testing",
          }),
        })
      );

      expect(quote).toEqual({
        serviceCode: "03",
        serviceName: "Ground",
        totalPrice: 25.5,
        currency: "USD",
        breakdown: {
          basePrice: 25.5,
          fuelSurcharge: undefined,
          other: undefined,
        },
      });
    });

    it("should use shipper number in request", async () => {
      mockPost.mockResolvedValue({
        RateResponse: {
          RatedShipment: {
            Service: { Code: "03" },
            TotalCharges: { CurrencyCode: "USD", MonetaryValue: "10.00" },
          },
        },
      });

      await carrier.getRates("12345", "67890", 5);

      const requestBody = mockPost.mock.calls[0][1];
      expect(requestBody.RateRequest.Shipment.Shipper.ShipperNumber).toBe(
        "123456"
      );
    });

    it("should include weight in request", async () => {
      mockPost.mockResolvedValue({
        RateResponse: {
          RatedShipment: {
            Service: { Code: "03" },
            TotalCharges: { CurrencyCode: "USD", MonetaryValue: "15.00" },
          },
        },
      });

      await carrier.getRates("12345", "67890", 15);

      const requestBody = mockPost.mock.calls[0][1];
      expect(
        requestBody.RateRequest.Shipment.Package.PackageWeight.Weight
      ).toBe("15");
    });

    it("should default to US country code", async () => {
      mockPost.mockResolvedValue({
        RateResponse: {
          RatedShipment: {
            Service: { Code: "03" },
            TotalCharges: { CurrencyCode: "USD", MonetaryValue: "10.00" },
          },
        },
      });

      await carrier.getRates("12345", "67890", 5);

      const requestBody = mockPost.mock.calls[0][1];
      expect(requestBody.RateRequest.Shipment.ShipFrom.Address.CountryCode).toBe(
        "US"
      );
      expect(requestBody.RateRequest.Shipment.ShipTo.Address.CountryCode).toBe(
        "US"
      );
    });

    it("should include transaction ID in headers", async () => {
      mockPost.mockResolvedValue({
        RateResponse: {
          RatedShipment: {
            Service: { Code: "03" },
            TotalCharges: { CurrencyCode: "USD", MonetaryValue: "10.00" },
          },
        },
      });

      await carrier.getRates("12345", "67890", 5);

      const headers = mockPost.mock.calls[0][2].headers;
      expect(headers.transId).toBeDefined();
      expect(headers.transId).toHaveLength(32);
    });

    it("should handle API errors", async () => {
      mockPost.mockRejectedValue(
        new Error("UPS API error: 500 Internal Server Error")
      );

      await expect(carrier.getRates("12345", "67890", 5)).rejects.toThrow(
        "UPS API error"
      );
    });

    it("should create default client when not provided", () => {
      const carrierWithoutClient = new UpsCarrier(mockConfig);

      expect(carrierWithoutClient).toBeDefined();
    });
  });
});
