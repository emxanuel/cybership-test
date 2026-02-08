import { RateQuote } from "@/models/rate-quote.js";
import type {
  UpsAddress,
  UpsAddressInput,
  UpsRateRequestBody,
} from "./ups-rate-request.js";
import type {
  UpsCharges,
  UpsRateResponse,
  UpsRatedShipment,
} from "./ups-rate-response.js";

function toAddress(a: UpsAddressInput): UpsAddress {
  return {
    AddressLine: a.addressLine ?? [a.city ?? "Address", a.postalCode],
    City: a.city ?? "Unknown",
    StateProvinceCode: a.stateProvinceCode ?? "",
    PostalCode: a.postalCode,
    CountryCode: a.countryCode ?? "US",
  };
}

export function buildUpsRateRequestBody(options: {
  shipperNumber: string;
  shipperAddress: UpsAddressInput;
  shipFromAddress: UpsAddressInput;
  shipToAddress: UpsAddressInput;
  weightLbs: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  serviceCode?: string;
}): UpsRateRequestBody {
  const { shipperNumber, shipperAddress, shipFromAddress, shipToAddress, weightLbs } = options;
  const lengthIn = options.lengthIn ?? 5;
  const widthIn = options.widthIn ?? 5;
  const heightIn = options.heightIn ?? 5;
  const serviceCode = options.serviceCode ?? "03";

  return {
    RateRequest: {
      Request: {
        TransactionReference: {
          CustomerContext: "CustomerContext",
          TransactionIdentifier: "TransactionIdentifier",
        },
      },
      Shipment: {
        Shipper: {
          Name: "Shipper",
          ShipperNumber: shipperNumber,
          Address: toAddress(shipperAddress),
        },
        ShipTo: {
          Name: "ShipTo",
          Address: toAddress(shipToAddress),
        },
        ShipFrom: {
          Name: "ShipFrom",
          Address: toAddress(shipFromAddress),
        },
        PaymentDetails: {
          ShipmentCharge: {
            Type: "01",
            BillShipper: { AccountNumber: shipperNumber },
          },
        },
        Service: { Code: serviceCode, Description: "Ground" },
        NumOfPieces: "1",
        Package: {
          SimpleRate: { Description: "SimpleRateDescription", Code: "XS" },
          PackagingType: { Code: "02", Description: "Packaging" },
          Dimensions: {
            UnitOfMeasurement: { Code: "IN", Description: "Inches" },
            Length: String(lengthIn),
            Width: String(widthIn),
            Height: String(heightIn),
          },
          PackageWeight: {
            UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
            Weight: String(weightLbs),
          },
        },
      },
    },
  };
}

function parseAmount(charges: UpsCharges | undefined): number {
  if (!charges?.MonetaryValue) return 0;
  const n = Number.parseFloat(charges.MonetaryValue);
  return Number.isFinite(n) ? n : 0;
}

function getRatedShipments(res: UpsRateResponse): UpsRatedShipment[] {
  const rated = res.RateResponse?.RatedShipment;
  if (!rated) return [];
  return Array.isArray(rated) ? rated : [rated];
}

export function mapUpsRateResponseToQuote(res: UpsRateResponse): RateQuote {
  const shipments = getRatedShipments(res);
  const first = shipments[0];

  if (!first) {
    return {
      serviceCode: "ups",
      serviceName: "UPS",
      totalPrice: 0,
      currency: "USD",
    };
  }

  const totalCharges = first.NegotiatedRateCharges?.TotalCharge ?? first.TotalCharges;
  const totalPrice = parseAmount(totalCharges);
  const currency = totalCharges?.CurrencyCode ?? "USD";

  const itemized = first.NegotiatedRateCharges?.ItemizedCharges ?? [];
  const fuelItem = itemized.find(
    (c) => c.Code === "FS" || c.Description?.toLowerCase().includes("fuel")
  );
  const breakdown =
    itemized.length > 0 || first.TotalCharges
      ? {
          basePrice: parseAmount(first.TotalCharges),
          fuelSurcharge: fuelItem
            ? parseAmount({ MonetaryValue: fuelItem.MonetaryValue })
            : undefined,
          other: first.NegotiatedRateCharges?.TotalCharge
            ? parseAmount(first.NegotiatedRateCharges.TotalCharge)
            : undefined,
        }
      : undefined;

  return {
    serviceCode: first.Service?.Code ?? "ups",
    serviceName: first.Service?.Description ?? "UPS",
    totalPrice,
    currency,
    breakdown,
  };
}
