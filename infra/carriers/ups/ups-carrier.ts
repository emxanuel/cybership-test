import { IRateProvider } from "@/carriers/carrier.interface.js";
import type { RateQuote } from "@/models/rate-quote.js";
import type { RateRequestInput } from "@/models/rate-request.js";
import { buildUpsRateRequestBody } from "./ups-mapper.js";
import { type UpsAddressInput } from "./ups-rate-request.js";
import { type UpsRateResponse } from "./ups-rate-response.js";
import { FetchClient } from "../../http/fetch-client.js";
import { getUpsAuthorizationHeader, type UpsAuthConfig } from "../../auth/ups-auth.js";
import { mapUpsRateResponseToQuote } from "./ups-mapper.js";

const RATE_PATH = "/api/rating/v2403/rate";

export interface UpsCarrierConfig {
  auth: UpsAuthConfig;
  shipperNumber: string;
  httpClient?: FetchClient;
}

/**
 * UPS carrier implementation supporting rate quotes.
 * Implements IRateProvider to provide shipping rate capability.
 * 
 * To add more UPS capabilities (tracking, labels, etc.),
 * implement additional capability interfaces (ITrackingProvider, ILabelProvider, etc.)
 */
export class UpsCarrier implements IRateProvider {
  readonly name = "UPS";
  private readonly client: FetchClient;

  constructor(private readonly config: UpsCarrierConfig) {
    this.client =
      config.httpClient ??
      new FetchClient({
        baseUrl: config.auth.baseUrl,
        defaultHeaders: { "Content-Type": "application/json" },
      });
  }

  async getRates(request: RateRequestInput): Promise<RateQuote> {
    const { auth, shipperNumber } = this.config;
    const { origin, destination, packages, serviceLevel } = request;

    // Use first package for now (UPS API handles single package in this endpoint)
    const pkg = packages[0];
    if (!pkg) {
      throw new Error("At least one package is required");
    }

    const originAddress: UpsAddressInput = {
      postalCode: origin.postalCode,
      city: origin.city,
      stateProvinceCode: origin.state,
      countryCode: origin.country,
      addressLine: origin.addressLine2 
        ? [origin.addressLine1, origin.addressLine2]
        : [origin.addressLine1],
    };

    const destAddress: UpsAddressInput = {
      postalCode: destination.postalCode,
      city: destination.city,
      stateProvinceCode: destination.state,
      countryCode: destination.country,
      addressLine: destination.addressLine2
        ? [destination.addressLine1, destination.addressLine2]
        : [destination.addressLine1],
    };

    const body = buildUpsRateRequestBody({
      shipperNumber,
      shipperAddress: originAddress,
      shipFromAddress: originAddress,
      shipToAddress: destAddress,
      weightLbs: pkg.weightUnit === "KG" ? pkg.weight * 2.20462 : pkg.weight,
      lengthIn: pkg.dimensions?.unit === "CM" ? pkg.dimensions.length / 2.54 : pkg.dimensions?.length,
      widthIn: pkg.dimensions?.unit === "CM" ? pkg.dimensions.width / 2.54 : pkg.dimensions?.width,
      heightIn: pkg.dimensions?.unit === "CM" ? pkg.dimensions.height / 2.54 : pkg.dimensions?.height,
      serviceCode: serviceLevel,
    });

    const authHeader = await getUpsAuthorizationHeader(auth);
    const data = await this.client.post<UpsRateResponse>(`${RATE_PATH}?additionalinfo=`, body, {
      headers: {
        Authorization: authHeader,
        transactionSrc: "testing",
        transId: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });
    return mapUpsRateResponseToQuote(data);
  }
}
