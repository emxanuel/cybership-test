import { RateQuote } from "../models/rate-quote.js";
import type { RateRequestInput } from "../models/rate-request.js";

/**
 * Base carrier interface - all carriers must implement this.
 * Specific capabilities are defined in separate interfaces.
 */
export interface ICarrier {
  readonly name: string;
}

/**
 * Rate shopping capability - carriers that provide shipping rates implement this.
 */
export interface IRateProvider extends ICarrier {
  getRates(request: RateRequestInput): Promise<RateQuote>;
}

/**
 * Shipment tracking capability - carriers that provide tracking implement this.
 */
export interface ITrackingProvider extends ICarrier {
  track(trackingNumber: string): Promise<TrackingInfo>;
}

/**
 * Address validation capability - carriers that validate addresses implement this.
 */
export interface IAddressValidator extends ICarrier {
  validateAddress(address: AddressInput): Promise<AddressValidationResult>;
}

/**
 * Label generation capability - carriers that generate shipping labels implement this.
 */
export interface ILabelProvider extends ICarrier {
  createLabel(shipment: ShipmentRequest): Promise<LabelResponse>;
}

// Supporting types for new capabilities
export interface TrackingInfo {
  trackingNumber: string;
  status: string;
  events: TrackingEvent[];
  estimatedDelivery?: string;
}

export interface TrackingEvent {
  timestamp: string;
  location: string;
  status: string;
  description: string;
}

export interface AddressInput {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PackageInfo {
  weight: number;
  weightUnit?: "LB" | "KG";
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: "IN" | "CM";
  };
}

export interface AddressValidationResult {
  isValid: boolean;
  suggestedAddress?: AddressInput;
  errors?: string[];
}

export interface ShipmentRequest {
  origin: AddressInput;
  destination: AddressInput;
  packages: PackageInfo[];
  serviceCode?: string;
}

export interface LabelResponse {
  labelData: string; // Base64 encoded label
  trackingNumber: string;
  cost: number;
  currency: string;
}