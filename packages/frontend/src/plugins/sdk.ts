import type { Caido } from "@caido/sdk-frontend";
import type { API } from "../../backend/src/index";
import type { App, InjectionKey } from "vue";

// SDK with backend API
export type CaidoSDK = Caido<API>;

export const sdkKey = Symbol("sdk") as InjectionKey<CaidoSDK>;

let globalSdk: CaidoSDK | undefined;

export const SDKPlugin = {
  install(app: App, sdk: CaidoSDK) {
    globalSdk = sdk;
    app.provide(sdkKey, sdk);
  },
};

export function useSDK(): CaidoSDK {
  if (!globalSdk) {
    throw new Error("SDK not initialized");
  }
  return globalSdk;
}
