import type { Caido } from "@caido/sdk-frontend";
import type { App, InjectionKey } from "vue";

export const sdkKey = Symbol("sdk") as InjectionKey<Caido>;

let globalSdk: Caido | undefined;

export const SDKPlugin = {
  install(app: App, sdk: Caido) {
    globalSdk = sdk;
    app.provide(sdkKey, sdk);
  },
};

export function useSDK(): Caido {
  if (!globalSdk) {
    throw new Error("SDK not initialized");
  }
  return globalSdk;
}
