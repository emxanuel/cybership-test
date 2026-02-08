/**
 * Example: How to add a new carrier (FedEx) with rate capability
 * 
 * This demonstrates the extensibility of the carrier system.
 * To add FedEx:
 * 1. Create fedex-carrier.ts implementing IRateProvider
 * 2. Add FedEx-specific types (fedex-rate-request.ts, fedex-rate-response.ts)
 * 3. Create mapper functions to convert between FedEx API and domain models
 * 4. No changes to existing UPS code required!
 */

import { IRateProvider } from "@/carriers/carrier.interface.js";
import { RateQuote } from "@/models/rate-quote.js";
import { FetchClient } from "../../../http/fetch-client.js";

// FedEx-specific configuration
export interface FedExAuthConfig {
  apiKey: string;
  secretKey: string;
  accountNumber: string;
  baseUrl: string;
}

export interface FedExCarrierConfig {
  auth: FedExAuthConfig;
  httpClient?: FetchClient;
}

/**
 * FedEx carrier implementation with rate capability.
 * Implements IRateProvider to provide shipping rates.
 * 
 * To add tracking: also implement ITrackingProvider
 * To add labels: also implement ILabelProvider
 */
export class FedExCarrier implements IRateProvider {
  readonly name = "FedEx";
  private readonly client: FetchClient;

  constructor(private readonly config: FedExCarrierConfig) {
    this.client =
      config.httpClient ??
      new FetchClient({
        baseUrl: config.auth.baseUrl,
        defaultHeaders: {
          "Content-Type": "application/json",
          "X-API-Key": config.auth.apiKey,
        },
      });
  }

  async getRates(origin: string, destination: string, weight: number): Promise<RateQuote> {
    // 1. Build FedEx-specific request payload
    const requestBody = {
      accountNumber: this.config.auth.accountNumber,
      requestedShipment: {
        shipper: { address: { postalCode: origin } },
        recipient: { address: { postalCode: destination } },
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        serviceType: "FEDEX_GROUND",
        packagingType: "YOUR_PACKAGING",
        requestedPackageLineItems: [
          {
            weight: { units: "LB", value: weight },
          },
        ],
      },
    };

    // 2. Call FedEx Rate API
    const response = await this.client.post<any>(
      "/rate/v1/rates/quotes",
      requestBody
    );

    // 3. Map FedEx response to normalized RateQuote
    return {
      serviceCode: response.output.rateReplyDetails[0].serviceType,
      serviceName: response.output.rateReplyDetails[0].serviceName,
      totalPrice: parseFloat(
        response.output.rateReplyDetails[0].ratedShipmentDetails[0].totalNetCharge
      ),
      currency:
        response.output.rateReplyDetails[0].ratedShipmentDetails[0].currency,
    };
  }
}

/**
 * Usage Example:
 * 
 * import { FedExCarrier } from "./infra/carriers/fedex/fedex-carrier.js";
 * import { UpsCarrier } from "./infra/carriers/ups/ups-carrier.js";
 * import { RateService } from "./src/services/rate-service.js";
 * 
 * const fedex = new FedExCarrier({
 *   auth: {
 *     apiKey: process.env.FEDEX_API_KEY!,
 *     secretKey: process.env.FEDEX_SECRET_KEY!,
 *     accountNumber: process.env.FEDEX_ACCOUNT_NUMBER!,
 *     baseUrl: "https://apis.fedex.com",
 *   },
 * });
 * 
 * const ups = new UpsCarrier({
 *   auth: {
 *     clientId: process.env.UPS_CLIENT_ID!,
 *     clientSecret: process.env.UPS_CLIENT_SECRET!,
 *     baseUrl: "https://wwwcie.ups.com",
 *   },
 *   shipperNumber: process.env.UPS_SHIPPER_NUMBER!,
 * });
 * 
 * // Compare rates from both carriers
 * const rateService = new RateService({
 *   providers: {
 *     fedex,
 *     ups,
 *   },
 * });
 * 
 * const result = await rateService.getRates("12345", "67890", 10);
 * console.log(result.quotes); // Array with quotes from both FedEx and UPS
 */
