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
    <div v-if="viewStateDetected && parseResult" class="analysis-results">
      <div class="result-card p-4 mb-4 bg-gray-800 rounded border border-gray-700">
        <h3 class="text-md font-semibold mb-3">Analysis Results</h3>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="status-item">
            <span class="label text-gray-400">Encrypted:</span>
            <span :class="parseResult.encrypted ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'">
              {{ parseResult.encrypted ? 'YES' : 'NO' }}
            </span>
          </div>

          <div class="status-item">
            <span class="label text-gray-400">Signed (MAC):</span>
            <span :class="parseResult.mac ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'">
              {{ parseResult.mac ? 'YES' : 'NO' }}
              <span v-if="parseResult.mac && parseResult.macAlgorithm" class="text-xs text-gray-400 ml-1">
                ({{ parseResult.macAlgorithm }})
              </span>
            </span>
          </div>
        </div>

        <!-- MAC Digest (collapsible) -->
        <details v-if="parseResult.mac && parseResult.digest" class="collapsible-section mb-3">
          <summary class="cursor-pointer p-2 bg-gray-900 rounded flex items-center gap-2 hover:bg-gray-850">
            <span class="arrow">▶</span>
            <span class="text-sm text-gray-300">MAC Digest</span>
          </summary>
          <div class="p-3 bg-gray-900 rounded-b border-t border-gray-700">
            <code class="text-xs text-orange-400 break-all select-text">{{ parseResult.digest }}</code>
          </div>
        </details>

        <div class="details p-3 bg-gray-900 rounded">
          <p class="text-sm mb-2"><span class="text-gray-400">Size:</span> {{ viewStateValue.length }} chars</p>
        </div>
      </div>

      <!-- Parsed JSON Structure (collapsible) -->
      <details v-if="!parseResult.encrypted" class="collapsible-section mb-4" open>
        <summary class="cursor-pointer p-3 bg-gray-800 rounded flex items-center justify-between hover:bg-gray-750">
          <div class="flex items-center gap-2">
            <span class="arrow">▶</span>
            <span class="font-semibold text-blue-400">Parsed ViewState Structure</span>
          </div>
          <button
            @click.stop="copyToClipboard(jsonString)"
            class="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            title="Copy JSON to clipboard"
          >
            {{ copiedJson ? 'Copied!' : 'Copy JSON' }}
          </button>
        </summary>
        <div class="p-3 bg-gray-900 rounded-b border border-gray-700 border-t-0 max-h-96 overflow-y-auto">
          <pre class="text-xs whitespace-pre-wrap break-all select-text font-mono text-green-400">{{ jsonString }}</pre>
        </div>
      </details>

      <!-- ViewState Value (collapsible) -->
      <details class="collapsible-section mb-4">
        <summary class="cursor-pointer p-3 bg-gray-800 rounded flex items-center justify-between hover:bg-gray-750">
          <div class="flex items-center gap-2">
            <span class="arrow">▶</span>
            <span class="font-semibold">Raw ViewState Value</span>
          </div>
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

      <!-- Hex Dump (collapsible) -->
      <details class="collapsible-section mb-4">
        <summary class="cursor-pointer p-3 bg-gray-800 rounded flex items-center gap-2 hover:bg-gray-750">
          <span class="arrow">▶</span>
          <span class="font-semibold">Hex Dump (Binary)</span>
        </summary>
        <div class="p-3 bg-gray-900 rounded-b border border-gray-700 border-t-0 max-h-64 overflow-y-auto">
          <pre class="text-xs whitespace-pre-wrap break-all select-text font-mono">{{ hexDump }}</pre>
        </div>
      </details>

      <!-- Error display -->
      <div v-if="parseError" class="p-3 bg-red-900 border border-red-700 rounded">
        <p class="text-red-100"><span class="font-semibold">Parse Error:</span> {{ parseError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { API, RequestFull } from '@caido/sdk-frontend';
import { parseViewState, extractViewState, decodeViewState, type ViewStateParseResult } from './lib/viewstate-module';

const props = defineProps<{
  sdk: API;
  request?: RequestFull;
}>();

const currentRequest = ref<RequestFull | null>(null);
const viewStateValue = ref<string>('');
const parseResult = ref<ViewStateParseResult | null>(null);
const parseError = ref<string>('');
const copied = ref<boolean>(false);
const copiedJson = ref<boolean>(false);

const viewStateDetected = computed(() => viewStateValue.value.length > 0);

const jsonString = computed(() => {
  if (!parseResult.value?.json) return '';
  return JSON.stringify(parseResult.value.json, null, 2);
});

const hexDump = computed(() => {
  if (!viewStateValue.value) return '';

  try {
    const decoded = decodeViewState(viewStateValue.value);
    let result = '';
    const bytesPerLine = 16;

    for (let i = 0; i < decoded.length; i += bytesPerLine) {
      // Offset
      result += i.toString(16).padStart(8, '0') + '  ';

      // Hex bytes
      for (let j = 0; j < bytesPerLine; j++) {
        if (i + j < decoded.length) {
          const byte = decoded[i + j];
          result += byte.toString(16).padStart(2, '0') + ' ';
        } else {
          result += '   ';
        }
        if (j === 7) result += ' ';
      }

      result += ' ';

      // ASCII representation
      for (let j = 0; j < bytesPerLine && i + j < decoded.length; j++) {
        const byte = decoded[i + j];
        result += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
      }

      result += '\n';
    }

    return result;
  } catch {
    return 'Unable to decode ViewState';
  }
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
  const viewStates = extractViewState(rawRequest);

  if (viewStates.length > 0) {
    viewStateValue.value = viewStates[0];

    try {
      parseResult.value = parseViewState(viewStateValue.value);
      parseError.value = '';
      console.log('[ViewState] Parse result:', parseResult.value);
    } catch (error) {
      console.error('[ViewState] Failed to parse:', error);
      parseError.value = error instanceof Error ? error.message : 'Unknown error';
    }
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    if (text === viewStateValue.value) {
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    } else {
      copiedJson.value = true;
      setTimeout(() => {
        copiedJson.value = false;
      }, 2000);
    }
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

/* Collapsible sections with arrow */
.collapsible-section summary {
  user-select: none;
  list-style: none;
}

.collapsible-section summary::-webkit-details-marker {
  display: none;
}

.collapsible-section summary::marker {
  display: none;
}

.collapsible-section .arrow {
  display: inline-block;
  font-size: 0.7em;
  transition: transform 0.2s ease;
  color: #9ca3af;
}

.collapsible-section[open] .arrow {
  transform: rotate(90deg);
}

.collapsible-section[open] summary {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
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
