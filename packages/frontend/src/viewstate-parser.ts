/**
 * ViewState Analysis Result
 */
export interface ViewStateAnalysis {
  isValid: boolean;
  isEncrypted: boolean;
  isSigned: boolean;
  raw: string;
  decoded?: string;
  error?: string;
  details: {
    version?: string;
    hasHMAC?: boolean;
    macType?: 'SHA1' | 'SHA256' | 'Unknown';
    encryptionDetected?: boolean;
    isCompressed?: boolean;
    dotNetVersion?: string;
    controlTree?: string[];
    entropy?: number;
    entropy32?: number;
    entropy20?: number;
    hasPlaintextMarkers?: boolean;
    hasReadableStrings?: boolean;
    nullByteRatio?: number;
  };
}

/**
 * Parse and analyze ASP.NET ViewState
 */
export class ViewStateParser {
  /**
   * Analyze a ViewState string
   */
  static analyze(viewState: string): ViewStateAnalysis {
    const result: ViewStateAnalysis = {
      isValid: false,
      isEncrypted: false,
      isSigned: false,
      raw: viewState,
      details: {},
    };

    if (!viewState || viewState.trim().length === 0) {
      result.error = "Empty ViewState";
      return result;
    }

    try {
      // Decode from base64
      const decoded = atob(viewState.replace(/-/g, "+").replace(/_/g, "/"));
      result.decoded = decoded;
      result.isValid = true;

      // Check ViewState version (first byte)
      const firstByte = decoded.charCodeAt(0);
      result.details.version = `0x${firstByte.toString(16).padStart(2, "0")}`;

      // Check for compression (like berrry.app)
      result.details.isCompressed = decoded.startsWith('\xff\x01');
      if (result.details.isCompressed) {
        result.details.dotNetVersion = '.NET 2.0+';
      } else if (decoded.includes('System.Web.UI')) {
        result.details.dotNetVersion = '.NET Framework';
      } else {
        result.details.dotNetVersion = 'Unknown';
      }

      // Extract control tree (like berrry.app)
      result.details.controlTree = this.extractControls(decoded);

      // Calculate metrics for analysis
      const entropy = this.calculateEntropy(decoded);
      const last32Bytes = decoded.slice(-32);
      const last20Bytes = decoded.slice(-20);
      const entropy32 = this.calculateEntropy(last32Bytes);
      const entropy20 = this.calculateEntropy(last20Bytes);
      const hasPlaintextMarkers = /[\x0f\x1e\x1f]/.test(decoded);
      const hasReadableStrings = /[a-zA-Z]{4,}/.test(decoded);
      const nullByteCount = (decoded.match(/\x00/g) || []).length;
      const nullByteRatio = nullByteCount / decoded.length;

      // Store metrics in details
      result.details.entropy = entropy;
      result.details.entropy32 = entropy32;
      result.details.entropy20 = entropy20;
      result.details.hasPlaintextMarkers = hasPlaintextMarkers;
      result.details.hasReadableStrings = hasReadableStrings;
      result.details.nullByteRatio = nullByteRatio;

      // Check for HMAC signature
      // ViewState with MAC signature typically has a specific structure
      // The signature is usually at the end and is 32 bytes (SHA256) or 20 bytes (SHA1)
      const macInfo = this.checkForHMAC(decoded);
      result.isSigned = macInfo.detected;
      result.details.hasHMAC = macInfo.detected;
      result.details.macType = macInfo.type;

      // Check for encryption
      // Encrypted ViewState has high entropy and specific patterns
      result.isEncrypted = this.checkForEncryption(decoded);
      result.details.encryptionDetected = result.isEncrypted;

      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Invalid base64";
      return result;
    }
  }

  /**
   * Check if ViewState contains HMAC signature
   * Based on Burp ViewState Editor logic:
   * After deserializing the ViewState structure, if there are exactly 20 or 32 bytes remaining,
   * these are the MAC signature (SHA1 = 20 bytes, SHA256 = 32 bytes)
   */
  private static checkForHMAC(decoded: string): { detected: boolean; type: 'SHA1' | 'SHA256' | 'Unknown' } {
    const length = decoded.length;

    if (length < 20) {
      return { detected: false, type: 'Unknown' };
    }

    // Method 1: Burp ViewState Editor approach
    // Check if last 20 or 32 bytes look like a hash signature
    // A proper implementation would deserialize the ViewState structure first,
    // but we can use heuristics to detect the signature

    // Check the last 20 and 32 bytes for high entropy (hash signatures have high entropy)
    const last20Bytes = decoded.slice(-20);
    const last32Bytes = decoded.slice(-32);

    const entropy20 = this.calculateEntropy(last20Bytes);
    const entropy32 = this.calculateEntropy(last32Bytes);

    console.log('[ViewState] MAC Check - Last 20 bytes entropy:', entropy20.toFixed(2));
    console.log('[ViewState] MAC Check - Last 32 bytes entropy:', entropy32.toFixed(2));

    // Hash signatures have VERY high entropy (close to 8.0)
    // We use a high threshold to avoid false positives
    const hasHighEntropySignature = entropy20 > 7.5 || entropy32 > 7.5;

    // Method 2: Check if last bytes are all non-printable (binary hash)
    // Hash signatures typically don't contain readable ASCII
    const hasOnlyNonPrintable20 = !/[^\x00-\x1f\x7f-\xff]/.test(last20Bytes);
    const hasOnlyNonPrintable32 = !/[^\x00-\x1f\x7f-\xff]/.test(last32Bytes);

    console.log('[ViewState] MAC Check - Last 20 bytes non-printable:', hasOnlyNonPrintable20);
    console.log('[ViewState] MAC Check - Last 32 bytes non-printable:', hasOnlyNonPrintable32);

    // Signature is present if we have high entropy binary data at the end
    const macDetected = hasHighEntropySignature || hasOnlyNonPrintable20 || hasOnlyNonPrintable32;

    if (!macDetected) {
      return { detected: false, type: 'Unknown' };
    }

    // Determine MAC type based on which has higher entropy
    let macType: 'SHA1' | 'SHA256' | 'Unknown' = 'Unknown';

    if (entropy32 > 7.5 && entropy32 > entropy20) {
      macType = 'SHA256';
      console.log('[ViewState] MAC Check - Detected SHA256 (32 bytes)');
    } else if (entropy20 > 7.5) {
      macType = 'SHA1';
      console.log('[ViewState] MAC Check - Detected SHA1 (20 bytes)');
    } else if (hasOnlyNonPrintable32) {
      macType = 'SHA256';
      console.log('[ViewState] MAC Check - Detected SHA256 (32 bytes, by non-printable pattern)');
    } else if (hasOnlyNonPrintable20) {
      macType = 'SHA1';
      console.log('[ViewState] MAC Check - Detected SHA1 (20 bytes, by non-printable pattern)');
    }

    return { detected: true, type: macType };
  }

  /**
   * Extract control tree from ViewState (like berrry.app)
   */
  private static extractControls(decoded: string): string[] {
    // Look for ASP.NET control names
    const controlMatches = decoded.match(/(\w+Control|\w+Page)/g) || [];
    return [...new Set(controlMatches)].slice(0, 10);
  }

  /**
   * Check if ViewState is encrypted
   * Based on berrry.app logic: if we can extract controls/structure, it's NOT encrypted
   */
  private static checkForEncryption(decoded: string): boolean {
    console.log('[ViewState] Encryption Check - Data length:', decoded.length);

    // KEY INSIGHT from berrry.app:
    // If ViewState is encrypted, we CANNOT extract any control structure
    // Encrypted ViewState is just random bytes with no readable patterns

    // Check 1: Can we find ASP.NET control names?
    const controls = this.extractControls(decoded);
    console.log('[ViewState] Encryption Check - Controls found:', controls.length);

    if (controls.length > 0) {
      // If we can extract controls, definitely NOT encrypted
      console.log('[ViewState] Encryption Check - Controls detected, NOT encrypted');
      return false;
    }

    // Check 2: Look for readable strings (control IDs, property names, etc.)
    const readableStrings = decoded.match(/[a-zA-Z]{3,}/g) || [];
    console.log('[ViewState] Encryption Check - Readable strings found:', readableStrings.length);

    if (readableStrings.length > 5) {
      // Multiple readable strings = NOT encrypted
      console.log('[ViewState] Encryption Check - Multiple readable strings, NOT encrypted');
      return false;
    }

    // Check 3: Look for System.Web.UI or other .NET markers
    if (decoded.includes('System.Web.UI') || decoded.includes('System.') || decoded.includes('Control')) {
      console.log('[ViewState] Encryption Check - .NET markers found, NOT encrypted');
      return false;
    }

    // Check 4: Check for ASP.NET type markers (serialization format)
    const hasPlaintextMarkers = /[\x0f\x1e\x1f\x02\x03\x64]/.test(decoded);
    if (hasPlaintextMarkers) {
      console.log('[ViewState] Encryption Check - Serialization markers found, NOT encrypted');
      return false;
    }

    // Check 5: If it's compressed (.NET 2.0+) but we can't read structure
    // It might still be encrypted
    const isCompressed = decoded.startsWith('\xff\x01');
    if (isCompressed) {
      console.log('[ViewState] Encryption Check - Compressed data detected');
      // Compressed + no readable structure = likely encrypted
      return true;
    }

    // Check 6: High uniform entropy with no structure = encrypted
    const entropy = this.calculateEntropy(decoded);
    console.log('[ViewState] Encryption Check - Overall entropy:', entropy.toFixed(2));

    // If entropy is VERY high (> 7.8) and no readable data, it's encrypted
    if (entropy > 7.8) {
      console.log('[ViewState] Encryption Check - Very high entropy, likely encrypted');
      return true;
    }

    // Default: if we can't determine, assume NOT encrypted (conservative)
    console.log('[ViewState] Encryption Check - Cannot determine, assuming NOT encrypted');
    return false;
  }

  /**
   * Calculate Shannon entropy of a string
   */
  private static calculateEntropy(data: string): number {
    const len = data.length;
    const frequencies: { [key: number]: number } = {};

    // Count byte frequencies
    for (let i = 0; i < len; i++) {
      const byte = data.charCodeAt(i);
      frequencies[byte] = (frequencies[byte] || 0) + 1;
    }

    // Calculate entropy
    let entropy = 0;
    for (const byte in frequencies) {
      const p = frequencies[byte] / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Extract ViewState from request body or query parameters
   */
  static extractViewState(body: string): string[] {
    const viewStates: string[] = [];

    // Match __VIEWSTATE parameter
    const viewStateRegex = /__VIEWSTATE=([^&\s]+)/gi;
    let match;

    while ((match = viewStateRegex.exec(body)) !== null) {
      viewStates.push(decodeURIComponent(match[1]));
    }

    return viewStates;
  }
}
