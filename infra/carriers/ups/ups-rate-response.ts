export interface UpsCharges {
  CurrencyCode?: string;
  MonetaryValue?: string;
}

export interface UpsService {
  Code?: string;
  Description?: string;
}

export interface UpsRatedShipment {
  Service?: UpsService;
  TotalCharges?: UpsCharges;
  NegotiatedRateCharges?: {
    ItemizedCharges?: Array<{ Code?: string; Description?: string; MonetaryValue?: string }>;
    TotalCharge?: UpsCharges;
  };
  BillingWeight?: { Weight?: string; UnitOfMeasurement?: { Code?: string } };
}

export interface UpsRateResponse {
  RateResponse?: {
    Response?: { ResponseStatus?: { Code?: string; Description?: string } };
    RatedShipment?: UpsRatedShipment | UpsRatedShipment[];
  };
}
