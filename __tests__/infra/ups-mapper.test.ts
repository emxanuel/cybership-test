import { describe, it, expect } from "vitest";
import {
  mapUpsRateResponseToQuote,
  buildUpsRateRequestBody,
} from "../../infra/carriers/ups/ups-mapper.js";
import type { UpsRateResponse } from "../../infra/carriers/ups/ups-rate-response.js";

describe("UPS Mapper", () => {
  describe("mapUpsRateResponseToQuote", () => {
    it("should map basic rate response to quote", () => {
      const response: UpsRateResponse = {
        RateResponse: {
          RatedShipment: {
            Service: {
              Code: "03",
              Description: "UPS Ground",
            },
            TotalCharges: {
              CurrencyCode: "USD",
              MonetaryValue: "25.50",
            },
          },
        },
      };

      const quote = mapUpsRateResponseToQuote(response);

      expect(quote).toEqual({
        serviceCode: "03",
        serviceName: "UPS Ground",
        totalPrice: 25.5,
        currency: "USD",
        breakdown: {
          basePrice: 25.5,
          fuelSurcharge: undefined,
          other: undefined,
        },
      });
    });

    it("should prefer negotiated rate charges", () => {
      const response: UpsRateResponse = {
        RateResponse: {
          RatedShipment: {
            Service: {
              Code: "03",
              Description: "Ground",
            },
            TotalCharges: {
              CurrencyCode: "USD",
              MonetaryValue: "30.00",
            },
            NegotiatedRateCharges: {
              TotalCharge: {
                CurrencyCode: "USD",
                MonetaryValue: "25.00",
              },
              ItemizedCharges: [
                {
                  Code: "FS",
                  Description: "Fuel Surcharge",
                  MonetaryValue: "2.50",
                },
              ],
            },
          },
        },
      };

      const quote = mapUpsRateResponseToQuote(response);

      expect(quote.totalPrice).toBe(25.0);
      expect(quote.breakdown?.fuelSurcharge).toBe(2.5);
    });

    it("should handle multiple rated shipments (uses first)", () => {
      const response: UpsRateResponse = {
        RateResponse: {
          RatedShipment: [
            {
              Service: { Code: "03", Description: "Ground" },
              TotalCharges: {
                CurrencyCode: "USD",
                MonetaryValue: "20.00",
              },
            },
            {
              Service: { Code: "01", Description: "Next Day" },
              TotalCharges: {
                CurrencyCode: "USD",
                MonetaryValue: "50.00",
              },
            },
          ],
        },
      };

      const quote = mapUpsRateResponseToQuote(response);

      expect(quote.serviceCode).toBe("03");
      expect(quote.totalPrice).toBe(20.0);
    });

    it("should return default quote when no rated shipment", () => {
      const response: UpsRateResponse = {
        RateResponse: {
          RatedShipment: undefined,
        },
      };

      const quote = mapUpsRateResponseToQuote(response);

      expect(quote).toEqual({
        serviceCode: "ups",
        serviceName: "UPS",
        totalPrice: 0,
        currency: "USD",
      });
    });

    it("should handle missing service description", () => {
      const response: UpsRateResponse = {
        RateResponse: {
          RatedShipment: {
            Service: {
              Code: "03",
            },
            TotalCharges: {
              CurrencyCode: "USD",
              MonetaryValue: "10.00",
            },
          },
        },
      };

      const quote = mapUpsRateResponseToQuote(response);

      expect(quote.serviceName).toBe("UPS");
    });

    it("should parse invalid monetary values as 0", () => {
      const response: UpsRateResponse = {
        RateResponse: {
          RatedShipment: {
            Service: { Code: "03" },
            TotalCharges: {
              MonetaryValue: "invalid",
            },
          },
        },
      };

      const quote = mapUpsRateResponseToQuote(response);

      expect(quote.totalPrice).toBe(0);
    });

    it("should identify fuel surcharge by code or description", () => {
      const response: UpsRateResponse = {
        RateResponse: {
          RatedShipment: {
            Service: { Code: "03" },
            TotalCharges: {
              CurrencyCode: "USD",
              MonetaryValue: "20.00",
            },
            NegotiatedRateCharges: {
              TotalCharge: {
                CurrencyCode: "USD",
                MonetaryValue: "22.50",
              },
              ItemizedCharges: [
                {
                  Code: "OTHER",
                  Description: "fuel adjustment",
                  MonetaryValue: "2.50",
                },
              ],
            },
          },
        },
      };

      const quote = mapUpsRateResponseToQuote(response);

      expect(quote.breakdown?.fuelSurcharge).toBe(2.5);
    });
  });

  describe("buildUpsRateRequestBody", () => {
    it("should build request with required fields", () => {
      const body = buildUpsRateRequestBody({
        shipperNumber: "123456",
        shipperAddress: { postalCode: "12345" },
        shipFromAddress: { postalCode: "12345" },
        shipToAddress: { postalCode: "67890" },
        weightLbs: 10,
      });

      expect(body.RateRequest.Shipment.Shipper.ShipperNumber).toBe("123456");
      expect(body.RateRequest.Shipment.Package.PackageWeight.Weight).toBe("10");
      expect(body.RateRequest.Shipment.ShipTo.Address.PostalCode).toBe("67890");
    });

    it("should use optional dimensions when provided", () => {
      const body = buildUpsRateRequestBody({
        shipperNumber: "123456",
        shipperAddress: { postalCode: "12345" },
        shipFromAddress: { postalCode: "12345" },
        shipToAddress: { postalCode: "67890" },
        weightLbs: 5,
        lengthIn: 10,
        widthIn: 8,
        heightIn: 6,
      });

      expect(body.RateRequest.Shipment.Package.Dimensions.Length).toBe("10");
      expect(body.RateRequest.Shipment.Package.Dimensions.Width).toBe("8");
      expect(body.RateRequest.Shipment.Package.Dimensions.Height).toBe("6");
    });

    it("should use default dimensions when not provided", () => {
      const body = buildUpsRateRequestBody({
        shipperNumber: "123456",
        shipperAddress: { postalCode: "12345" },
        shipFromAddress: { postalCode: "12345" },
        shipToAddress: { postalCode: "67890" },
        weightLbs: 5,
      });

      expect(body.RateRequest.Shipment.Package.Dimensions.Length).toBe("5");
      expect(body.RateRequest.Shipment.Package.Dimensions.Width).toBe("5");
      expect(body.RateRequest.Shipment.Package.Dimensions.Height).toBe("5");
    });

    it("should use custom service code when provided", () => {
      const body = buildUpsRateRequestBody({
        shipperNumber: "123456",
        shipperAddress: { postalCode: "12345" },
        shipFromAddress: { postalCode: "12345" },
        shipToAddress: { postalCode: "67890" },
        weightLbs: 5,
        serviceCode: "01",
      });

      expect(body.RateRequest.Shipment.Service.Code).toBe("01");
    });

    it("should default to Ground service (03)", () => {
      const body = buildUpsRateRequestBody({
        shipperNumber: "123456",
        shipperAddress: { postalCode: "12345" },
        shipFromAddress: { postalCode: "12345" },
        shipToAddress: { postalCode: "67890" },
        weightLbs: 5,
      });

      expect(body.RateRequest.Shipment.Service.Code).toBe("03");
    });

    it("should populate address with city and state when provided", () => {
      const body = buildUpsRateRequestBody({
        shipperNumber: "123456",
        shipperAddress: {
          postalCode: "12345",
          city: "New York",
          stateProvinceCode: "NY",
          countryCode: "US",
        },
        shipFromAddress: { postalCode: "12345" },
        shipToAddress: { postalCode: "67890" },
        weightLbs: 5,
      });

      expect(body.RateRequest.Shipment.Shipper.Address.City).toBe("New York");
      expect(body.RateRequest.Shipment.Shipper.Address.StateProvinceCode).toBe(
        "NY"
      );
      expect(body.RateRequest.Shipment.Shipper.Address.CountryCode).toBe("US");
    });

    it("should default to US when country not provided", () => {
      const body = buildUpsRateRequestBody({
        shipperNumber: "123456",
        shipperAddress: { postalCode: "12345" },
        shipFromAddress: { postalCode: "12345" },
        shipToAddress: { postalCode: "67890" },
        weightLbs: 5,
      });

      expect(body.RateRequest.Shipment.ShipTo.Address.CountryCode).toBe("US");
    });

    it("should use provided address lines", () => {
      const body = buildUpsRateRequestBody({
        shipperNumber: "123456",
        shipperAddress: {
          postalCode: "12345",
          addressLine: ["123 Main St", "Apt 4"],
        },
        shipFromAddress: { postalCode: "12345" },
        shipToAddress: { postalCode: "67890" },
        weightLbs: 5,
      });

      expect(body.RateRequest.Shipment.Shipper.Address.AddressLine).toEqual([
        "123 Main St",
        "Apt 4",
      ]);
    });
  });
});
