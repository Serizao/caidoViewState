import { Classic } from "@caido/primevue";
import PrimeVue from "primevue/config";
import { createApp } from "vue";

import type { Caido } from "@caido/sdk-frontend";
import { SDKPlugin } from "./plugins/sdk";
import ViewStateAnalyzer from "./ViewStateAnalyzer.vue";
import App from "./views/App.vue";

// Plugin constants
const PLUGIN_ID = "viewstate-decoder";
const PLUGIN_NAME = "ViewState Decoder";

/**
 * Register the ViewState view mode in all request contexts
 */
function registerViewModes(sdk: Caido) {
  const viewModeOptions = {
    label: "ViewState",
    view: {
      component: ViewStateAnalyzer,
    },
  };

  const contexts = [
    { name: "httpHistory", register: () => sdk.httpHistory.addRequestViewMode(viewModeOptions) },
    { name: "replay", register: () => sdk.replay.addRequestViewMode(viewModeOptions) },
    { name: "search", register: () => sdk.search.addRequestViewMode(viewModeOptions) },
    { name: "sitemap", register: () => sdk.sitemap.addRequestViewMode(viewModeOptions) },
    { name: "automate", register: () => sdk.automate.addRequestViewMode(viewModeOptions) },
    { name: "findings", register: () => sdk.findings.addRequestViewMode(viewModeOptions) },
    { name: "intercept", register: () => sdk.intercept.addRequestViewMode(viewModeOptions) },
  ];

  for (const context of contexts) {
    try {
      context.register();
      console.log(`[ViewState Plugin] Registered in ${context.name}`);
    } catch (e) {
      console.error(`[ViewState Plugin] Failed to register in ${context.name}:`, e);
    }
  }
}

/**
 * Initialize the plugin
 */
export function init(sdk: Caido) {
  console.log("[ViewState Plugin] Initializing...");

  // Create Vue app
  const app = createApp(App);

  // Use PrimeVue with Caido theme
  app.use(PrimeVue, {
    unstyled: true,
    pt: Classic,
  });

  // Use SDK plugin
  app.use(SDKPlugin, sdk);

  // Create root element
  const root = document.createElement("div");
  Object.assign(root.style, {
    height: "100%",
    width: "100%",
  });
  root.id = "plugin--viewstate-decoder";

  // Mount app
  app.mount(root);

  // Register page
  sdk.navigation.addPage("/viewstate", {
    body: root,
  });

  // Register sidebar item
  sdk.sidebar.registerItem(PLUGIN_NAME, "/viewstate", {
    icon: "fas fa-key",
  });

  console.log("[ViewState Plugin] Page registered");

  // Register view modes
  registerViewModes(sdk);

  // Register command
  sdk.commands.register(`${PLUGIN_ID}.open`, {
    name: "Open ViewState Decoder",
    run: () => {
      sdk.navigation.goTo("/viewstate");
    },
  });

  sdk.commandPalette.register(`${PLUGIN_ID}.open`);

  console.log("[ViewState Plugin] Initialization complete");

  sdk.window.showToast("ViewState Decoder plugin loaded", {
    variant: "success",
    duration: 3000,
  });
}
