import { z } from "zod";

export const AddressInputSchema = z.object({
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required (2-letter code)").max(2),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().length(2, "Country must be 2-letter code (e.g., US, CA)"),
});

export const PackageInfoSchema = z.object({
  weight: z.number().positive("Weight must be positive"),
  weightUnit: z.enum(["LB", "KG"]).optional().default("LB"),
  dimensions: z
    .object({
      length: z.number().positive("Length must be positive"),
      width: z.number().positive("Width must be positive"),
      height: z.number().positive("Height must be positive"),
      unit: z.enum(["IN", "CM"]),
    })
    .optional(),
});

export const RateRequestInputSchema = z.object({
  origin: AddressInputSchema,
  destination: AddressInputSchema,
  packages: z
    .array(PackageInfoSchema)
    .min(1, "At least one package is required")
    .max(50, "Maximum 50 packages allowed"),
  serviceLevel: z.string().optional(),
});

export type RateRequestInput = z.infer<typeof RateRequestInputSchema>;
export type AddressInput = z.infer<typeof AddressInputSchema>;
export type PackageInfo = z.infer<typeof PackageInfoSchema>;
