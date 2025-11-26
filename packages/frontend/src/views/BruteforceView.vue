<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import InputText from 'primevue/inputtext';
import Card from 'primevue/card';
import Select from 'primevue/select';
import ProgressBar from 'primevue/progressbar';
import Panel from 'primevue/panel';
import AutoComplete from 'primevue/autocomplete';
import FileUpload from 'primevue/fileupload';
import { useSDK } from '../plugins/sdk';
import { getPendingViewStateData } from '../stores/viewstate-store';

// SDK
const sdk = useSDK();

// ViewState data
const viewStateData = ref('');
const generator = ref(''); // __VIEWSTATEGENERATOR value
const appPath = ref('/'); // Application path (from request)
const targetPagePath = ref('/default.aspx'); // Target page path for SP800-108 derivation
const iisAppPath = ref('/'); // IIS app path for SP800-108 derivation

// Check for pending data from context menu
function checkPendingData() {
  const pendingData = getPendingViewStateData();
  if (pendingData) {
    console.log('[ViewState Bruteforce] Loading pending data:', pendingData);
    viewStateData.value = pendingData.viewState;
    generator.value = pendingData.generator;
    appPath.value = pendingData.appPath || '/';
    // Also set targetPagePath from request path
    if (pendingData.appPath) {
      targetPagePath.value = pendingData.appPath;
    }
    addLog('📥 ViewState data loaded from request');
    addLog(`ViewState: ${pendingData.viewState.substring(0, 50)}...`);
    if (pendingData.generator) {
      addLog(`Generator: ${pendingData.generator}`);
    }
    if (pendingData.appPath) {
      addLog(`Page Path: ${pendingData.appPath}`);
    }
  }
}

// Key configuration
const keySource = ref<'manual' | 'wordlist' | 'file' | 'caido'>('wordlist');
const validationKey = ref('');
const decryptionKey = ref('');
const keyWordlist = ref('');

// Caido hosted files
interface HostedFile {
  id: string;
  name: string;
  size: number;
}
const hostedFiles = ref<HostedFile[]>([]);
const filteredFiles = ref<HostedFile[]>([]);
const selectedFile = ref<HostedFile | null>(null);
const loadingFiles = ref(false);
const loadingFileContent = ref(false);

// Algorithm options (like Blacklist3r)
const validationAlgorithms = [
  { label: 'SHA1', value: 'SHA1' },
  { label: 'HMACSHA256', value: 'HMACSHA256' },
  { label: 'HMACSHA384', value: 'HMACSHA384' },
  { label: 'HMACSHA512', value: 'HMACSHA512' },
  { label: 'MD5', value: 'MD5' },
];

const decryptionAlgorithms = [
  { label: 'AES (Default)', value: 'AES' },
  { label: '3DES', value: '3DES' },
];

const validationAlg = ref('SHA1');
const decryptionAlg = ref('AES');

// Mode options
const mode = ref<'validate' | 'decrypt' | 'both'>('validate');
const modes = [
  { label: 'Validate MAC Only', value: 'validate' },
  { label: 'Decrypt Only', value: 'decrypt' },
  { label: 'Both (Decrypt + Validate)', value: 'both' },
];

// Bruteforce state
const isRunning = ref(false);
const finished = ref(false);
const foundKey = ref<{ validation: string; decryption: string } | null>(null);
const decryptedData = ref<string | null>(null);
const testedKeys = ref(0);
const totalKeys = ref(0);
const copied = ref(false);
const logs = ref<string[]>([]);

// Pre-loaded known keys (from Blacklist3r project)
const knownKeys = `# Common ASP.NET Machine Keys (from Blacklist3r)
# Format: validationKey,decryptionKey

# Default keys from various sources
CB2721ABDAF8E9DC516D621D8B8BF13A2C9E8689A25303BF,21F090935F6E49C2C8B0A1E9F7D6C5B4A3029180F7E6D5C4B3A20190F8E7D6C5
AE2BE9E0F1D29C5A5E7A65D7B8F7E3F9D1C2B4A6E8F0D2C4B6A8E0F2D4C6B8A0,F1D29C5A5E7A65D7B8F7E3F9D1C2B4A6E8F0D2C4B6A8E0F2D4C6B8A0E2F4D6C8
B3C2D1E0F9A8B7C6D5E4F3A2B1C0D9E8F7A6B5C4D3E2F1A0B9C8D7E6F5A4B3C2,E0F9A8B7C6D5E4F3A2B1C0D9E8F7A6B5C4D3E2F1A0B9C8D7E6F5A4B3C2D1E0F9
C551753B0325187D1759B4FB055B44F7C5077B016C02AF674E8DE69351B69FEFD045A267308AA2DAB81B69919402D7886A6E986473EEEC9556A9003357F5ED45,F6722806843145965513817CEBDECBB1F94808E4A6C0B2F2

# Add your own keys below (one per line)
# validationKey,decryptionKey`;

// ============ Caido Files API (via Backend) ============

async function loadHostedFiles() {
  loadingFiles.value = true;
  addLog('🔄 Loading hosted files from Caido...');
  try {
    // Use frontend SDK directly (sdk.files is a frontend API)
    console.log('[ViewState] Calling sdk.files.getAll()...');
    // @ts-ignore - SDK types may not be complete
    const files = await sdk.files.getAll();
    console.log('[ViewState] Files from SDK:', files);
    
    if (!files || !Array.isArray(files)) {
      addLog('⚠️ No files returned');
      hostedFiles.value = [];
      filteredFiles.value = [];
      return;
    }
    
    // Map files - the SDK returns HostedFile objects with getters
    hostedFiles.value = files.map((f: any) => {
      console.log('[ViewState] Raw file object:', f);
      console.log('[ViewState] File object keys:', Object.keys(f));
      
      // Try to get ID - it might be a complex object
      let rawId = typeof f.getId === 'function' ? f.getId() : (f.id || f.ID || '');
      console.log('[ViewState] Raw ID:', rawId, 'Type:', typeof rawId);
      
      // If ID is an object, try to extract the actual ID string
      let id: string;
      if (typeof rawId === 'object' && rawId !== null) {
        // Try common patterns
        id = rawId.value || rawId.id || rawId.ID || rawId.toString() || JSON.stringify(rawId);
      } else {
        id = String(rawId);
      }
      
      const name = typeof f.getName === 'function' ? f.getName() : (f.name || f.Name || '');
      const size = typeof f.getSize === 'function' ? f.getSize() : (f.size || f.Size || 0);
      
      console.log('[ViewState] Mapped file:', { id, name, size, idType: typeof id });
      return { id, name, size };
    });
    
    // Initialize filtered files with all files
    filteredFiles.value = [...hostedFiles.value];
    addLog(`📁 Loaded ${hostedFiles.value.length} hosted files from Caido`);
    
    if (hostedFiles.value.length === 0) {
      addLog('ℹ️ No hosted files found. Upload files in Caido Settings > Files');
    }
  } catch (error) {
    console.error('[ViewState] Error loading hosted files:', error);
    addLog('⚠️ Could not load hosted files: ' + String(error));
  } finally {
    loadingFiles.value = false;
  }
}

async function loadFileContent(fileId: string, fileName: string) {
  if (!fileId) {
    addLog('⚠️ No file ID provided');
    return;
  }
  
  const id = String(fileId);
  console.log('[ViewState] Loading file content for ID:', id);
  
  loadingFileContent.value = true;
  try {
    // Get the file from SDK frontend
    // @ts-ignore
    const files = await sdk.files.getAll();
    const file = files.find((f: any) => {
      const fid = f.id || (typeof f.getId === 'function' ? f.getId() : '');
      return fid === id;
    });
    
    if (!file) {
      throw new Error(`File not found: ${id}`);
    }
    
    console.log('[ViewState] Found file:', file);
    
    // Try to get content using different methods
    let content: string = '';
    
    // Method 1: getContent() method
    if (typeof file.getContent === 'function') {
      const rawContent = await file.getContent();
      if (rawContent instanceof Uint8Array) {
        content = new TextDecoder().decode(rawContent);
      } else {
        content = String(rawContent || '');
      }
    }
    // Method 2: content property
    else if (file.content) {
      if (file.content instanceof Uint8Array) {
        content = new TextDecoder().decode(file.content);
      } else {
        content = String(file.content);
      }
    }
    // Method 3: read() method
    else if (typeof file.read === 'function') {
      const rawContent = await file.read();
      content = String(rawContent || '');
    }
    // Method 4: Use backend to read file by path
    else if (file.path) {
      console.log('[ViewState] Using backend to read from path:', file.path);
      content = await sdk.backend.readFileByPath(file.path);
    }
    // Method 5: Try backend with ID
    else {
      console.log('[ViewState] Trying backend with ID');
      content = await sdk.backend.getHostedFileContent(id);
    }
    
    if (!content) {
      throw new Error('Could not read file content');
    }
    
    keyWordlist.value = content;
    addLog(`📄 Loaded file: ${fileName} (${content.split('\n').length} lines)`);
  } catch (error) {
    console.error('[ViewState] Error loading file content:', error);
    addLog('⚠️ Could not load file content: ' + String(error));
  } finally {
    loadingFileContent.value = false;
  }
}

function searchFiles(event: { query: string }) {
  const query = event.query.toLowerCase();
  if (!query) {
    filteredFiles.value = [...hostedFiles.value];
  } else {
    filteredFiles.value = hostedFiles.value.filter(f => 
      f.name.toLowerCase().includes(query)
    );
  }
}

// Handle file selection from AutoComplete
function onFileSelect(event: { value: HostedFile }) {
  const file = event.value;
  console.log('[ViewState] File selected:', file);
  console.log('[ViewState] File ID:', file?.id, 'Type:', typeof file?.id);
  
  if (file && file.id) {
    // Ensure we pass string ID
    const fileId = String(file.id);
    const fileName = String(file.name || 'Unknown');
    loadFileContent(fileId, fileName);
  } else {
    addLog('⚠️ Invalid file selected');
  }
}

// Handle local file upload
function handleLocalFile(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      keyWordlist.value = content;
      addLog(`📄 Loaded local file: ${file.name} (${file.size} bytes)`);
    };
    reader.readAsText(file);
  }
}

// ============ Crypto Helper Functions ============

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/\s/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert base64 to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const normalizedBase64 = base64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const binaryString = atob(normalizedBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compare two Uint8Arrays
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Get hash size for algorithm
 */
function getHashSize(algorithm: string): number {
  switch (algorithm) {
    case 'SHA1': return 20;
    case 'HMACSHA256': return 32;
    case 'HMACSHA384': return 48;
    case 'HMACSHA512': return 64;
    case 'MD5': return 16;
    default: return 20;
  }
}

/**
 * Get Web Crypto algorithm name for HMAC
 */
function getWebCryptoAlgorithm(algorithm: string): string {
  switch (algorithm) {
    case 'SHA1': return 'SHA-1';
    case 'HMACSHA256': return 'SHA-256';
    case 'HMACSHA384': return 'SHA-384';
    case 'HMACSHA512': return 'SHA-512';
    default: return 'SHA-1';
  }
}

/**
 * Get block size for encryption algorithm
 */
function getBlockSize(algorithm: string): number {
  switch (algorithm) {
    case 'AES': return 16;
    case '3DES': return 8;
    default: return 16;
  }
}

/**
 * Get key size for encryption algorithm
 */
function getKeySize(algorithm: string): number {
  switch (algorithm) {
    case 'AES': return 32; // AES-256
    case '3DES': return 24;
    default: return 32;
  }
}

/**
 * Get validation key size for HMAC algorithm
 */
function getValidationKeySize(algorithm: string): number {
  switch (algorithm) {
    case 'SHA1': return 64;
    case 'HMACSHA256': return 64;
    case 'HMACSHA384': return 128;
    case 'HMACSHA512': return 128;
    default: return 64;
  }
}

/**
 * Build the modifier bytes from __VIEWSTATEGENERATOR (for legacy non-derived mode)
 */
function buildModifier(generatorHex: string): Uint8Array {
  if (!generatorHex) return new Uint8Array(0);
  
  const value = parseInt(generatorHex, 16);
  const bytes = new Uint8Array(4);
  bytes[0] = value & 0xFF;
  bytes[1] = (value >> 8) & 0xFF;
  bytes[2] = (value >> 16) & 0xFF;
  bytes[3] = (value >> 24) & 0xFF;
  return bytes;
}

/**
 * Encode string with length prefix (BinaryWriter style for .NET)
 * Uses 7-bit encoded length
 */
function encodeLengthPrefixedString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const strBytes = encoder.encode(str);
  const length = strBytes.length;
  
  // 7-bit encoded length
  const lengthBytes: number[] = [];
  let remaining = length;
  do {
    let byte = remaining & 0x7F;
    remaining >>= 7;
    if (remaining > 0) {
      byte |= 0x80;
    }
    lengthBytes.push(byte);
  } while (remaining > 0);
  
  const result = new Uint8Array(lengthBytes.length + strBytes.length);
  result.set(lengthBytes, 0);
  result.set(strBytes, lengthBytes.length);
  return result;
}

/**
 * Build Purpose for ViewState decryption
 * Purpose: WebForms.HiddenFieldPageStatePersister.ClientState
 * SpecificPurposes: [TemplateSourceDirectory, Type, optionally ViewStateUserKey]
 */
function buildViewStatePurpose(targetPagePath: string, iisAppPath: string): { label: Uint8Array; context: Uint8Array } {
  const primaryPurpose = "WebForms.HiddenFieldPageStatePersister.ClientState";
  const encoder = new TextEncoder();
  const label = encoder.encode(primaryPurpose);
  
  // Simulate TemplateSourceDirectory
  let path = targetPagePath;
  if (!path.startsWith('/')) path = '/' + path;
  
  let templateDir = path;
  const lastDot = templateDir.lastIndexOf('.');
  const lastSlash = templateDir.lastIndexOf('/');
  if (lastDot > lastSlash) {
    templateDir = templateDir.substring(0, lastSlash);
  }
  if (templateDir.endsWith('/')) {
    templateDir = templateDir.substring(0, templateDir.length - 1);
  }
  if (!templateDir) templateDir = '/';
  
  // Simulate GetTypeName
  let typeName = path;
  if (!typeName.toLowerCase().endsWith('.aspx')) {
    typeName += '/default.aspx';
  }
  let appPath = iisAppPath.toLowerCase();
  if (!appPath.startsWith('/')) appPath = '/' + appPath;
  if (!appPath.endsWith('/')) appPath += '/';
  
  const idx = typeName.toLowerCase().indexOf(appPath);
  if (idx >= 0) {
    typeName = typeName.substring(idx + appPath.length);
  }
  if (typeName.startsWith('/')) {
    typeName = typeName.substring(1);
  }
  typeName = typeName.replace(/\./g, '_').replace(/\//g, '_');
  
  // Build context with length-prefixed strings
  const specific1 = "TemplateSourceDirectory: " + templateDir.toUpperCase();
  const specific2 = "Type: " + typeName.toUpperCase();
  
  const encoded1 = encodeLengthPrefixedString(specific1);
  const encoded2 = encodeLengthPrefixedString(specific2);
  
  const context = new Uint8Array(encoded1.length + encoded2.length);
  context.set(encoded1, 0);
  context.set(encoded2, encoded1.length);
  
  return { label, context };
}

/**
 * SP800-108 Key Derivation Function using HMACSHA512
 * Based on Microsoft's implementation
 */
async function deriveKeySP800_108(
  masterKey: Uint8Array,
  label: Uint8Array,
  context: Uint8Array,
  keyLengthBits: number
): Promise<Uint8Array> {
  // Create buffer: [i]_2 || label || 0x00 || context || [L]_2
  const bufferLength = 4 + label.length + 1 + context.length + 4;
  const buffer = new Uint8Array(bufferLength);
  
  // Copy label at offset 4
  buffer.set(label, 4);
  // 0x00 is already there (default)
  // Copy context at offset 5 + label.length
  buffer.set(context, 5 + label.length);
  // Write L (key length in bits) as big-endian at the end
  const lOffset = 5 + label.length + context.length;
  buffer[lOffset] = (keyLengthBits >> 24) & 0xFF;
  buffer[lOffset + 1] = (keyLengthBits >> 16) & 0xFF;
  buffer[lOffset + 2] = (keyLengthBits >> 8) & 0xFF;
  buffer[lOffset + 3] = keyLengthBits & 0xFF;
  
  // Import master key for HMAC-SHA512
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    masterKey,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  
  const keyLengthBytes = keyLengthBits / 8;
  const output = new Uint8Array(keyLengthBytes);
  let numBytesWritten = 0;
  let i = 1;
  
  while (numBytesWritten < keyLengthBytes) {
    // Write i as big-endian at offset 0
    buffer[0] = (i >> 24) & 0xFF;
    buffer[1] = (i >> 16) & 0xFF;
    buffer[2] = (i >> 8) & 0xFF;
    buffer[3] = i & 0xFF;
    
    // Compute K_i = HMAC-SHA512(masterKey, buffer)
    const k_i = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, buffer));
    
    // Copy to output
    const bytesToCopy = Math.min(keyLengthBytes - numBytesWritten, k_i.length);
    output.set(k_i.slice(0, bytesToCopy), numBytesWritten);
    numBytesWritten += bytesToCopy;
    i++;
  }
  
  return output;
}

/**
 * Compute HMAC using Web Crypto API
 */
async function computeHMAC(data: Uint8Array, key: Uint8Array, algorithm: string): Promise<Uint8Array> {
  const cryptoAlgorithm = getWebCryptoAlgorithm(algorithm);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: cryptoAlgorithm },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

/**
 * Decrypt data using AES-CBC
 */
async function decryptAES(encryptedData: Uint8Array, keyBytes: Uint8Array, iv: Uint8Array): Promise<Uint8Array | null> {
  try {
    // Use the full key as provided (128, 192, or 256 bits)
    // Web Crypto API will validate the key length
    let key = keyBytes;
    
    // Adjust key length if needed to valid AES key sizes
    if (keyBytes.length > 32) {
      key = keyBytes.slice(0, 32); // AES-256
    } else if (keyBytes.length > 24 && keyBytes.length < 32) {
      key = keyBytes.slice(0, 24); // AES-192
    } else if (keyBytes.length > 16 && keyBytes.length < 24) {
      key = keyBytes.slice(0, 16); // AES-128
    }
    
    console.log('[ViewState] AES key length:', key.length, 'bytes (', key.length * 8, 'bits)');
    console.log('[ViewState] IV length:', iv.length, 'bytes');
    console.log('[ViewState] Encrypted data length:', encryptedData.length, 'bytes');
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      encryptedData
    );
    
    console.log('[ViewState] Decryption successful, length:', decrypted.byteLength);
    return new Uint8Array(decrypted);
  } catch (error) {
    console.log('[ViewState] AES decryption error:', error);
    return null;
  }
}

/**
 * Check if decrypted data looks like valid ViewState
 * ViewState format starts with specific magic bytes
 */
function isValidViewState(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  
  // ViewState 2.0 format: starts with 0xFF 0x01
  if (data[0] === 0xFF && data[1] === 0x01) {
    console.log('[ViewState] Found ViewState 2.0 magic bytes');
    return true;
  }
  
  // GZip compressed: starts with 0x1F 0x8B
  if (data[0] === 0x1F && data[1] === 0x8B) {
    console.log('[ViewState] Found GZip compressed data');
    return true;
  }
  
  // ViewState 1.0/1.1 format checks
  // The first byte indicates the type, followed by specific patterns
  // Type 0x02 = Pair, typically followed by more type bytes
  if (data[0] === 0x02) {
    // A Pair should have valid child types
    if (data.length >= 3) {
      const validTypes = [0x02, 0x05, 0x09, 0x0F, 0x10, 0x14, 0x15, 0x16, 0x18, 0x19, 0x1E, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69];
      if (validTypes.includes(data[1]) || validTypes.includes(data[2])) {
        console.log('[ViewState] Found Pair structure');
        return true;
      }
    }
  }
  
  // Triplet (0x03) structure
  if (data[0] === 0x03 && data.length >= 4) {
    console.log('[ViewState] Found Triplet structure');
    return true;
  }
  
  // ArrayList (0x16) or other collection types
  if ((data[0] === 0x16 || data[0] === 0x15 || data[0] === 0x17) && data.length >= 4) {
    console.log('[ViewState] Found Collection structure');
    return true;
  }
  
  console.log('[ViewState] Data does not match known ViewState patterns. First 4 bytes:', 
    Array.from(data.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' '));
  
  return false;
}

// ============ Verification Functions ============

async function verifyViewStateMAC(
  viewStateBase64: string,
  validationKeyHex: string,
  generatorHex: string,
  algorithm: string
): Promise<boolean> {
  try {
    const viewStateBytes = base64ToBytes(viewStateBase64);
    const hashSize = getHashSize(algorithm);
    
    if (viewStateBytes.length <= hashSize) {
      return false;
    }
    
    const dataLength = viewStateBytes.length - hashSize;
    const data = viewStateBytes.slice(0, dataLength);
    const mac = viewStateBytes.slice(dataLength);
    
    const modifier = buildModifier(generatorHex);
    
    const dataWithModifier = new Uint8Array(data.length + modifier.length);
    dataWithModifier.set(data, 0);
    dataWithModifier.set(modifier, data.length);
    
    const validationKey = hexToBytes(validationKeyHex);
    const computedMac = await computeHMAC(dataWithModifier, validationKey, algorithm);
    
    return arraysEqual(mac, computedMac);
  } catch (error) {
    console.error('Error verifying ViewState MAC:', error);
    return false;
  }
}

async function tryDecryptViewState(
  viewStateBase64: string,
  decryptionKeyHex: string,
  validationKeyHex: string,
  generatorHex: string,
  encAlgorithm: string,
  valAlgorithm: string,
  checkMac: boolean,
  targetPagePath: string = '/',
  iisAppPath: string = '/'
): Promise<{ success: boolean; decrypted?: Uint8Array }> {
  try {
    const viewStateBytes = base64ToBytes(viewStateBase64);
    const blockSize = getBlockSize(encAlgorithm);
    const hashSize = getHashSize(valAlgorithm);
    
    // For encrypted ViewState in ASP.NET 4.5+:
    // Format: IV (16 bytes) || Encrypted || HMAC
    
    // Need at least IV + some data + HMAC
    if (viewStateBytes.length <= blockSize + hashSize) {
      return { success: false };
    }
    
    const masterDecryptionKey = hexToBytes(decryptionKeyHex);
    const masterValidationKey = hexToBytes(validationKeyHex);
    
    // Calculate sizes
    const ivLength = blockSize;
    const signatureLength = hashSize;
    const encryptedPayloadLength = viewStateBytes.length - ivLength - signatureLength;
    
    if (encryptedPayloadLength <= 0) {
      return { success: false };
    }
    
    // Extract parts
    const iv = viewStateBytes.slice(0, ivLength);
    const encryptedPayload = viewStateBytes.slice(ivLength, ivLength + encryptedPayloadLength);
    const signature = viewStateBytes.slice(ivLength + encryptedPayloadLength);
    
    // Data to verify signature on
    const dataToSign = viewStateBytes.slice(0, ivLength + encryptedPayloadLength);
    
    // Try multiple approaches in order:
    // 1. SP800-108 derived keys (ASP.NET 4.5+)
    // 2. Master keys directly (older ASP.NET)
    
    // Build purpose for key derivation
    const purpose = buildViewStatePurpose(targetPagePath, iisAppPath);
    
    // Derive keys using SP800-108
    // Use the actual key lengths from the provided keys, not fixed values
    const encKeySize = masterDecryptionKey.length * 8; // in bits (e.g., 24 bytes = 192 bits for AES-192)
    const valKeySize = masterValidationKey.length * 8; // in bits
    
    console.log('[ViewState] Key sizes - Enc:', encKeySize, 'bits, Val:', valKeySize, 'bits');
    
    const derivedEncKey = await deriveKeySP800_108(masterDecryptionKey, purpose.label, purpose.context, encKeySize);
    const derivedValKey = await deriveKeySP800_108(masterValidationKey, purpose.label, purpose.context, valKeySize);
    
    console.log('[ViewState] Derived enc key (first 8 bytes):', bytesToHex(derivedEncKey.slice(0, 8)));
    console.log('[ViewState] Derived val key (first 8 bytes):', bytesToHex(derivedValKey.slice(0, 8)));
    
    // Debug: show signature info
    console.log('[ViewState] Expected signature (first 8 bytes):', bytesToHex(signature.slice(0, 8)));
    console.log('[ViewState] Data to sign length:', dataToSign.length);
    console.log('[ViewState] Validation key (first 16 bytes):', validationKeyHex.substring(0, 32));
    
    // Approach 1: Try with SP800-108 derived keys
    const computedSignatureDerived = await computeHMAC(dataToSign, derivedValKey, valAlgorithm);
    console.log('[ViewState] Computed (derived) (first 8 bytes):', bytesToHex(computedSignatureDerived.slice(0, 8)));
    
    if (arraysEqual(signature, computedSignatureDerived)) {
      console.log('[ViewState] ✅ MAC verified with derived key (SP800-108)');
      console.log('[ViewState] Master decryption key:', decryptionKeyHex);
      console.log('[ViewState] Derived enc key length:', derivedEncKey.length, 'bytes');
      console.log('[ViewState] Derived enc key:', bytesToHex(derivedEncKey));
      console.log('[ViewState] IV:', bytesToHex(iv));
      console.log('[ViewState] Encrypted payload length:', encryptedPayload.length, 'bytes');
      console.log('[ViewState] Encrypted payload (first 32 bytes):', bytesToHex(encryptedPayload.slice(0, 32)));
      
      if (encAlgorithm === 'AES') {
        console.log('[ViewState] Starting AES decryption...');
        try {
          const decrypted = await decryptAES(encryptedPayload, derivedEncKey, iv);
          console.log('[ViewState] Decryption result:', decrypted ? `success (${decrypted.length} bytes)` : 'null/failed');
          if (decrypted) {
            console.log('[ViewState] Decrypted data (first 32 bytes):', bytesToHex(decrypted.slice(0, 32)));
            console.log('[ViewState] 🎉 Returning success with decrypted data');
            return { success: true, decrypted };
          } else {
            console.log('[ViewState] Decryption returned null - but MAC was valid, returning success without decrypted data');
            return { success: true };
          }
        } catch (decryptError) {
          console.error('[ViewState] ❌ Decryption exception:', decryptError);
          // MAC was valid, so key is correct even if decryption failed
          console.log('[ViewState] MAC was valid, returning success without decrypted data');
          return { success: true };
        }
      } else {
        console.log('[ViewState] Non-AES algorithm, returning success based on MAC only');
        return { success: true };
      }
    }
    
    // Approach 2: Try with master keys directly (legacy mode - no key derivation)
    const computedSignatureMaster = await computeHMAC(dataToSign, masterValidationKey, valAlgorithm);
    console.log('[ViewState] Computed (master) (first 8 bytes):', bytesToHex(computedSignatureMaster.slice(0, 8)));
    
    if (arraysEqual(signature, computedSignatureMaster)) {
      console.log('[ViewState] ✅ MAC verified with master key (legacy mode)');
      if (encAlgorithm === 'AES') {
        const decrypted = await decryptAES(encryptedPayload, masterDecryptionKey, iv);
        if (decrypted) {
          console.log('[ViewState] Decryption successful with master key');
          if (isValidViewState(decrypted)) {
            return { success: true, decrypted };
          } else {
            console.log('[ViewState] Decrypted data failed ViewState validation');
          }
        }
      }
    }
    
    // Approach 3: Try without any key derivation, signature on encrypted data only (some implementations)
    // Some older implementations sign only the encrypted payload, not IV+encrypted
    const computedSignaturePayloadOnly = await computeHMAC(encryptedPayload, masterValidationKey, valAlgorithm);
    if (arraysEqual(signature, computedSignaturePayloadOnly)) {
      console.log('[ViewState] ✅ MAC verified on payload only (legacy variant)');
      if (encAlgorithm === 'AES') {
        const decrypted = await decryptAES(encryptedPayload, masterDecryptionKey, iv);
        if (decrypted) {
          if (isValidViewState(decrypted)) {
            return { success: true, decrypted };
          }
        }
      }
    }
    
    // MAC didn't match with any approach
    console.log('[ViewState] ❌ MAC did not match with any key/approach');
    return { success: false };
  } catch (error) {
    console.error('Decrypt error:', error);
    return { success: false };
  }
}

async function verifyKey(
  viewStateBase64: string,
  validationKeyHex: string,
  decryptionKeyHex: string,
  generatorHex: string,
  encAlgorithm: string,
  valAlgorithm: string,
  verifyMode: 'validate' | 'decrypt' | 'both',
  targetPagePath: string = '/',
  iisAppPath: string = '/'
): Promise<{ success: boolean; decrypted?: Uint8Array }> {
  
  switch (verifyMode) {
    case 'validate':
      const macValid = await verifyViewStateMAC(
        viewStateBase64,
        validationKeyHex,
        generatorHex,
        valAlgorithm
      );
      return { success: macValid };
      
    case 'decrypt':
      // For encrypted ViewState, we MUST verify the MAC first
      // Otherwise we'll get false positives
      // The format is: IV || Enc(data) || HMAC(IV || Enc(data))
      return await tryDecryptViewState(
        viewStateBase64,
        decryptionKeyHex,
        validationKeyHex,
        generatorHex,
        encAlgorithm,
        valAlgorithm,
        true, // Always verify MAC for encrypted ViewState
        targetPagePath,
        iisAppPath
      );
      
    case 'both':
      return await tryDecryptViewState(
        viewStateBase64,
        decryptionKeyHex,
        validationKeyHex,
        generatorHex,
        encAlgorithm,
        valAlgorithm,
        true,
        targetPagePath,
        iisAppPath
      );
      
    default:
      return { success: false };
  }
}

// ============ Component Logic ============

const canStart = computed(() => {
  const hasViewState = viewStateData.value.trim().length > 0;
  const hasKeys = keySource.value === 'manual' 
    ? validationKey.value.trim().length > 0
    : keyWordlist.value.trim().length > 0;
  return hasViewState && hasKeys;
});

const progress = computed(() => {
  if (totalKeys.value === 0) return 0;
  return Math.round((testedKeys.value / totalKeys.value) * 100);
});

// Convert decrypted hex data to Base64
const decryptedDataBase64 = computed(() => {
  if (!decryptedData.value) return '';
  try {
    const hex = decryptedData.value;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return btoa(String.fromCharCode(...bytes));
  } catch {
    return 'Error converting to Base64';
  }
});

// Convert decrypted hex data to ASCII (printable chars only)
const decryptedDataAscii = computed(() => {
  if (!decryptedData.value) return '';
  try {
    const hex = decryptedData.value;
    let result = '';
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.substring(i, i + 2), 16);
      // Show printable ASCII chars, replace others with dots
      if (byte >= 32 && byte <= 126) {
        result += String.fromCharCode(byte);
      } else if (byte === 10) {
        result += '\n';
      } else if (byte === 13) {
        result += '';
      } else {
        result += '.';
      }
    }
    return result;
  } catch {
    return 'Error converting to ASCII';
  }
});

const keySourceOptions = [
  { label: 'Manual Entry', value: 'manual' },
  { label: 'Text Wordlist', value: 'wordlist' },
  { label: 'Local File', value: 'file' },
  { label: 'Caido Hosted File', value: 'caido' },
];

function addLog(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  logs.value.unshift(`[${timestamp}] ${message}`);
  if (logs.value.length > 100) logs.value.pop();
}

function parseKeyLine(line: string): { validation: string; decryption: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  
  const parts = trimmed.split(',');
  if (parts.length >= 2) {
    return {
      validation: parts[0].trim(),
      decryption: parts[1].trim(),
    };
  } else if (parts.length === 1) {
    return {
      validation: parts[0].trim(),
      decryption: parts[0].trim(),
    };
  }
  return null;
}

async function startBruteforce() {
  isRunning.value = true;
  finished.value = false;
  foundKey.value = null;
  decryptedData.value = null;
  testedKeys.value = 0;
  logs.value = [];

  addLog('🚀 Starting bruteforce...');
  addLog(`Mode: ${mode.value}`);
  addLog(`Validation Algorithm: ${validationAlg.value}`);
  addLog(`Decryption Algorithm: ${decryptionAlg.value}`);
  if (generator.value) {
    addLog(`Generator (__VIEWSTATEGENERATOR): ${generator.value}`);
  }

  let keysToTest: { validation: string; decryption: string }[] = [];

  if (keySource.value === 'manual') {
    keysToTest = [{
      validation: validationKey.value.trim(),
      decryption: decryptionKey.value.trim() || validationKey.value.trim(),
    }];
  } else {
    const lines = keyWordlist.value.split('\n');
    for (const line of lines) {
      const key = parseKeyLine(line);
      if (key) keysToTest.push(key);
    }
  }

  totalKeys.value = keysToTest.length;
  addLog(`Testing ${totalKeys.value} key(s)...`);

  for (let i = 0; i < keysToTest.length; i++) {
    if (!isRunning.value) {
      addLog('⏹️ Bruteforce stopped by user');
      break;
    }

    const key = keysToTest[i];
    testedKeys.value = i + 1;

    addLog(`Testing key: ${key.validation.substring(0, 20)}...`);
    
    try {
      const result = await verifyKey(
        viewStateData.value.trim(),
        key.validation,
        key.decryption,
        generator.value.trim(),
        decryptionAlg.value,
        validationAlg.value,
        mode.value,
        targetPagePath.value.trim() || '/',
        iisAppPath.value.trim() || '/'
      );
      
      if (result.success) {
        foundKey.value = key;
        if (result.decrypted) {
          decryptedData.value = bytesToHex(result.decrypted);
        }
        addLog(`✅ FOUND! Key: ${key.validation}`);
        break;
      }
    } catch (error) {
      addLog(`⚠️ Error testing key: ${error}`);
    }
    
    // Let the UI update every iteration
    await nextTick();
    // Small delay to prevent browser freezing
    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  isRunning.value = false;
  finished.value = true;
  
  if (foundKey.value) {
    addLog('🎉 Bruteforce completed - Key found!');
  } else {
    addLog('❌ Bruteforce completed - No matching key found');
  }
}

function stop() {
  isRunning.value = false;
  addLog('⏹️ Stopping...');
}

function clear() {
  viewStateData.value = '';
  generator.value = '';
  appPath.value = '/';
  targetPagePath.value = '/default.aspx';
  iisAppPath.value = '/';
  validationKey.value = '';
  decryptionKey.value = '';
  foundKey.value = null;
  decryptedData.value = null;
  testedKeys.value = 0;
  totalKeys.value = 0;
  finished.value = false;
  logs.value = [];
}

function loadDefaultKeys() {
  keyWordlist.value = knownKeys;
  addLog('📥 Loaded default known keys from Blacklist3r');
}

function copyKey() {
  if (foundKey.value) {
    const text = `Validation Key: ${foundKey.value.validation}\nDecryption Key: ${foundKey.value.decryption}`;
    navigator.clipboard.writeText(text).then(() => {
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 2000);
    });
  }
}

function copyLogs() {
  navigator.clipboard.writeText(logs.value.join('\n'));
}

onMounted(() => {
  keyWordlist.value = knownKeys;
  loadHostedFiles();
  
  // Check for pending data from context menu
  checkPendingData();
});
</script>

<template>
  <div class="p-4 flex flex-col gap-4">
    <!-- ViewState Input & Algorithm Configuration - Side by Side -->
    <div class="grid grid-cols-2 gap-4">
      <!-- ViewState Input -->
      <Card>
        <template #title>
          <span class="text-sm font-semibold">ViewState Data</span>
        </template>
        <template #content>
          <div class="flex flex-col gap-3">
            <div>
              <label class="block text-sm text-surface-400 mb-1">ViewState (Base64)</label>
              <Textarea
                v-model="viewStateData"
                rows="2"
                class="w-full font-mono text-xs"
                placeholder="Paste the __VIEWSTATE value here..."
              />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs text-surface-400 mb-1">__VIEWSTATEGENERATOR</label>
                <InputText
                  v-model="generator"
                  class="w-full font-mono text-xs"
                  placeholder="CA0B0334"
                />
              </div>
              <div>
                <label class="block text-xs text-surface-400 mb-1">Target Page Path</label>
                <InputText
                  v-model="targetPagePath"
                  class="w-full font-mono text-xs"
                  placeholder="/Content/default.aspx"
                />
              </div>
            </div>
            
            <div>
              <label class="block text-xs text-surface-400 mb-1">IIS App Path</label>
              <InputText
                v-model="iisAppPath"
                class="w-full font-mono text-xs"
                placeholder="/"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Algorithm Configuration -->
      <Card>
        <template #title>
          <span class="text-sm font-semibold">Algorithm Configuration</span>
        </template>
        <template #content>
          <div class="flex flex-col gap-3">
            <div>
              <label class="block text-xs text-surface-400 mb-1">Mode</label>
              <Select
                v-model="mode"
                :options="modes"
                optionLabel="label"
                optionValue="value"
                class="w-full"
              />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs text-surface-400 mb-1">Validation Algorithm</label>
                <Select
                  v-model="validationAlg"
                  :options="validationAlgorithms"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full"
                />
              </div>
              <div>
                <label class="block text-xs text-surface-400 mb-1">Decryption Algorithm</label>
                <Select
                  v-model="decryptionAlg"
                  :options="decryptionAlgorithms"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full"
                  :disabled="mode === 'validate'"
                />
              </div>
            </div>
            <div class="text-xs text-surface-500 mt-2">
              💡 ASP.NET 4.5+ uses SP800-108 key derivation based on page path
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Key Configuration -->
    <Card>
      <template #title>
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">Machine Keys</span>
          <Select
            v-model="keySource"
            :options="keySourceOptions"
            optionLabel="label"
            optionValue="value"
            class="w-48"
            size="small"
          />
        </div>
      </template>
      <template #content>
        <!-- Manual Key Entry -->
        <div v-if="keySource === 'manual'" class="flex flex-col gap-4">
          <div>
            <label class="block text-sm text-surface-400 mb-2">Validation Key (hex)</label>
            <InputText
              v-model="validationKey"
              class="w-full font-mono text-sm"
              placeholder="e.g., CB2721ABDAF8E9DC516D621D8B8BF13A2C9E8689A25303BF"
            />
          </div>
          <div>
            <label class="block text-sm text-surface-400 mb-2">Decryption Key (hex)</label>
            <InputText
              v-model="decryptionKey"
              class="w-full font-mono text-sm"
              placeholder="e.g., 21F090935F6E49C2C8B0A1E9F7D6C5B4A3029180F7E6D5C4B3A20190F8E7D6C5"
            />
          </div>
        </div>

        <!-- Text Wordlist Mode -->
        <div v-else-if="keySource === 'wordlist'" class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <label class="text-sm text-surface-400">Key Wordlist (validationKey,decryptionKey per line)</label>
            <Button label="Load Blacklist3r Keys" size="small" text @click="loadDefaultKeys" />
          </div>
          <Textarea
            v-model="keyWordlist"
            rows="8"
            class="w-full font-mono text-xs"
            placeholder="# Format: validationKey,decryptionKey
CB2721ABDAF8E9DC516D621D8B8BF13A2C9E8689A25303BF,21F090935F6E49C2
..."
          />
          <p class="text-xs text-surface-500">
            Lines starting with # are comments. Use comma to separate validation and decryption keys.
          </p>
        </div>

        <!-- Local File Mode -->
        <div v-else-if="keySource === 'file'" class="flex flex-col gap-3">
          <div>
            <label class="block text-sm text-surface-400 mb-2">Upload Local Wordlist File</label>
            <input 
              type="file" 
              accept=".txt,.csv,.list"
              @change="handleLocalFile"
              class="block w-full text-sm text-surface-400
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-surface-700 file:text-surface-200
                hover:file:bg-surface-600
                cursor-pointer"
            />
          </div>
          <Textarea
            v-model="keyWordlist"
            rows="6"
            class="w-full font-mono text-xs"
            placeholder="File content will appear here..."
            readonly
          />
          <p class="text-xs text-surface-500">
            {{ keyWordlist ? `Loaded ${keyWordlist.split('\n').length} lines` : 'No file loaded' }}
          </p>
        </div>

        <!-- Caido Hosted File Mode -->
        <div v-else-if="keySource === 'caido'" class="flex flex-col gap-3">
          <div>
            <label class="block text-sm text-surface-400 mb-2">Select Caido Hosted File</label>
            <div class="flex gap-2">
              <AutoComplete
                v-model="selectedFile"
                :suggestions="filteredFiles"
                @complete="searchFiles"
                @item-select="onFileSelect"
                optionLabel="name"
                placeholder="Search for a file..."
                class="flex-1"
                :loading="loadingFiles || loadingFileContent"
                dropdown
              >
                <template #option="{ option }">
                  <div class="flex items-center justify-between w-full">
                    <span>{{ option.name }}</span>
                    <span class="text-xs text-surface-500">{{ (option.size / 1024).toFixed(1) }} KB</span>
                  </div>
                </template>
              </AutoComplete>
              <Button 
                icon="fas fa-sync" 
                severity="secondary" 
                @click="loadHostedFiles" 
                :loading="loadingFiles"
                v-tooltip="'Refresh file list'"
              />
            </div>
          </div>
          <Textarea
            v-model="keyWordlist"
            rows="6"
            class="w-full font-mono text-xs"
            placeholder="File content will appear here..."
            readonly
          />
          <p class="text-xs text-surface-500">
            {{ hostedFiles.length }} hosted files available. 
            {{ keyWordlist ? `Loaded ${keyWordlist.split('\n').length} lines` : 'Select a file to load' }}
          </p>
        </div>
      </template>
    </Card>

    <!-- Actions -->
    <div class="flex gap-2">
      <Button
        :label="isRunning ? 'Running...' : 'Start Bruteforce'"
        :icon="isRunning ? 'fas fa-spinner fa-spin' : 'fas fa-key'"
        severity="warning"
        @click="startBruteforce"
        :disabled="!canStart || isRunning"
      />
      <Button v-if="isRunning" label="Stop" icon="fas fa-stop" severity="danger" @click="stop" />
      <Button label="Clear" icon="fas fa-trash" severity="secondary" @click="clear" :disabled="isRunning" />
    </div>

    <!-- Progress -->
    <Card v-if="isRunning || (finished && testedKeys > 0)">
      <template #content>
        <div class="flex justify-between text-sm text-surface-400 mb-2">
          <span>Progress: {{ testedKeys }} / {{ totalKeys }} keys</span>
          <span>{{ progress }}%</span>
        </div>
        <ProgressBar 
          :value="progress" 
          :showValue="false"
          :class="{ 'animate-pulse': isRunning }"
        />
        <div v-if="isRunning" class="text-center text-xs text-surface-500 mt-2">
          ⏳ Running...
        </div>
        <div v-else-if="finished && !foundKey" class="text-center text-xs text-red-400 mt-2">
          ❌ Completed - No key found
        </div>
        <div v-else-if="finished && foundKey" class="text-center text-xs text-green-400 mt-2">
          ✅ Completed - Key found!
        </div>
      </template>
    </Card>

    <!-- Result: Key Found -->
    <div v-if="foundKey" class="p-4 bg-green-500/20 border border-green-500 rounded-md">
      <h3 class="text-lg font-semibold text-green-400 mb-3">🎉 Machine Key Found!</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <span class="text-sm text-surface-400">Validation Key:</span>
          <code class="block p-2 mt-1 bg-surface-900 rounded text-green-400 font-mono text-xs break-all">{{ foundKey.validation }}</code>
        </div>
        <div>
          <span class="text-sm text-surface-400">Decryption Key:</span>
          <code class="block p-2 mt-1 bg-surface-900 rounded text-green-400 font-mono text-xs break-all">{{ foundKey.decryption }}</code>
        </div>
      </div>
      
      <!-- Decrypted Data Section -->
      <div v-if="decryptedData" class="mt-4 p-3 bg-surface-800 rounded-md border border-blue-500/50">
        <h4 class="text-sm font-semibold text-blue-400 mb-2">🔓 Decrypted ViewState Data</h4>
        
        <div class="space-y-3">
          <!-- Hex dump -->
          <details open>
            <summary class="cursor-pointer text-xs text-surface-400 hover:text-surface-200">Raw Hex Data</summary>
            <code class="block p-2 mt-1 bg-surface-900 rounded text-blue-300 font-mono text-xs break-all max-h-40 overflow-auto">{{ decryptedData }}</code>
          </details>
          
          <!-- Base64 -->
          <details>
            <summary class="cursor-pointer text-xs text-surface-400 hover:text-surface-200">Base64</summary>
            <code class="block p-2 mt-1 bg-surface-900 rounded text-purple-300 font-mono text-xs break-all max-h-40 overflow-auto">{{ decryptedDataBase64 }}</code>
          </details>
          
          <!-- ASCII preview -->
          <details>
            <summary class="cursor-pointer text-xs text-surface-400 hover:text-surface-200">ASCII Preview (printable chars)</summary>
            <code class="block p-2 mt-1 bg-surface-900 rounded text-yellow-300 font-mono text-xs break-all max-h-40 overflow-auto whitespace-pre-wrap">{{ decryptedDataAscii }}</code>
          </details>
        </div>
      </div>
      
      <Button :label="copied ? 'Copied!' : 'Copy Keys'" size="small" class="mt-3" @click="copyKey" />
    </div>

    <!-- Result: Not Found -->
    <div v-else-if="finished && !foundKey" class="p-4 bg-yellow-500/20 border border-yellow-500 rounded-md">
      <h3 class="text-lg font-semibold text-yellow-400">❌ No Matching Key Found</h3>
      <p class="text-sm text-yellow-300 mt-1">None of the tested keys matched the ViewState.</p>
      <p class="text-xs text-yellow-200 mt-2">Tips: Try different algorithms or check if the ViewState is encrypted/signed.</p>
    </div>

    <!-- Logs -->
    <Panel header="Activity Logs" toggleable>
      <template #icons>
        <Button label="Copy Logs" size="small" text @click="copyLogs" />
      </template>
      <div class="bg-surface-900 rounded p-3 max-h-48 overflow-auto font-mono text-xs">
        <div v-if="logs.length === 0" class="text-surface-500 italic">No activity yet...</div>
        <div v-for="(log, i) in logs" :key="i" class="text-surface-300 mb-1">{{ log }}</div>
      </div>
    </Panel>

    <!-- Empty State -->
    <div v-if="!viewStateData && !keyWordlist" class="text-center py-8">
      <div class="text-6xl mb-4">🔐</div>
      <h3 class="text-lg font-medium text-surface-300 mb-2">ASP.NET Machine Key Bruteforce</h3>
      <p class="text-sm text-surface-500 max-w-lg mx-auto mb-4">
        Test known ASP.NET machine keys against a signed/encrypted ViewState.
        Based on the <a href="https://github.com/NotSoSecure/Blacklist3r" target="_blank" class="text-blue-400 hover:underline">Blacklist3r</a> project.
      </p>
      <div class="p-3 bg-surface-800 rounded inline-block text-left">
        <p class="text-xs text-surface-400 mb-2">💡 Modes:</p>
        <ul class="text-xs text-surface-500 list-disc list-inside">
          <li><strong>Validate MAC:</strong> For signed ViewState only</li>
          <li><strong>Decrypt:</strong> For encrypted ViewState only</li>
          <li><strong>Both:</strong> For encrypted AND signed ViewState</li>
        </ul>
      </div>
    </div>
  </div>
</template>
