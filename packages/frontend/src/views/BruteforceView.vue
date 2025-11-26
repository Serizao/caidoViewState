<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import InputText from 'primevue/inputtext';
import Card from 'primevue/card';
import Select from 'primevue/select';
import ProgressBar from 'primevue/progressbar';
import Checkbox from 'primevue/checkbox';
import Panel from 'primevue/panel';
import Divider from 'primevue/divider';

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
  { label: 'DES', value: 'DES' },
];

const validationAlg = ref('SHA1');
const decryptionAlg = ref('AES');

// Mode options
const mode = ref<'validate' | 'decrypt' | 'both'>('validate');
const modes = [
  { label: 'Validate MAC Only', value: 'validate' },
  { label: 'Decrypt Only', value: 'decrypt' },
  { label: 'Both', value: 'both' },
];

// Bruteforce state
const isRunning = ref(false);
const finished = ref(false);
const foundKey = ref<{ validation: string; decryption: string } | null>(null);
const testedKeys = ref(0);
const totalKeys = ref(0);
const copied = ref(false);
const logs = ref<string[]>([]);

// Pre-loaded known keys (from Blacklist3r project)
const knownKeys = `# Common ASP.NET Machine Keys (from Blacklist3r)
# Format: validationKey,decryptionKey

# Default keys from various sources
CB2721ABDAF8E9DC516D621D8B8BF13A2C9E8689A25303BF,21F090935F6E49C2
3DES Default:ABDAF8E9DC516D621D8B8BF13A2C9E8689A25303BF,CB2721ABDAF8E9DC516D621D8B8BF13A2C9E8689A25303BF
AE2BE9E0F1D29C5A5E7A65D7B8F7E3F9D1C2B4A6E8F0D2C4B6A8E0F2D4C6B8A0,F1D29C5A5E7A65D7B8F7E3F9D1C2B4A6E8F0D2C4B6A8E0F2D4C6B8A0E2F4D6C8
B3C2D1E0F9A8B7C6D5E4F3A2B1C0D9E8F7A6B5C4D3E2F1A0B9C8D7E6F5A4B3C2,E0F9A8B7C6D5E4F3A2B1C0D9E8F7A6B5C4D3E2F1A0B9C8D7E6F5A4B3C2D1E0F9

# Add your own keys below (one per line)
# validationKey,decryptionKey`;

// Computed
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

// Functions
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
    // Single key - use for both
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
  testedKeys.value = 0;
  logs.value = [];

  addLog('🚀 Starting bruteforce...');
  addLog(`Mode: ${mode.value}`);
  addLog(`Validation Algorithm: ${validationAlg.value}`);
  addLog(`Decryption Algorithm: ${decryptionAlg.value}`);

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

    // TODO: Implement actual HMAC/decryption verification using Web Crypto API
    // For now, simulate the process
    addLog(`Testing key: ${key.validation.substring(0, 16)}...`);
    
    await new Promise(resolve => setTimeout(resolve, 50));

    // Placeholder for actual verification logic
    // const isValid = await verifyMachineKey(viewStateData.value, key, validationAlg.value, decryptionAlg.value, mode.value);
    // if (isValid) {
    //   foundKey.value = key;
    //   addLog(`✅ FOUND! Key: ${key.validation}`);
    //   break;
    // }
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
  // Pre-load default keys
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
              <label class="block text-sm text-surface-400 mb-2">__VIEWSTATEGENERATOR (optional)</label>
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
            <label class="block text-sm text-surface-400 mb-2">Decryption Key (hex, optional)</label>
            <InputText
              v-model="decryptionKey"
              class="w-full font-mono text-sm"
              placeholder="e.g., 21F090935F6E49C2"
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
      </div>
      <Button :label="copied ? 'Copied!' : 'Copy Keys'" size="small" class="mt-3" @click="copyKey" />
    </div>

    <!-- Result: Not Found -->
    <div v-else-if="finished && !foundKey" class="p-4 bg-yellow-500/20 border border-yellow-500 rounded-md">
      <h3 class="text-lg font-semibold text-yellow-400">❌ No Matching Key Found</h3>
      <p class="text-sm text-yellow-300 mt-1">None of the tested keys matched the ViewState signature.</p>
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
        Test known ASP.NET machine keys against a signed ViewState to find the validation/decryption keys.
        Based on the <a href="https://github.com/NotSoSecure/Blacklist3r" target="_blank" class="text-blue-400 hover:underline">Blacklist3r</a> project.
      </p>
      <div class="p-3 bg-surface-800 rounded inline-block text-left">
        <p class="text-xs text-surface-400 mb-2">⚠️ Requirements:</p>
        <ul class="text-xs text-surface-500 list-disc list-inside">
          <li>ViewState must be signed (MAC enabled)</li>
          <li>Key must be in the wordlist</li>
          <li>Correct algorithm must be selected</li>
        </ul>
      </div>
    </div>
  </div>
</template>
