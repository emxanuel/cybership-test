import { IRateProvider } from "@/carriers/carrier.interface.js";
import { RateQuote } from "@/models/rate-quote.js";
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

  async getRates(origin: string, destination: string, weight: number): Promise<RateQuote> {
    const { auth, shipperNumber } = this.config;

    const originAddress: UpsAddressInput = {
      postalCode: origin,
      countryCode: "US",
    };
    const destAddress: UpsAddressInput = {
      postalCode: destination,
      countryCode: "US",
    };

    const body = buildUpsRateRequestBody({
      shipperNumber,
      shipperAddress: originAddress,
      shipFromAddress: originAddress,
      shipToAddress: destAddress,
      weightLbs: weight,
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
