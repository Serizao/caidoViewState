import type { Caido } from "@caido/sdk-frontend";
import ViewStateAnalyzer from "./ViewStateAnalyzer.vue";

/**
 * ViewState Analyzer Plugin
 * Adds a custom view mode to analyze ASP.NET ViewState
 */
export function init(caido: Caido) {
  console.log("[ViewState Plugin] Initializing...");

  // Register custom request view mode in multiple contexts
  const viewModeOptions = {
    label: "ViewState",
    view: {
      component: ViewStateAnalyzer,
    },
  };

  // Add view mode to all relevant contexts
  console.log("[ViewState Plugin] Registering view modes...");

  try {
    caido.httpHistory.addRequestViewMode(viewModeOptions);
    console.log("[ViewState Plugin] Registered in httpHistory");
  } catch (e) {
    console.error("[ViewState Plugin] Failed to register in httpHistory:", e);
  }

  try {
    caido.replay.addRequestViewMode(viewModeOptions);
    console.log("[ViewState Plugin] Registered in replay");
  } catch (e) {
    console.error("[ViewState Plugin] Failed to register in replay:", e);
  }

  try {
    caido.search.addRequestViewMode(viewModeOptions);
    console.log("[ViewState Plugin] Registered in search");
  } catch (e) {
    console.error("[ViewState Plugin] Failed to register in search:", e);
  }

  try {
    caido.sitemap.addRequestViewMode(viewModeOptions);
    console.log("[ViewState Plugin] Registered in sitemap");
  } catch (e) {
    console.error("[ViewState Plugin] Failed to register in sitemap:", e);
  }

  try {
    caido.automate.addRequestViewMode(viewModeOptions);
    console.log("[ViewState Plugin] Registered in automate");
  } catch (e) {
    console.error("[ViewState Plugin] Failed to register in automate:", e);
  }

  try {
    caido.findings.addRequestViewMode(viewModeOptions);
    console.log("[ViewState Plugin] Registered in findings");
  } catch (e) {
    console.error("[ViewState Plugin] Failed to register in findings:", e);
  }

  try {
    caido.intercept.addRequestViewMode(viewModeOptions);
    console.log("[ViewState Plugin] Registered in intercept");
  } catch (e) {
    console.error("[ViewState Plugin] Failed to register in intercept:", e);
  }

  console.log("[ViewState Plugin] Initialization complete");

  caido.window.showToast("ViewState Analyzer plugin loaded", {
    variant: "success",
    duration: 3000,
  });
}
