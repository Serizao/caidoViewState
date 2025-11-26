<template>
  <div class="viewstate-analyzer p-4">
    <h2 class="text-lg font-semibold mb-4">ViewState Analyzer</h2>

    <!-- ViewState Detection Status -->
    <div v-if="viewStateDetected" class="alert alert-success p-3 mb-4 bg-green-900 border border-green-700 rounded">
      <p class="font-semibold text-green-100">ViewState detected in request!</p>
    </div>
    <div v-else class="alert alert-info p-3 mb-4 bg-blue-900 border border-blue-700 rounded">
      <p class="text-blue-100">No ViewState parameter found in this request.</p>
    </div>

    <!-- ViewState Analysis Results -->
    <div v-if="viewStateDetected && analysis" class="analysis-results">
      <div class="result-card p-4 mb-4 bg-gray-800 rounded border border-gray-700">
        <h3 class="text-md font-semibold mb-3">Analysis Results</h3>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="status-item">
            <span class="label text-gray-400">Encrypted:</span>
            <span :class="analysis.isEncrypted ? 'text-yellow-400 font-semibold' : 'text-gray-500'">
              {{ analysis.isEncrypted ? 'YES' : 'NO' }}
            </span>
          </div>

          <div class="status-item">
            <span class="label text-gray-400">Signed (MAC):</span>
            <span :class="analysis.isSigned ? 'text-yellow-400 font-semibold' : 'text-gray-500'">
              {{ analysis.isSigned ? 'YES' : 'NO' }}
              <span v-if="analysis.isSigned && analysis.details?.macType" class="text-xs text-gray-400 ml-1">
                ({{ analysis.details.macType }})
              </span>
            </span>
          </div>
        </div>

        <div class="details p-3 bg-gray-900 rounded">
          <p class="text-sm mb-2"><span class="text-gray-400">Valid:</span> {{ analysis.isValid ? 'Yes' : 'No' }}</p>
          <p class="text-sm mb-2"><span class="text-gray-400">.NET Version:</span> {{ analysis.details?.dotNetVersion || 'Unknown' }}</p>
          <p class="text-sm mb-2"><span class="text-gray-400">Compressed:</span> {{ analysis.details?.isCompressed ? 'Yes' : 'No' }}</p>
          <p class="text-sm mb-2"><span class="text-gray-400">Size:</span> {{ viewStateValue.length }} chars ({{ analysis.decoded?.length || 0 }} bytes decoded)</p>
          <p v-if="analysis.error" class="text-sm text-red-400"><span class="text-gray-400">Error:</span> {{ analysis.error }}</p>
        </div>

        <!-- Detected Controls -->
        <div v-if="analysis.details?.controlTree && analysis.details.controlTree.length > 0" class="mt-3 p-3 bg-gray-900 rounded">
          <h4 class="text-sm font-semibold text-blue-400 mb-2">Detected Controls</h4>
          <div class="text-xs space-y-1">
            <p v-for="(control, index) in analysis.details.controlTree" :key="index" class="text-green-400">
              └─ {{ control }}
            </p>
          </div>
        </div>

        <!-- Technical Metrics -->
        <details class="mt-3">
          <summary class="cursor-pointer text-sm text-gray-400 hover:text-gray-300">
            <span>Show technical metrics</span>
          </summary>
          <div class="mt-2 p-3 bg-gray-900 rounded text-xs space-y-1">
            <p><span class="text-gray-400">Overall Entropy:</span> {{ analysis.details?.entropy?.toFixed(3) || 'N/A' }}</p>
            <p><span class="text-gray-400">Last 32 bytes entropy:</span> {{ analysis.details?.entropy32?.toFixed(3) || 'N/A' }}</p>
            <p><span class="text-gray-400">Last 20 bytes entropy:</span> {{ analysis.details?.entropy20?.toFixed(3) || 'N/A' }}</p>
            <p><span class="text-gray-400">Plaintext markers:</span> {{ analysis.details?.hasPlaintextMarkers ? 'Yes' : 'No' }}</p>
            <p><span class="text-gray-400">Readable strings:</span> {{ analysis.details?.hasReadableStrings ? 'Yes' : 'No' }}</p>
            <p><span class="text-gray-400">Null byte ratio:</span> {{ analysis.details?.nullByteRatio?.toFixed(3) || 'N/A' }}</p>
          </div>
        </details>
      </div>

      <!-- ViewState Value -->
      <details class="viewstate-details mb-4">
        <summary class="cursor-pointer p-3 bg-gray-800 rounded hover:bg-gray-750 flex items-center justify-between">
          <span class="font-semibold">ViewState Value</span>
          <button
            @click.stop="copyToClipboard(viewStateValue)"
            class="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            title="Copy ViewState to clipboard"
          >
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </summary>
        <div class="p-3 bg-gray-900 rounded-b border border-gray-700 border-t-0 max-h-64 overflow-y-auto">
          <pre class="text-xs whitespace-pre-wrap break-all select-text">{{ viewStateValue }}</pre>
        </div>
      </details>

      <!-- Decoded ViewState (if available) -->
      <details v-if="analysis.decoded" class="viewstate-details mb-4">
        <summary class="cursor-pointer p-3 bg-gray-800 rounded hover:bg-gray-750">
          <span class="font-semibold">Decoded ViewState (Binary)</span>
        </summary>
        <div class="p-3 bg-gray-900 rounded-b border border-gray-700 border-t-0 max-h-64 overflow-y-auto">
          <pre class="text-xs whitespace-pre-wrap break-all select-text font-mono">{{ hexDump }}</pre>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { API, RequestFull } from '@caido/sdk-frontend';
import { ViewStateParser } from './viewstate-parser';

const props = defineProps<{
  sdk: API;
  request?: RequestFull;
}>();

const currentRequest = ref<RequestFull | null>(null);
const viewStateValue = ref<string>('');
const analysis = ref<any>(null);
const copied = ref<boolean>(false);

const viewStateDetected = computed(() => viewStateValue.value.length > 0);

const hexDump = computed(() => {
  if (!analysis.value?.decoded) return '';

  const decoded = analysis.value.decoded;
  let result = '';
  const bytesPerLine = 16;

  for (let i = 0; i < decoded.length; i += bytesPerLine) {
    // Offset
    result += i.toString(16).padStart(8, '0') + '  ';

    // Hex bytes
    for (let j = 0; j < bytesPerLine; j++) {
      if (i + j < decoded.length) {
        const byte = decoded.charCodeAt(i + j);
        result += byte.toString(16).padStart(2, '0') + ' ';
      } else {
        result += '   ';
      }
      if (j === 7) result += ' ';
    }

    result += ' ';

    // ASCII representation
    for (let j = 0; j < bytesPerLine && i + j < decoded.length; j++) {
      const byte = decoded.charCodeAt(i + j);
      result += (byte >= 32 && byte <= 126) ? decoded.charAt(i + j) : '.';
    }

    result += '\n';
  }

  return result;
});

onMounted(() => {
  if (props.request) {
    currentRequest.value = props.request;
    analyzeRequest();
  }
});

function analyzeRequest() {
  if (!currentRequest.value?.raw) return;

  const rawRequest = currentRequest.value.raw;

  // Extract ViewState from the request body
  const viewStates = ViewStateParser.extractViewState(rawRequest);

  if (viewStates.length > 0) {
    viewStateValue.value = viewStates[0];

    try {
      analysis.value = ViewStateParser.analyze(viewStateValue.value);
      console.log('[ViewState] Analysis:', analysis.value);
    } catch (error) {
      console.error('[ViewState] Failed to analyze:', error);
    }
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }).catch(err => {
    console.error('[ViewState] Failed to copy to clipboard:', err);
  });
}
</script>

<style scoped>
.viewstate-analyzer {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

code {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

summary {
  user-select: none;
}

details[open] summary {
  margin-bottom: 0.5rem;
}

/* Enable text selection */
.select-text {
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

/* Scrollbar styling for better UX */
.overflow-y-auto {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(155, 155, 155, 0.5);
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(155, 155, 155, 0.7);
}

/* Ensure pre elements can scroll */
pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
