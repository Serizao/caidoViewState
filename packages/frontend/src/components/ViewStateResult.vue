<template>
  <div class="viewstate-result">
    <!-- Analysis Summary -->
    <div class="result-card p-4 mb-4 bg-gray-800 rounded border border-gray-700">
      <h3 class="text-md font-semibold mb-3">Analysis Results</h3>

      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="status-item">
          <span class="label text-gray-400">Encrypted:</span>
          <span :class="result.encrypted ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'">
            {{ result.encrypted ? 'YES' : 'NO' }}
          </span>
        </div>

        <div class="status-item">
          <span class="label text-gray-400">Signed (MAC):</span>
          <span :class="result.mac ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'">
            {{ result.mac ? 'YES' : 'NO' }}
            <span v-if="result.mac && result.macAlgorithm" class="text-xs text-gray-400 ml-1">
              ({{ result.macAlgorithm }})
            </span>
          </span>
        </div>
      </div>

      <!-- MAC Digest -->
      <details v-if="result.mac && result.digest" class="collapsible-section mb-3">
        <summary class="cursor-pointer p-2 bg-gray-900 rounded flex items-center gap-2 hover:bg-gray-850">
          <span class="arrow">▶</span>
          <span class="text-sm text-gray-300">MAC Digest</span>
        </summary>
        <div class="p-3 bg-gray-900 rounded-b border-t border-gray-700">
          <code class="text-xs text-orange-400 break-all select-text">{{ result.digest }}</code>
        </div>
      </details>

      <div class="details p-3 bg-gray-900 rounded">
        <p class="text-sm"><span class="text-gray-400">Size:</span> {{ rawValue.length }} chars</p>
      </div>
    </div>

    <!-- Parsed JSON Structure -->
    <details v-if="!result.encrypted" class="collapsible-section mb-4" open>
      <summary class="cursor-pointer p-3 bg-gray-800 rounded flex items-center justify-between hover:bg-gray-750">
        <div class="flex items-center gap-2">
          <span class="arrow">▶</span>
          <span class="font-semibold text-blue-400">Parsed ViewState Structure</span>
        </div>
        <button
          @click.stop="copyJson"
          class="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
        >
          {{ copiedJson ? 'Copied!' : 'Copy JSON' }}
        </button>
      </summary>
      <div class="p-3 bg-gray-900 rounded-b border border-gray-700 border-t-0 max-h-96 overflow-y-auto">
        <pre class="text-xs whitespace-pre-wrap break-all select-text font-mono text-green-400">{{ jsonString }}</pre>
      </div>
    </details>

    <!-- Raw ViewState Value -->
    <details class="collapsible-section mb-4">
      <summary class="cursor-pointer p-3 bg-gray-800 rounded flex items-center justify-between hover:bg-gray-750">
        <div class="flex items-center gap-2">
          <span class="arrow">▶</span>
          <span class="font-semibold">Raw ViewState Value</span>
        </div>
        <button
          @click.stop="copyRaw"
          class="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
        >
          {{ copiedRaw ? 'Copied!' : 'Copy' }}
        </button>
      </summary>
      <div class="p-3 bg-gray-900 rounded-b border border-gray-700 border-t-0 max-h-64 overflow-y-auto">
        <pre class="text-xs whitespace-pre-wrap break-all select-text">{{ rawValue }}</pre>
      </div>
    </details>

    <!-- Hex Dump -->
    <details class="collapsible-section mb-4">
      <summary class="cursor-pointer p-3 bg-gray-800 rounded flex items-center gap-2 hover:bg-gray-750">
        <span class="arrow">▶</span>
        <span class="font-semibold">Hex Dump (Binary)</span>
      </summary>
      <div class="p-3 bg-gray-900 rounded-b border border-gray-700 border-t-0 max-h-64 overflow-y-auto">
        <pre class="text-xs whitespace-pre-wrap break-all select-text font-mono">{{ hexDump }}</pre>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeMount } from 'vue';
import { decodeViewState, type ViewStateParseResult } from '../lib/viewstate-module';

console.log('[ViewStateResult] Script setup executing');

const props = defineProps<{
  result: ViewStateParseResult;
  rawValue: string;
}>();

const copiedJson = ref(false);
const copiedRaw = ref(false);

onBeforeMount(() => {
  console.log('[ViewStateResult] onBeforeMount');
});

onMounted(() => {
  console.log('[ViewStateResult] onMounted');
});

const jsonString = computed(() => {
  if (!props.result?.json) return '';
  return JSON.stringify(props.result.json, null, 2);
});

const hexDump = computed(() => {
  if (!props.rawValue) return '';

  try {
    const decoded = decodeViewState(props.rawValue);
    let result = '';
    const bytesPerLine = 16;

    for (let i = 0; i < decoded.length; i += bytesPerLine) {
      result += i.toString(16).padStart(8, '0') + '  ';

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

function copyJson() {
  navigator.clipboard.writeText(jsonString.value).then(() => {
    copiedJson.value = true;
    setTimeout(() => { copiedJson.value = false; }, 2000);
  });
}

function copyRaw() {
  navigator.clipboard.writeText(props.rawValue).then(() => {
    copiedRaw.value = true;
    setTimeout(() => { copiedRaw.value = false; }, 2000);
  });
}
</script>

<style scoped>
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

.select-text {
  user-select: text;
  -webkit-user-select: text;
}

.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
