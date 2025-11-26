import type { SDK, DefineAPI } from "caido:plugin";
import { readFile } from "fs/promises";

// Define the API that will be exposed to the frontend
export type API = DefineAPI<{
  // Get list of hosted files (not used - frontend uses sdk.files directly)
  getHostedFiles: () => Promise<{ id: string; name: string; size: number }[]>;
  // Get content of a hosted file by path
  getHostedFileContent: (id: string) => Promise<string>;
  // Read file by path directly
  readFileByPath: (path: string) => Promise<string>;
}>;

export function init(sdk: SDK<API>) {
  console.log("[ViewState] Backend initializing...");
  
  // Register API to get list of hosted files
  sdk.api.register("getHostedFiles", async () => {
    // This is now handled by the frontend directly
    return [];
  });

  // Register API to get content of a hosted file
  sdk.api.register("getHostedFileContent", async (...args: unknown[]) => {
    // args[0] is context, args[1] is the actual parameter
    const id = args[1] as string;
    console.log("[ViewState] getHostedFileContent called with id:", id);
    
    if (!id || typeof id !== 'string') {
      throw new Error(`Invalid file ID: ${id}`);
    }
    
    // Try to construct the path based on Caido's file storage pattern
    // Caido stores files in: ~/Library/Application Support/io.caido.Caido/files/{id}
    const possiblePaths = [
      `/Users/${process.env.USER}/Library/Application Support/io.caido.Caido/files/${id}`,
      `${process.env.HOME}/Library/Application Support/io.caido.Caido/files/${id}`,
      // Linux paths
      `${process.env.HOME}/.local/share/caido/files/${id}`,
      `${process.env.HOME}/.caido/files/${id}`,
    ];
    
    for (const filePath of possiblePaths) {
      try {
        console.log("[ViewState] Trying to read from:", filePath);
        const content = await readFile(filePath, 'utf-8');
        console.log("[ViewState] Successfully read file, length:", content.length);
        return content;
      } catch (e) {
        // Try next path
        continue;
      }
    }
    
    throw new Error(`Could not find file: ${id}`);
  });

  // Register API to read file by path directly
  sdk.api.register("readFileByPath", async (...args: unknown[]) => {
    const path = args[1] as string;
    console.log("[ViewState] readFileByPath called with path:", path);
    
    if (!path || typeof path !== 'string') {
      throw new Error(`Invalid path: ${path}`);
    }
    
    try {
      const content = await readFile(path, 'utf-8');
      console.log("[ViewState] Successfully read file, length:", content.length);
      return content;
    } catch (error) {
      console.error("[ViewState] Error reading file:", error);
      throw error;
    }
  });

  console.log("[ViewState] Backend initialized successfully");
}
