import type { RateRequestInput, AddressInput, PackageInfo } from "../../src/models/rate-request.js";

export function buildTestRateRequest(overrides?: Partial<RateRequestInput>): RateRequestInput {
  const defaultOrigin: AddressInput = {
    addressLine1: "123 Main St",
    city: "Baltimore",
    state: "MD",
    postalCode: "21093",
    country: "US",
  };

  const defaultDestination: AddressInput = {
    addressLine1: "456 Oak Ave",
    city: "Atlanta",
    state: "GA",
    postalCode: "30005",
    country: "US",
  };

  const defaultPackage: PackageInfo = {
    weight: 10,
    weightUnit: "LB",
    dimensions: {
      length: 10,
      width: 10,
      height: 10,
      unit: "IN",
    },
  };

  return {
    origin: defaultOrigin,
    destination: defaultDestination,
    packages: [defaultPackage],
    ...overrides,
  };
}
