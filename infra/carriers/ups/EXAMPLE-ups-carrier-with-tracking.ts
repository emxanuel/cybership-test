/**
 * Example: How to add tracking capability to UPS carrier
 * 
 * This demonstrates how to extend a carrier with new operations
 * without modifying existing rate functionality.
 */

import {
  IRateProvider,
  ITrackingProvider,
  TrackingInfo,
} from "@/carriers/carrier.interface.js";
import { RateQuote } from "@/models/rate-quote.js";
import { FetchClient } from "../../http/fetch-client.js";
import { getUpsAuthorizationHeader, type UpsAuthConfig } from "../../auth/ups-auth.js";

// UPS Tracking API types
interface UpsTrackingResponse {
  trackResponse: {
    shipment: Array<{
      package: Array<{
        trackingNumber: string;
        deliveryDate?: {
          date: string;
        };
        activity: Array<{
          date: string;
          time: string;
          location: {
            address: {
              city: string;
              stateProvince: string;
              country: string;
            };
          };
          status: {
            type: string;
            description: string;
          };
        }>;
      }>;
    }>;
  };
}

export interface UpsCarrierWithTrackingConfig {
  auth: UpsAuthConfig;
  shipperNumber: string;
  httpClient?: FetchClient;
}

/**
 * Extended UPS carrier that implements both rate AND tracking capabilities.
 * 
 * This shows how to add new operations to an existing carrier:
 * 1. Implement additional capability interfaces (ITrackingProvider)
 * 2. Add new methods for that capability (track)
 * 3. Existing rate functionality remains unchanged
 */
export class UpsCarrierWithTracking implements IRateProvider, ITrackingProvider {
  readonly name = "UPS";
  private readonly client: FetchClient;

  constructor(private readonly config: UpsCarrierWithTrackingConfig) {
    this.client =
      config.httpClient ??
      new FetchClient({
        baseUrl: config.auth.baseUrl,
        defaultHeaders: { "Content-Type": "application/json" },
      });
  }

  // Rate capability (existing)
  async getRates(origin: string, destination: string, weight: number): Promise<RateQuote> {
    // ... existing rate implementation (unchanged)
    throw new Error("Implementation omitted for brevity - see ups-carrier.ts");
  }

  // NEW: Tracking capability
  async track(trackingNumber: string): Promise<TrackingInfo> {
    const authHeader = await getUpsAuthorizationHeader(this.config.auth);

    const response = await this.client.get<UpsTrackingResponse>(
      `/api/track/v1/details/${trackingNumber}`,
      {
        headers: {
          Authorization: authHeader,
          transactionSrc: "testing",
          transId: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
        },
      }
    );

    // Map UPS tracking response to normalized TrackingInfo
    const pkg = response.trackResponse.shipment[0]?.package[0];
    if (!pkg) {
      throw new Error(`No tracking info found for ${trackingNumber}`);
    }

    return {
      trackingNumber: pkg.trackingNumber,
      status: pkg.activity[0]?.status.type ?? "Unknown",
      estimatedDelivery: pkg.deliveryDate?.date,
      events: pkg.activity.map((act) => ({
        timestamp: `${act.date} ${act.time}`,
        location: `${act.location.address.city}, ${act.location.address.stateProvince}`,
        status: act.status.type,
        description: act.status.description,
      })),
    };
  }
}

/**
 * Usage Example:
 * 
 * import { UpsCarrierWithTracking } from "./infra/carriers/ups/ups-carrier-with-tracking.js";
 * 
 * const carrier = new UpsCarrierWithTracking({
 *   auth: {
 *     clientId: process.env.UPS_CLIENT_ID!,
 *     clientSecret: process.env.UPS_CLIENT_SECRET!,
 *     baseUrl: "https://wwwcie.ups.com",
 *   },
 *   shipperNumber: process.env.UPS_SHIPPER_NUMBER!,
 * });
 * 
 * // Use rate capability
 * const quote = await carrier.getRates("12345", "67890", 10);
 * console.log(`Rate: $${quote.totalPrice}`);
 * 
 * // Use tracking capability
 * const tracking = await carrier.track("1Z999AA10123456784");
 * console.log(`Status: ${tracking.status}`);
 * console.log(`Events: ${tracking.events.length}`);
 * 
 * // Type-safe capability checking
 * function canTrack(carrier: any): carrier is ITrackingProvider {
 *   return "track" in carrier;
 * }
 * 
 * if (canTrack(carrier)) {
 *   await carrier.track("1Z999AA10123456784");
 * }
 */
