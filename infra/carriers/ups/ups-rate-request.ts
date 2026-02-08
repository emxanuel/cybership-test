export interface UpsAddress {
  AddressLine: string[];
  City: string;
  StateProvinceCode: string;
  PostalCode: string;
  CountryCode: string;
}

export interface UpsTransactionReference {
  CustomerContext?: string;
  TransactionIdentifier?: string;
}

export interface UpsRequest {
  TransactionReference?: UpsTransactionReference;
}

export interface UpsParty {
  Name: string;
  Address: UpsAddress;
}

export interface UpsShipper extends UpsParty {
  ShipperNumber: string;
}

export interface UpsBillShipper {
  AccountNumber: string;
}

export interface UpsShipmentCharge {
  Type: string;
  BillShipper: UpsBillShipper;
}

export interface UpsPaymentDetails {
  ShipmentCharge: UpsShipmentCharge;
}

export interface UpsService {
  Code: string;
  Description?: string;
}

export interface UpsUnitOfMeasurement {
  Code: string;
  Description?: string;
}

export interface UpsDimensions {
  UnitOfMeasurement: UpsUnitOfMeasurement;
  Length: string;
  Width: string;
  Height: string;
}

export interface UpsPackageWeight {
  UnitOfMeasurement: UpsUnitOfMeasurement;
  Weight: string;
}

export interface UpsSimpleRate {
  Description?: string;
  Code: string;
}

export interface UpsPackagingType {
  Code: string;
  Description?: string;
}

export interface UpsPackage {
  SimpleRate?: UpsSimpleRate;
  PackagingType: UpsPackagingType;
  Dimensions: UpsDimensions;
  PackageWeight: UpsPackageWeight;
}

export interface UpsShipment {
  Shipper: UpsShipper;
  ShipTo: UpsParty;
  ShipFrom: UpsParty;
  PaymentDetails: UpsPaymentDetails;
  Service: UpsService;
  NumOfPieces: string;
  Package: UpsPackage;
}

export interface UpsRateRequest {
  Request?: UpsRequest;
  Shipment: UpsShipment;
}

export interface UpsRateRequestBody {
  RateRequest: UpsRateRequest;
}

export interface UpsAddressInput {
  postalCode: string;
  city?: string;
  stateProvinceCode?: string;
  countryCode?: string;
  addressLine?: string[];
}
