import { z } from "zod";

const envSchema = z.object({
  UPS_CLIENT_ID: z.string(),
  UPS_CLIENT_SECRET: z.string(),
  UPS_API_KEY: z.string(),
  UPS_API_BASE_URL: z.string(),
  UPS_SHIPPER_NUMBER: z.string(),
});

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  throw new Error(`Invalid environment variables: ${z.treeifyError(envResult.error)}`);
}

export const env = envResult.data;