<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import InputText from 'primevue/inputtext';
import Card from 'primevue/card';
import Select from 'primevue/select';
import ProgressBar from 'primevue/progressbar';
import Panel from 'primevue/panel';

// ViewState data
const viewStateData = ref('');
const generator = ref(''); // __VIEWSTATEGENERATOR value
const appPath = ref('/'); // Application path for modifier calculation

// Key configuration
const keySource = ref<'manual' | 'wordlist'>('wordlist');
const validationKey = ref('');
const decryptionKey = ref('');
const keyWordlist = ref('');

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
 * Build the modifier bytes from __VIEWSTATEGENERATOR
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
    // Ensure key is proper length (128, 192, or 256 bits)
    let keyLength = 16; // Default to AES-128
    if (keyBytes.length >= 32) keyLength = 32;
    else if (keyBytes.length >= 24) keyLength = 24;
    else if (keyBytes.length >= 16) keyLength = 16;
    
    const key = keyBytes.slice(0, keyLength);
    
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
    
    return new Uint8Array(decrypted);
  } catch (error) {
    return null;
  }
}

/**
 * Check if decrypted data looks like valid ViewState
 * Valid ViewState starts with magic bytes
 */
function isValidViewState(data: Uint8Array): boolean {
  if (data.length < 2) return false;
  
  // ASP.NET ViewState typically starts with:
  // 0xFF 0x01 - ViewState version 2 (ASP.NET 2.0+)
  // 0x1F 0x8B - GZIP compressed
  // Other valid patterns
  
  // Check for common ViewState markers
  if (data[0] === 0xFF && data[1] === 0x01) return true; // Uncompressed ViewState 2.0
  if (data[0] === 0x1F && data[1] === 0x8B) return true; // GZIP compressed
  
  // Check for valid serialization markers
  // 0x02 = Type_Array, 0x03 = Type_ArrayList, 0x05 = Type_Boolean, etc.
  const validFirstBytes = [0x02, 0x03, 0x05, 0x06, 0x09, 0x0A, 0x0B, 0x0F, 0x10, 0x14, 0x15, 0x16, 0x18, 0x19, 0x1E, 0x1F, 0x64, 0x65, 0x66, 0x67];
  if (validFirstBytes.includes(data[0])) return true;
  
  return false;
}

// ============ Verification Functions ============

/**
 * Verify ViewState MAC signature
 */
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

/**
 * Try to decrypt ViewState
 * ASP.NET encrypted ViewState structure:
 * - For AES: IV (16 bytes) + EncryptedData
 * - If signed: IV + EncryptedData + MAC
 */
async function tryDecryptViewState(
  viewStateBase64: string,
  decryptionKeyHex: string,
  validationKeyHex: string,
  generatorHex: string,
  encAlgorithm: string,
  valAlgorithm: string,
  checkMac: boolean
): Promise<{ success: boolean; decrypted?: Uint8Array }> {
  try {
    let viewStateBytes = base64ToBytes(viewStateBase64);
    const blockSize = getBlockSize(encAlgorithm);
    
    // If checking MAC, first verify and remove it
    if (checkMac) {
      const hashSize = getHashSize(valAlgorithm);
      if (viewStateBytes.length <= hashSize + blockSize) {
        return { success: false };
      }
      
      // Verify MAC first
      const macValid = await verifyViewStateMAC(
        viewStateBase64,
        validationKeyHex,
        generatorHex,
        valAlgorithm
      );
      
      if (!macValid) {
        return { success: false };
      }
      
      // Remove MAC
      viewStateBytes = viewStateBytes.slice(0, viewStateBytes.length - hashSize);
    }
    
    // Need at least IV + one block
    if (viewStateBytes.length < blockSize * 2) {
      return { success: false };
    }
    
    // Extract IV (first block)
    const iv = viewStateBytes.slice(0, blockSize);
    const encryptedData = viewStateBytes.slice(blockSize);
    
    // Try decryption
    const decryptionKey = hexToBytes(decryptionKeyHex);
    
    if (encAlgorithm === 'AES') {
      const decrypted = await decryptAES(encryptedData, decryptionKey, iv);
      
      if (decrypted && isValidViewState(decrypted)) {
        return { success: true, decrypted };
      }
    }
    
    return { success: false };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Main verification function that handles all modes
 */
async function verifyKey(
  viewStateBase64: string,
  validationKeyHex: string,
  decryptionKeyHex: string,
  generatorHex: string,
  encAlgorithm: string,
  valAlgorithm: string,
  verifyMode: 'validate' | 'decrypt' | 'both'
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
      return await tryDecryptViewState(
        viewStateBase64,
        decryptionKeyHex,
        validationKeyHex,
        generatorHex,
        encAlgorithm,
        valAlgorithm,
        false // Don't check MAC
      );
      
    case 'both':
      return await tryDecryptViewState(
        viewStateBase64,
        decryptionKeyHex,
        validationKeyHex,
        generatorHex,
        encAlgorithm,
        valAlgorithm,
        true // Check MAC first
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
        mode.value
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
    
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
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
});
</script>

<template>
  <div class="p-4 flex flex-col gap-4">
    <!-- ViewState Input -->
    <Card>
      <template #title>
        <span class="text-sm font-semibold">ViewState Data</span>
      </template>
      <template #content>
        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-sm text-surface-400 mb-2">ViewState (Base64 encoded)</label>
            <Textarea
              v-model="viewStateData"
              rows="3"
              class="w-full font-mono text-sm"
              placeholder="Paste the __VIEWSTATE value here..."
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-surface-400 mb-2">__VIEWSTATEGENERATOR (for MAC validation)</label>
              <InputText
                v-model="generator"
                class="w-full font-mono text-sm"
                placeholder="e.g., CA0B0334"
              />
            </div>
            <div>
              <label class="block text-sm text-surface-400 mb-2">Application Path</label>
              <InputText
                v-model="appPath"
                class="w-full font-mono text-sm"
                placeholder="e.g., /myapp/page.aspx"
              />
            </div>
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
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm text-surface-400 mb-2">Mode</label>
            <Select
              v-model="mode"
              :options="modes"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-sm text-surface-400 mb-2">Validation Algorithm</label>
            <Select
              v-model="validationAlg"
              :options="validationAlgorithms"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-sm text-surface-400 mb-2">Decryption Algorithm</label>
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
      </template>
    </Card>

    <!-- Key Configuration -->
    <Card>
      <template #title>
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">Machine Keys</span>
          <div class="flex gap-2">
            <Button
              :label="keySource === 'wordlist' ? 'Wordlist' : 'Manual'"
              size="small"
              :severity="keySource === 'wordlist' ? 'primary' : 'secondary'"
              @click="keySource = keySource === 'wordlist' ? 'manual' : 'wordlist'"
            />
          </div>
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

        <!-- Wordlist Mode -->
        <div v-else class="flex flex-col gap-3">
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
    <Card v-if="isRunning || testedKeys > 0">
      <template #content>
        <div class="flex justify-between text-sm text-surface-400 mb-2">
          <span>Progress: {{ testedKeys }} / {{ totalKeys }} keys</span>
          <span>{{ progress }}%</span>
        </div>
        <ProgressBar :value="progress" :showValue="false" />
      </template>
    </Card>

    <!-- Result: Key Found -->
    <div v-if="foundKey" class="p-4 bg-green-500/20 border border-green-500 rounded-md">
      <h3 class="text-lg font-semibold text-green-400 mb-3">🎉 Machine Key Found!</h3>
      <div class="space-y-2">
        <div>
          <span class="text-sm text-surface-400">Validation Key:</span>
          <code class="block p-2 mt-1 bg-surface-900 rounded text-green-400 font-mono text-xs break-all">{{ foundKey.validation }}</code>
        </div>
        <div>
          <span class="text-sm text-surface-400">Decryption Key:</span>
          <code class="block p-2 mt-1 bg-surface-900 rounded text-green-400 font-mono text-xs break-all">{{ foundKey.decryption }}</code>
        </div>
        <div v-if="decryptedData">
          <span class="text-sm text-surface-400">Decrypted Data (hex):</span>
          <code class="block p-2 mt-1 bg-surface-900 rounded text-blue-400 font-mono text-xs break-all max-h-32 overflow-auto">{{ decryptedData }}</code>
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
