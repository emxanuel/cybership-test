import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateService } from "../../src/services/rate-service.js";
import type { ICarrier } from "../../src/carriers/carrier.interface.js";
import type { RateQuote } from "../../src/models/rate-quote.js";

describe("RateService", () => {
  let mockUpsCarrier: ICarrier;
  let service: RateService;

  const mockUpsQuote: RateQuote = {
    serviceCode: "03",
    serviceName: "UPS Ground",
    totalPrice: 25.5,
    currency: "USD",
  };

  beforeEach(() => {
    mockUpsCarrier = {
      getRates: vi.fn(async () => mockUpsQuote),
    };

    service = new RateService({
      carriers: {
        ups: mockUpsCarrier,
      },
    });

    vi.clearAllMocks();
  });

  describe("getRates", () => {
    it("should get rates from UPS carrier", async () => {
      const result = await service.getRates("12345", "67890", 10);

      expect(result.quotes).toHaveLength(1);
      expect(result.quotes).toEqual([
        { carrier: "ups", quote: mockUpsQuote },
      ]);
      expect(result.errors).toBeUndefined();
    });

    it("should call carrier with correct parameters", async () => {
      await service.getRates("12345", "67890", 15);

      expect(mockUpsCarrier.getRates).toHaveBeenCalledWith("12345", "67890", 15);
    });

    it("should handle carrier errors without failing entire request", async () => {
      const errorCarrier: ICarrier = {
        getRates: vi.fn(async () => {
          throw new Error("API error");
        }),
      };

      const serviceWithError = new RateService({
        carriers: {
          ups: mockUpsCarrier,
          broken: errorCarrier,
        },
      });

      const result = await serviceWithError.getRates("12345", "67890", 10);

      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0]).toEqual({ carrier: "ups", quote: mockUpsQuote });
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].carrier).toBe("broken");
      expect(result.errors?.[0].error).toBeInstanceOf(Error);
    });

    it("should collect all errors when multiple carriers fail", async () => {
      const errorCarrier1: ICarrier = {
        getRates: vi.fn(async () => {
          throw new Error("Error 1");
        }),
      };

      const errorCarrier2: ICarrier = {
        getRates: vi.fn(async () => {
          throw new Error("Error 2");
        }),
      };

      const serviceWithErrors = new RateService({
        carriers: {
          broken1: errorCarrier1,
          broken2: errorCarrier2,
        },
      });

      const result = await serviceWithErrors.getRates("12345", "67890", 10);

      expect(result.quotes).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors?.map((e) => e.carrier)).toEqual([
        "broken1",
        "broken2",
      ]);
    });

    it("should return empty quotes when no carriers configured", async () => {
      const emptyService = new RateService({ carriers: {} });

      const result = await emptyService.getRates("12345", "67890", 10);

      expect(result.quotes).toEqual([]);
      expect(result.errors).toBeUndefined();
    });

    it("should run multiple carriers in parallel", async () => {
      const carrier1: ICarrier = {
        getRates: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return mockUpsQuote;
        }),
      };

      const carrier2: ICarrier = {
        getRates: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return mockUpsQuote;
        }),
      };

      const parallelService = new RateService({
        carriers: {
          ups1: carrier1,
          ups2: carrier2,
        },
      });

      const start = Date.now();
      await parallelService.getRates("12345", "67890", 10);
      const totalTime = Date.now() - start;

      // If sequential, would take 200ms+. Parallel should be ~100ms
      expect(totalTime).toBeLessThan(150);
    });
  });

  describe("getRatesFromCarrier", () => {
    it("should get rate from specific carrier", async () => {
      const quote = await service.getRatesFromCarrier(
        "ups",
        "12345",
        "67890",
        10
      );

      expect(quote).toEqual(mockUpsQuote);
      expect(mockUpsCarrier.getRates).toHaveBeenCalledWith("12345", "67890", 10);
    });

    it("should throw error for unknown carrier", async () => {
      await expect(
        service.getRatesFromCarrier("dhl", "12345", "67890", 10)
      ).rejects.toThrow("Unknown carrier: dhl");
    });

    it("should propagate carrier errors", async () => {
      const errorCarrier: ICarrier = {
        getRates: vi.fn(async () => {
          throw new Error("Carrier API error");
        }),
      };

      const serviceWithError = new RateService({
        carriers: {
          error: errorCarrier,
        },
      });

      await expect(
        serviceWithError.getRatesFromCarrier("error", "12345", "67890", 10)
      ).rejects.toThrow("Carrier API error");
    });
  });

  describe("edge cases", () => {
    it("should handle carrier returning invalid data gracefully", async () => {
      const invalidCarrier: ICarrier = {
        getRates: vi.fn(async () => ({} as RateQuote)),
      };

      const serviceWithInvalid = new RateService({
        carriers: {
          invalid: invalidCarrier,
        },
      });

      const result = await serviceWithInvalid.getRates("12345", "67890", 10);

      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0].quote).toEqual({});
    });

    it("should preserve carrier order in results", async () => {
      const carrier2: ICarrier = {
        getRates: vi.fn(async () => ({
          serviceCode: "01",
          serviceName: "UPS Next Day",
          totalPrice: 50.0,
          currency: "USD",
        })),
      };

      const orderedService = new RateService({
        carriers: {
          ups1: mockUpsCarrier,
          ups2: carrier2,
        },
      });

      const result = await orderedService.getRates("12345", "67890", 10);

      const carrierNames = result.quotes.map((q) => q.carrier);
      expect(carrierNames).toEqual(["ups1", "ups2"]);
    });
  });
});
