import { Classic } from "@caido/primevue";
import PrimeVue from "primevue/config";
import { createApp } from "vue";

import type { Caido } from "@caido/sdk-frontend";
import type { API } from "../../backend/src/index";
import { SDKPlugin } from "./plugins/sdk";
import ViewStateAnalyzer from "./ViewStateAnalyzer.vue";
import App from "./views/App.vue";
import { setPendingViewStateData } from "./stores/viewstate-store";

// Plugin constants
const PLUGIN_ID = "viewstate-decoder";
const PLUGIN_NAME = "ViewState Decoder";

/**
 * Extract ViewState parameters from request body
 */
function extractViewStateFromBody(body: string): { viewState: string; generator: string } {
  const result = { viewState: '', generator: '' };
  
  if (!body) return result;
  
  // URL decode the body first
  let decodedBody = body;
  try {
    decodedBody = decodeURIComponent(body.replace(/\+/g, ' '));
  } catch (e) {
    // Keep original if decode fails
  }
  
  // Extract __VIEWSTATE
  const viewStateMatch = decodedBody.match(/__VIEWSTATE=([^&]+)/i) || 
                         body.match(/__VIEWSTATE=([^&]+)/i);
  if (viewStateMatch) {
    result.viewState = viewStateMatch[1];
  }
  
  // Extract __VIEWSTATEGENERATOR
  const generatorMatch = decodedBody.match(/__VIEWSTATEGENERATOR=([^&]+)/i) ||
                         body.match(/__VIEWSTATEGENERATOR=([^&]+)/i);
  if (generatorMatch) {
    result.generator = generatorMatch[1];
  }
  
  return result;
}

/**
 * Extract application path from URL or request
 */
function extractAppPath(request: any): string {
  try {
    // Try to get path directly
    if (request.path) {
      return request.path;
    }
    
    // Try getPath method
    if (typeof request.getPath === 'function') {
      return request.getPath();
    }
    
    // Try URL
    const url = request.url || request.getUrl?.();
    if (url) {
      const urlObj = new URL(url);
      return urlObj.pathname;
    }
    
    return '/';
  } catch (e) {
    return '/';
  }
}

/**
 * Get request body from request object
 */
async function getRequestBody(request: any, context: any): Promise<string> {
  console.log('[ViewState] Getting body from request...');
  console.log('[ViewState] Request keys:', Object.keys(request || {}));
  console.log('[ViewState] Request:', request);
  
  // Log all available methods and properties
  for (const key of Object.keys(request || {})) {
    const type = typeof request[key];
    console.log(`[ViewState] request.${key} = ${type}${type === 'string' ? ` ("${request[key]?.substring?.(0, 50)}...")` : ''}`);
  }
  
  // Method 1: Try getRaw method (for RequestContext)
  if (typeof request.getRaw === 'function') {
    try {
      console.log('[ViewState] Trying getRaw()...');
      const rawData = request.getRaw();
      console.log('[ViewState] rawData:', rawData);
      const rawString = rawData?.toText?.() || (typeof rawData === 'string' ? rawData : '');
      console.log('[ViewState] rawString length:', rawString?.length);
      if (rawString) {
        const bodyStart = rawString.indexOf('\r\n\r\n');
        if (bodyStart !== -1) {
          const body = rawString.substring(bodyStart + 4);
          console.log('[ViewState] Body from getRaw:', body?.substring(0, 100));
          return body;
        }
      }
    } catch (e) {
      console.log('[ViewState] getRaw failed:', e);
    }
  }
  
  // Method 2: Try raw property directly
  if (request.raw) {
    try {
      console.log('[ViewState] Trying raw property...');
      const rawData = request.raw;
      const rawString = rawData?.toText?.() || (typeof rawData === 'string' ? rawData : '');
      if (rawString) {
        const bodyStart = rawString.indexOf('\r\n\r\n');
        if (bodyStart !== -1) {
          const body = rawString.substring(bodyStart + 4);
          console.log('[ViewState] Body from raw:', body?.substring(0, 100));
          return body;
        }
      }
    } catch (e) {
      console.log('[ViewState] raw property failed:', e);
    }
  }
  
  // Method 3: Try body property
  if (request.body) {
    console.log('[ViewState] Trying body property...');
    const body = typeof request.body === 'string' ? request.body : request.body?.toText?.() || '';
    console.log('[ViewState] Body from body:', body?.substring(0, 100));
    return body;
  }
  
  // Method 4: Try getBody method
  if (typeof request.getBody === 'function') {
    try {
      console.log('[ViewState] Trying getBody()...');
      const body = await request.getBody();
      console.log('[ViewState] Body from getBody:', body?.substring?.(0, 100));
      return body || '';
    } catch (e) {
      console.log('[ViewState] getBody failed:', e);
    }
  }
  
  // Method 5: For RequestRowContext, try to get the full request via API
  if (request.id) {
    console.log('[ViewState] Request has id:', request.id, '- might need to fetch full request');
  }
  
  console.log('[ViewState] Could not extract body from request');
  return '';
}

/**
 * Register the ViewState view mode in all request contexts
 */
function registerViewModes(sdk: Caido<API>) {
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
      console.log(`[ViewState Plugin] Registered view mode in ${context.name}`);
    } catch (e) {
      console.error(`[ViewState Plugin] Failed to register view mode in ${context.name}:`, e);
    }
  }
}

/**
 * Register context menu items
 */
function registerContextMenus(sdk: Caido<API>) {
  // Register command for sending to bruteforce
  sdk.commands.register(`${PLUGIN_ID}.sendToBruteforce`, {
    name: "Send to Bruteforce",
    group: "ViewState Analyzer",
    when: (context: any) => {
      return (
        context.type === "RequestRowContext" ||
        context.type === "RequestContext"
      );
    },
    run: async (context: any) => {
      console.log("[ViewState] Send to Bruteforce triggered");
      console.log("[ViewState] Context type:", context.type);
      
      try {
        let request: any = null;
        
        // Get request based on context type
        if (context.type === "RequestRowContext") {
          if (context.requests && context.requests.length > 0) {
            request = context.requests[0];
          }
        } else if (context.type === "RequestContext") {
          request = context.request;
        }
        
        if (!request) {
          sdk.window.showToast("No request selected", { variant: "error" });
          return;
        }
        
        console.log("[ViewState] Request:", request);
        
        // Get request body
        const body = await getRequestBody(request, context);
        console.log("[ViewState] Body length:", body?.length || 0);
        
        // Extract ViewState data
        const { viewState, generator } = extractViewStateFromBody(body);
        const appPath = extractAppPath(request);
        
        console.log("[ViewState] Extracted - VS:", viewState?.substring(0, 50), "Gen:", generator, "Path:", appPath);
        
        if (!viewState) {
          sdk.window.showToast("No __VIEWSTATE found in request body", { variant: "warning" });
          return;
        }
        
        // Store the data
        setPendingViewStateData({
          viewState,
          generator,
          appPath,
        });
        
        // Navigate to plugin page
        sdk.navigation.goTo("/viewstate");
        
        sdk.window.showToast("ViewState sent to Bruteforce", { variant: "success" });
        
      } catch (error) {
        console.error("[ViewState] Error:", error);
        sdk.window.showToast("Error: " + String(error), { variant: "error" });
      }
    },
  });

  // Register context menu items for RequestRow (list view)
  sdk.menu.registerItem({
    type: "RequestRow",
    commandId: `${PLUGIN_ID}.sendToBruteforce`,
    leadingIcon: "fas fa-key",
  });

  // Register context menu items for Request (detail view)
  sdk.menu.registerItem({
    type: "Request",
    commandId: `${PLUGIN_ID}.sendToBruteforce`,
    leadingIcon: "fas fa-key",
  });

  console.log("[ViewState Plugin] Context menu items registered");
}

/**
 * Initialize the plugin
 */
export function init(sdk: Caido<API>) {
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

  // Register context menus
  registerContextMenus(sdk);

  // Register command for opening the plugin
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
