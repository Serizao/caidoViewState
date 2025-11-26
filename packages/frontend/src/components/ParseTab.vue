<template>
  <div class="parse-tab p-4">
    <!-- Input Section -->
    <div class="input-section mb-6">
      <label class="block text-sm font-medium text-gray-300 mb-2">
        ViewState (Base64)
      </label>
      <textarea
        v-model="viewStateInput"
        class="w-full h-32 p-3 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
        placeholder="Paste your ViewState here... (e.g., /wEPDwUKLTM0MjUyMzM2OWRk...)"
      ></textarea>
      
      <div class="flex gap-2 mt-3">
        <button
          @click="parseViewStateInput"
          :disabled="!viewStateInput.trim()"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          Parse ViewState
        </button>
        <button
          @click="clearAll"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-section mb-4 p-3 bg-red-900 border border-red-700 rounded-lg">
      <p class="text-red-100 text-sm">
        <span class="font-semibold">Error:</span> {{ error }}
      </p>
    </div>

    <!-- Results Section -->
    <div v-if="parseResult" class="results-section">
      <div class="alert alert-success p-3 mb-4 bg-green-900 border border-green-700 rounded">
        <p class="font-semibold text-green-100">ViewState parsed successfully!</p>
      </div>
      <ViewStateResult :result="parseResult" :raw-value="viewStateInput" />
    </div>

    <!-- Empty State -->
    <div v-else-if="!error" class="empty-state text-center py-12">
      <div class="text-6xl mb-4">🔍</div>
      <h3 class="text-lg font-medium text-gray-300 mb-2">No ViewState Parsed</h3>
      <p class="text-sm text-gray-500">Paste a ViewState value above and click "Parse ViewState" to analyze it.</p>
      
      <div class="mt-6">
        <p class="text-xs text-gray-500 mb-2">Try an example:</p>
        <div class="flex flex-wrap justify-center gap-2">
          <button
            v-for="(example, index) in examples"
            :key="index"
            @click="loadExample(example)"
            class="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded transition-colors"
          >
            {{ example.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeMount } from 'vue';
import ViewStateResult from './ViewStateResult.vue';
import { parseViewState, type ViewStateParseResult } from '../lib/viewstate-module';

console.log('[ParseTab] Script setup executing');

const viewStateInput = ref('');
const parseResult = ref<ViewStateParseResult | null>(null);
const error = ref('');

const examples = [
  { name: 'Simple Bool', value: '/wFn' },
  { name: 'Int32', value: '/wECiAE=' },
  { name: 'String', value: '/wEFCmFiY2RlZmdoaWo=' },
  { name: 'With MAC', value: '/wEPDwUKLTM0MjUyMzM2OWRkmW75zyss5UROsLtrTEuOq7AGUDk=' },
  { name: 'Encrypted', value: 'ZU1VanBjYUFOWGlGcElTcGtwQ3dWSndXY3NtZ05XNEZscWtsOUlWcjlxV01iYUFOYW92eTJOSkh6MnNadmNCTG9kRGdBbTVrUWNhQ2ZKdnh0d0t0eUtLMmwzY29GMTY5UzR6WnpLY1JWUTEzaWhVNW12VG44YkllZmlGUjZSZTJ4ZDVkcEp2VVp5bDBpVEVucUdDaFVwdUlteTJsZ1VMRkpCRnZjWGRnUDJqTXRIdWsxVkJoZ0NSM01aQWd5NW5KUnVlbDlJbDF6Y1M3R21rS05ZV241bHhkOEJDSU1yVHJIRlBTSEl5SFVaWjhLNFFMRVF2QzZ5MmdvWG1STDBaRg==' },
];

onBeforeMount(() => {
  console.log('[ParseTab] onBeforeMount');
});

onMounted(() => {
  console.log('[ParseTab] onMounted');
});

function parseViewStateInput() {
  console.log('[ParseTab] parseViewStateInput called');
  error.value = '';
  parseResult.value = null;

  if (!viewStateInput.value.trim()) {
    error.value = 'Please enter a ViewState value';
    return;
  }

  try {
    parseResult.value = parseViewState(viewStateInput.value.trim());
    console.log('[ParseTab] Decoded:', parseResult.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to parse ViewState';
    console.error('[ParseTab] Error:', e);
  }
}

function clearAll() {
  viewStateInput.value = '';
  parseResult.value = null;
  error.value = '';
}

function loadExample(example: { name: string; value: string }) {
  viewStateInput.value = example.value;
  parseViewStateInput();
}
</script>

<style scoped>
textarea:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}
</style>
