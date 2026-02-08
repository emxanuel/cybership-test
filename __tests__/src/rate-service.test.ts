import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateService, ValidationError } from "../../src/services/rate-service.js";
import type { IRateProvider } from "../../src/carriers/carrier.interface.js";
import type { RateQuote } from "../../src/models/rate-quote.js";
import { buildTestRateRequest } from "../helpers/test-fixtures.js";

describe("RateService", () => {
  let mockUpsProvider: IRateProvider;
  let service: RateService;

  const mockUpsQuote: RateQuote = {
    serviceCode: "03",
    serviceName: "UPS Ground",
    totalPrice: 25.5,
    currency: "USD",
  };

  beforeEach(() => {
    mockUpsProvider = {
      name: "UPS",
      getRates: vi.fn(async () => mockUpsQuote),
    };

    service = new RateService({
      providers: {
        ups: mockUpsProvider,
      },
    });

    vi.clearAllMocks();
  });

  describe("Input validation", () => {
    it("should validate request before calling providers", async () => {
      const invalidRequest = {
        origin: {
          addressLine1: "",  // Invalid: empty
          city: "Baltimore",
          state: "MD",
          postalCode: "21093",
          country: "US",
        },
        destination: {
          addressLine1: "456 Oak Ave",
          city: "Atlanta",
          state: "GA",
          postalCode: "30005",
          country: "US",
        },
        packages: [{ weight: 10, weightUnit: "LB" as const }],
      };

      await expect(service.getRates(invalidRequest as any)).rejects.toThrow(ValidationError);
      expect(mockUpsProvider.getRates).not.toHaveBeenCalled();
    });

    it("should reject negative weight", async () => {
      const invalidRequest = {
        origin: {
          addressLine1: "123 Main St",
          city: "Baltimore",
          state: "MD",
          postalCode: "21093",
          country: "US",
        },
        destination: {
          addressLine1: "456 Oak Ave",
          city: "Atlanta",
          state: "GA",
          postalCode: "30005",
          country: "US",
        },
        packages: [{ weight: -5, weightUnit: "LB" as const }],
      };

      await expect(service.getRates(invalidRequest as any)).rejects.toThrow(ValidationError);
      expect(mockUpsProvider.getRates).not.toHaveBeenCalled();
    });

    it("should reject invalid country code", async () => {
      const invalidRequest = {
        origin: {
          addressLine1: "123 Main St",
          city: "Baltimore",
          state: "MD",
          postalCode: "21093",
          country: "USA", // Invalid: should be 2 letters
        },
        destination: {
          addressLine1: "456 Oak Ave",
          city: "Atlanta",
          state: "GA",
          postalCode: "30005",
          country: "US",
        },
        packages: [{ weight: 10, weightUnit: "LB" as const }],
      };

      await expect(service.getRates(invalidRequest as any)).rejects.toThrow(ValidationError);
      expect(mockUpsProvider.getRates).not.toHaveBeenCalled();
    });

    it("should reject empty packages array", async () => {
      const invalidRequest = {
        origin: {
          addressLine1: "123 Main St",
          city: "Baltimore",
          state: "MD",
          postalCode: "21093",
          country: "US",
        },
        destination: {
          addressLine1: "456 Oak Ave",
          city: "Atlanta",
          state: "GA",
          postalCode: "30005",
          country: "US",
        },
        packages: [],
      };

      await expect(service.getRates(invalidRequest as any)).rejects.toThrow(ValidationError);
      expect(mockUpsProvider.getRates).not.toHaveBeenCalled();
    });

    it("should reject invalid state code", async () => {
      const invalidRequest = {
        origin: {
          addressLine1: "123 Main St",
          city: "Baltimore",
          state: "Maryland", // Invalid: should be 2 letters
          postalCode: "21093",
          country: "US",
        },
        destination: {
          addressLine1: "456 Oak Ave",
          city: "Atlanta",
          state: "GA",
          postalCode: "30005",
          country: "US",
        },
        packages: [{ weight: 10, weightUnit: "LB" as const }],
      };

      await expect(service.getRates(invalidRequest as any)).rejects.toThrow(ValidationError);
      expect(mockUpsProvider.getRates).not.toHaveBeenCalled();
    });

    it("should provide detailed validation errors", async () => {
      const invalidRequest = {
        origin: {
          addressLine1: "",
          city: "",
          state: "INVALID",
          postalCode: "",
          country: "INVALID",
        },
        destination: {
          addressLine1: "456 Oak Ave",
          city: "Atlanta",
          state: "GA",
          postalCode: "30005",
          country: "US",
        },
        packages: [],
      };

      try {
        await service.getRates(invalidRequest as any);
        expect.fail("Should have thrown ValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.errors.length).toBeGreaterThan(0);
        expect(validationError.message).toBe("Invalid rate request input");
      }
    });
  });

  describe("getRates", () => {
    it("should get rates from UPS provider", async () => {
      const request = buildTestRateRequest();
      const result = await service.getRates(request);

      expect(result.quotes).toHaveLength(1);
      expect(result.quotes).toEqual([
        { carrier: "ups", quote: mockUpsQuote },
      ]);
      expect(result.errors).toBeUndefined();
    });

    it("should call provider with correct parameters", async () => {
      const request = buildTestRateRequest({
        packages: [{ weight: 15, weightUnit: "LB" }],
      });
      await service.getRates(request);

      expect(mockUpsProvider.getRates).toHaveBeenCalledWith(request);
    });

    it("should handle provider errors without failing entire request", async () => {
      const errorProvider: IRateProvider = {
        name: "BrokenProvider",
        getRates: vi.fn(async () => {
          throw new Error("API error");
        }),
      };

      const serviceWithError = new RateService({
        providers: {
          ups: mockUpsProvider,
          broken: errorProvider,
        },
      });

      const request = buildTestRateRequest();
      const result = await serviceWithError.getRates(request);

      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0]).toEqual({ carrier: "ups", quote: mockUpsQuote });
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].carrier).toBe("broken");
      expect(result.errors?.[0].error).toBeInstanceOf(Error);
    });

    it("should collect all errors when multiple providers fail", async () => {
      const errorProvider1: IRateProvider = {
        name: "Broken1",
        getRates: vi.fn(async () => {
          throw new Error("Error 1");
        }),
      };

      const errorProvider2: IRateProvider = {
        name: "Broken2",
        getRates: vi.fn(async () => {
          throw new Error("Error 2");
        }),
      };

      const serviceWithErrors = new RateService({
        providers: {
          broken1: errorProvider1,
          broken2: errorProvider2,
        },
      });

      const request = buildTestRateRequest();
      const result = await serviceWithErrors.getRates(request);

      expect(result.quotes).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors?.map((e) => e.carrier)).toEqual([
        "broken1",
        "broken2",
      ]);
    });

    it("should return empty quotes when no providers configured", async () => {
      const emptyService = new RateService({ providers: {} });

      const request = buildTestRateRequest();
      const result = await emptyService.getRates(request);

      expect(result.quotes).toEqual([]);
      expect(result.errors).toBeUndefined();
    });

    it("should run multiple providers in parallel", async () => {
      const provider1: IRateProvider = {
        name: "Provider1",
        getRates: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return mockUpsQuote;
        }),
      };

      const provider2: IRateProvider = {
        name: "Provider2",
        getRates: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return mockUpsQuote;
        }),
      };

      const parallelService = new RateService({
        providers: {
          ups1: provider1,
          ups2: provider2,
        },
      });

      const request = buildTestRateRequest();
      const start = Date.now();
      await parallelService.getRates(request);
      const totalTime = Date.now() - start;

      // If sequential, would take 200ms+. Parallel should be ~100ms
      expect(totalTime).toBeLessThan(150);
    });
  });

  describe("getRatesFromProvider", () => {
    it("should get rate from specific provider", async () => {
      const request = buildTestRateRequest();
      const quote = await service.getRatesFromProvider("ups", request);

      expect(quote).toEqual(mockUpsQuote);
      expect(mockUpsProvider.getRates).toHaveBeenCalledWith(request);
    });

    it("should throw error for unknown provider", async () => {
      const request = buildTestRateRequest();
      await expect(
        service.getRatesFromProvider("dhl", request)
      ).rejects.toThrow("Unknown rate provider: dhl");
    });

    it("should propagate provider errors", async () => {
      const errorProvider: IRateProvider = {
        name: "ErrorProvider",
        getRates: vi.fn(async () => {
          throw new Error("Provider API error");
        }),
      };

      const serviceWithError = new RateService({
        providers: {
          error: errorProvider,
        },
      });

      const request = buildTestRateRequest();
      await expect(
        serviceWithError.getRatesFromProvider("error", request)
      ).rejects.toThrow("Provider API error");
    });
  });

  describe("edge cases", () => {
    it("should handle provider returning invalid data gracefully", async () => {
      const invalidProvider: IRateProvider = {
        name: "InvalidProvider",
        getRates: vi.fn(async () => ({} as RateQuote)),
      };

      const serviceWithInvalid = new RateService({
        providers: {
          invalid: invalidProvider,
        },
      });

      const request = buildTestRateRequest();
      const result = await serviceWithInvalid.getRates(request);

      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0].quote).toEqual({});
    });

    it("should preserve provider order in results", async () => {
      const provider2: IRateProvider = {
        name: "Provider2",
        getRates: vi.fn(async () => ({
          serviceCode: "01",
          serviceName: "UPS Next Day",
          totalPrice: 50.0,
          currency: "USD",
        })),
      };

      const orderedService = new RateService({
        providers: {
          ups1: mockUpsProvider,
          ups2: provider2,
        },
      });

      const request = buildTestRateRequest();
      const result = await orderedService.getRates(request);

      const providerNames = result.quotes.map((q) => q.carrier);
      expect(providerNames).toEqual(["ups1", "ups2"]);
    });
  });
});
