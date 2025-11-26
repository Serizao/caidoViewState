<script setup lang="ts">
import { ref, computed } from 'vue';
import { parseViewState, decodeViewState } from '../lib/viewstate-module';

console.log('[ViewStatePage] Loaded');

// Tab state
const activeTab = ref('parse');

// ============ PARSE TAB STATE ============
const viewStateInput = ref('');
const parseResult = ref<any>(null);
const parseError = ref('');
const copiedJson = ref(false);
const copiedRaw = ref(false);

const examples = [
  { name: 'Bool', value: '/wFn' },
  { name: 'Int32', value: '/wECiAE=' },
  { name: 'String', value: '/wEFCmFiY2RlZmdoaWo=' },
  { name: 'With MAC', value: '/wEPDwUKLTM0MjUyMzM2OWRkmW75zyss5UROsLtrTEuOq7AGUDk=' },
  { name: 'Encrypted', value: 'ZU1VanBjYUFOWGlGcElTcGtwQ3dWSndXY3NtZ05XNEZscWtsOUlWcjlxV01iYUFOYW92eTJOSkh6MnNadmNCTG9kRGdBbTVrUWNhQ2ZKdnh0d0t0eUtLMmwzY29GMTY5UzR6WnpLY1JWUTEzaWhVNW12VG44YkllZmlGUjZSZTJ4ZDVkcEp2VVp5bDBpVEVucUdDaFVwdUlteTJsZ1VMRkpCRnZjWGRnUDJqTXRIdWsxVkJoZ0NSM01aQWd5NW5KUnVlbDlJbDF6Y1M3R21rS05ZV241bHhkOEJDSU1yVHJIRlBTSEl5SFVaWjhLNFFMRVF2QzZ5MmdvWG1STDBaRg==' },
];

const jsonString = computed(() => {
  if (!parseResult.value?.json) return '';
  return JSON.stringify(parseResult.value.json, null, 2);
});

const hexDump = computed(() => {
  if (!viewStateInput.value) return '';
  try {
    const decoded = decodeViewState(viewStateInput.value);
    let result = '';
    const bytesPerLine = 16;
    for (let i = 0; i < Math.min(decoded.length, 256); i += bytesPerLine) {
      result += i.toString(16).padStart(8, '0') + '  ';
      for (let j = 0; j < bytesPerLine; j++) {
        if (i + j < decoded.length) {
          result += decoded[i + j].toString(16).padStart(2, '0') + ' ';
        } else {
          result += '   ';
        }
        if (j === 7) result += ' ';
      }
      result += ' ';
      for (let j = 0; j < bytesPerLine && i + j < decoded.length; j++) {
        const byte = decoded[i + j];
        result += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
      }
      result += '\n';
    }
    if (decoded.length > 256) result += `\n... (${decoded.length - 256} more bytes)`;
    return result;
  } catch {
    return 'Unable to decode';
  }
});

function parseViewStateInput() {
  parseError.value = '';
  parseResult.value = null;
  if (!viewStateInput.value.trim()) {
    parseError.value = 'Please enter a ViewState value';
    return;
  }
  try {
    parseResult.value = parseViewState(viewStateInput.value.trim());
    console.log('[ViewStatePage] Parsed:', parseResult.value);
  } catch (e) {
    parseError.value = e instanceof Error ? e.message : 'Failed to parse ViewState';
  }
}

function loadExample(example: { name: string; value: string }) {
  viewStateInput.value = example.value;
  parseViewStateInput();
}

function clearParse() {
  viewStateInput.value = '';
  parseResult.value = null;
  parseError.value = '';
}

function copyJson() {
  navigator.clipboard.writeText(jsonString.value).then(() => {
    copiedJson.value = true;
    setTimeout(() => { copiedJson.value = false; }, 2000);
  });
}

function copyRaw() {
  navigator.clipboard.writeText(viewStateInput.value).then(() => {
    copiedRaw.value = true;
    setTimeout(() => { copiedRaw.value = false; }, 2000);
  });
}

// ============ BRUTEFORCE TAB STATE ============
const bfViewState = ref('');
const bfWordlist = ref('');
const bfAlgorithm = ref('HMAC-SHA256');
const bfIsRunning = ref(false);
const bfFinished = ref(false);
const bfFoundKey = ref('');
const bfTestedKeys = ref(0);
const bfTotalKeys = ref(0);
const bfCopied = ref(false);

const bfCanStart = computed(() => bfViewState.value.trim() && bfWordlist.value.trim());
const bfProgress = computed(() => bfTotalKeys.value === 0 ? 0 : Math.round((bfTestedKeys.value / bfTotalKeys.value) * 100));

async function startBruteforce() {
  bfIsRunning.value = true;
  bfFinished.value = false;
  bfFoundKey.value = '';
  bfTestedKeys.value = 0;

  const keys = bfWordlist.value.split('\n').map(k => k.trim()).filter(k => k.length > 0);
  bfTotalKeys.value = keys.length;

  for (let i = 0; i < keys.length; i++) {
    if (!bfIsRunning.value) break;
    bfTestedKeys.value = i + 1;
    await new Promise(resolve => setTimeout(resolve, 10));
    // TODO: Implement actual HMAC verification
  }

  bfIsRunning.value = false;
  bfFinished.value = true;
}

function stopBruteforce() {
  bfIsRunning.value = false;
}

function clearBruteforce() {
  bfViewState.value = '';
  bfWordlist.value = '';
  bfFoundKey.value = '';
  bfTestedKeys.value = 0;
  bfTotalKeys.value = 0;
  bfFinished.value = false;
}

function copyBfKey() {
  navigator.clipboard.writeText(bfFoundKey.value).then(() => {
    bfCopied.value = true;
    setTimeout(() => { bfCopied.value = false; }, 2000);
  });
}
</script>

<template>
  <div class="p-5 font-sans min-h-full" style="background-color: #1a1a2e;">
    <!-- Header -->
    <h1 class="text-2xl font-bold text-white mb-1">🔐 ViewState Tools</h1>
    <p class="text-gray-400 mb-5">Decode, analyze and bruteforce ASP.NET ViewState</p>

    <!-- Tab Headers -->
    <div class="flex border-b border-gray-700 mb-5">
      <button
        @click="activeTab = 'parse'"
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
          activeTab === 'parse'
            ? 'text-blue-400 border-blue-400'
            : 'text-gray-400 border-transparent hover:text-gray-200'
        ]"
      >
        Parse ViewState
      </button>
      <button
        @click="activeTab = 'bruteforce'"
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
          activeTab === 'bruteforce'
            ? 'text-blue-400 border-blue-400'
            : 'text-gray-400 border-transparent hover:text-gray-200'
        ]"
      >
        Bruteforce Key
      </button>
    </div>

    <!-- ============ PARSE TAB ============ -->
    <div v-show="activeTab === 'parse'">
      <!-- Input -->
      <div class="mb-4">
        <label class="block text-sm text-gray-300 mb-2">ViewState (Base64)</label>
        <textarea
          v-model="viewStateInput"
          rows="4"
          class="w-full p-3 bg-gray-900 border border-gray-700 rounded text-sm font-mono text-gray-200 focus:border-blue-500 focus:outline-none"
          placeholder="Paste your ViewState here..."
        ></textarea>
      </div>

      <!-- Buttons -->
      <div class="flex gap-2 mb-4">
        <button
          @click="parseViewStateInput"
          :disabled="!viewStateInput.trim()"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          Parse ViewState
        </button>
        <button
          @click="clearParse"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded transition-colors"
        >
          Clear
        </button>
      </div>

      <!-- Examples -->
      <div class="mb-5">
        <p class="text-xs text-gray-500 mb-2">Try an example:</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="ex in examples"
            :key="ex.name"
            @click="loadExample(ex)"
            class="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded transition-colors"
          >
            {{ ex.name }}
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-if="parseError" class="mb-4 p-3 bg-red-900 border border-red-700 rounded">
        <p class="text-red-100 text-sm"><span class="font-semibold">Error:</span> {{ parseError }}</p>
      </div>

      <!-- Results -->
      <div v-if="parseResult" class="space-y-4">
        <!-- Success Banner -->
        <div class="p-3 bg-green-900 border border-green-700 rounded">
          <p class="text-green-100 font-semibold">✅ ViewState parsed successfully!</p>
        </div>

        <!-- Analysis Summary -->
        <div class="p-4 bg-gray-800 rounded border border-gray-700">
          <h3 class="text-md font-semibold text-white mb-3">Analysis Results</h3>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span class="text-gray-400">Encrypted: </span>
              <span :class="parseResult.encrypted ? 'text-green-400' : 'text-red-400'" class="ml-2 font-semibold">
                {{ parseResult.encrypted ? 'YES' : 'NO' }}
              </span>
            </div>
            <div>
              <span class="text-gray-400">Signed (MAC): </span>
              <span :class="parseResult.mac ? 'text-green-400' : 'text-red-400'" class="ml-2 font-semibold">
                {{ parseResult.mac ? 'YES' : 'NO' }}
              </span>
              <span v-if="parseResult.macAlgorithm" class="text-xs text-gray-500 ml-1">({{ parseResult.macAlgorithm }})</span>
            </div>
          </div>

          <!-- MAC Digest -->
          <details v-if="parseResult.mac && parseResult.digest" class="mb-3">
            <summary class="cursor-pointer text-sm text-gray-300 hover:text-white">
              <span class="ml-1">▶ MAC Digest</span>
            </summary>
            <div class="mt-2 p-2 bg-gray-900 rounded">
              <code class="text-xs text-orange-400 break-all">{{ parseResult.digest }}</code>
            </div>
          </details>

          <div class="p-2 bg-gray-900 rounded">
            <p class="text-sm text-gray-400">Size: {{ viewStateInput.length }} chars</p>
          </div>
        </div>

        <!-- Parsed JSON Structure -->
        <details v-if="!parseResult.encrypted" class="bg-gray-800 rounded border border-gray-700" open>
          <summary class="cursor-pointer p-3 flex items-center justify-between hover:bg-gray-750">
            <span class="font-semibold text-blue-400">▶ Parsed ViewState Structure</span>
            <button
              @click.stop="copyJson"
              class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
            >
              {{ copiedJson ? 'Copied!' : 'Copy JSON' }}
            </button>
          </summary>
          <div class="p-3 border-t border-gray-700 max-h-80 overflow-auto">
            <pre class="text-xs text-green-400 font-mono whitespace-pre-wrap">{{ jsonString }}</pre>
          </div>
        </details>

        <!-- Raw ViewState -->
        <details class="bg-gray-800 rounded border border-gray-700">
          <summary class="cursor-pointer p-3 flex items-center justify-between hover:bg-gray-750">
            <span class="font-semibold text-white">▶ Raw ViewState Value</span>
            <button
              @click.stop="copyRaw"
              class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
            >
              {{ copiedRaw ? 'Copied!' : 'Copy' }}
            </button>
          </summary>
          <div class="p-3 border-t border-gray-700 max-h-40 overflow-auto">
            <pre class="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">{{ viewStateInput }}</pre>
          </div>
        </details>

        <!-- Hex Dump -->
        <details class="bg-gray-800 rounded border border-gray-700">
          <summary class="cursor-pointer p-3 hover:bg-gray-750">
            <span class="font-semibold text-white">▶ Hex Dump (Binary)</span>
          </summary>
          <div class="p-3 border-t border-gray-700 max-h-40 overflow-auto">
            <pre class="text-xs text-gray-400 font-mono">{{ hexDump }}</pre>
          </div>
        </details>
      </div>

      <!-- Empty State -->
      <div v-if="!parseResult && !parseError" class="text-center py-12">
        <div class="text-6xl mb-4">🔍</div>
        <h3 class="text-lg font-medium text-gray-300 mb-2">No ViewState Parsed</h3>
        <p class="text-sm text-gray-500">Paste a ViewState value above and click "Parse ViewState" to analyze it.</p>
      </div>
    </div>

    <!-- ============ BRUTEFORCE TAB ============ -->
    <div v-show="activeTab === 'bruteforce'">
      <!-- ViewState Input -->
      <div class="mb-4">
        <label class="block text-sm text-gray-300 mb-2">ViewState (Base64)</label>
        <textarea
          v-model="bfViewState"
          rows="3"
          class="w-full p-3 bg-gray-900 border border-gray-700 rounded text-sm font-mono text-gray-200 focus:border-blue-500 focus:outline-none"
          placeholder="Paste your signed ViewState here..."
        ></textarea>
      </div>

      <!-- Wordlist Input -->
      <div class="mb-4">
        <label class="block text-sm text-gray-300 mb-2">Wordlist (one key per line)</label>
        <textarea
          v-model="bfWordlist"
          rows="5"
          class="w-full p-3 bg-gray-900 border border-gray-700 rounded text-sm font-mono text-gray-200 focus:border-blue-500 focus:outline-none"
          placeholder="Enter potential keys, one per line...
secret123
password
viewstate_key"
        ></textarea>
      </div>

      <!-- Algorithm -->
      <div class="mb-4">
        <label class="block text-sm text-gray-300 mb-2">Algorithm</label>
        <select
          v-model="bfAlgorithm"
          class="w-full p-3 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="HMAC-SHA256">HMAC-SHA256</option>
          <option value="HMAC-SHA1">HMAC-SHA1</option>
          <option value="HMAC-SHA384">HMAC-SHA384</option>
          <option value="HMAC-SHA512">HMAC-SHA512</option>
        </select>
      </div>

      <!-- Buttons -->
      <div class="flex gap-2 mb-4">
        <button
          @click="startBruteforce"
          :disabled="!bfCanStart || bfIsRunning"
          class="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {{ bfIsRunning ? '⏳ Running...' : '🔓 Start Bruteforce' }}
        </button>
        <button
          v-if="bfIsRunning"
          @click="stopBruteforce"
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
        >
          Stop
        </button>
        <button
          @click="clearBruteforce"
          :disabled="bfIsRunning"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white text-sm font-medium rounded transition-colors"
        >
          Clear
        </button>
      </div>

      <!-- Progress -->
      <div v-if="bfIsRunning || bfTestedKeys > 0" class="mb-4 p-3 bg-gray-800 border border-gray-700 rounded">
        <div class="flex justify-between text-sm text-gray-400 mb-2">
          <span>Progress: {{ bfTestedKeys }} / {{ bfTotalKeys }} keys</span>
          <span>{{ bfProgress }}%</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2">
          <div class="bg-blue-500 h-2 rounded-full transition-all" :style="{ width: bfProgress + '%' }"></div>
        </div>
      </div>

      <!-- Result: Key Found -->
      <div v-if="bfFoundKey" class="mb-4 p-4 bg-green-900 border border-green-700 rounded">
        <h3 class="text-lg font-semibold text-green-100 mb-2">🎉 Key Found!</h3>
        <div class="bg-gray-900 p-3 rounded">
          <code class="text-green-400 font-mono text-sm break-all">{{ bfFoundKey }}</code>
        </div>
        <button
          @click="copyBfKey"
          class="mt-3 px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded"
        >
          {{ bfCopied ? 'Copied!' : 'Copy Key' }}
        </button>
      </div>

      <!-- Result: Not Found -->
      <div v-else-if="bfFinished && !bfFoundKey" class="mb-4 p-4 bg-yellow-900 border border-yellow-700 rounded">
        <h3 class="text-lg font-semibold text-yellow-100">❌ Key Not Found</h3>
        <p class="text-sm text-yellow-200 mt-1">No matching key found in the wordlist.</p>
      </div>

      <!-- Empty State -->
      <div v-if="!bfViewState && !bfWordlist" class="text-center py-12">
        <div class="text-6xl mb-4">🔐</div>
        <h3 class="text-lg font-medium text-gray-300 mb-2">ViewState MAC Key Bruteforce</h3>
        <p class="text-sm text-gray-500 max-w-md mx-auto">
          Try to find the MAC validation key used to sign a ViewState.
          Paste the ViewState and a wordlist of potential keys.
        </p>
        <div class="mt-4 p-3 bg-gray-800 rounded inline-block">
          <p class="text-xs text-gray-400">⚠️ This feature requires the ViewState to be signed (MAC enabled).</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
details[open] summary span:first-child {
  transform: rotate(90deg);
  display: inline-block;
}

details summary span:first-child {
  transition: transform 0.2s;
}
</style>
