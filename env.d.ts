declare global {
  namespace NodeJS {
    interface ProcessEnv {
      UPS_CLIENT_ID: string;
      UPS_API_KEY: string;
      UPS_CLIENT_SECRET: string;
      UPS_API_BASE_URL: string;
      UPS_SHIPPER_NUMBER: string;
    }
  }
}

export {}