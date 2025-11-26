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
    <div v-if="viewStateDetected && parseResult">
      <ViewStateResult :result="parseResult" :raw-value="viewStateValue" />
    </div>

    <!-- Error display -->
    <div v-if="parseError" class="p-3 bg-red-900 border border-red-700 rounded">
      <p class="text-red-100"><span class="font-semibold">Parse Error:</span> {{ parseError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { API, RequestFull } from '@caido/sdk-frontend';
import ViewStateResult from './components/ViewStateResult.vue';
import { parseViewState, extractViewState, type ViewStateParseResult } from './lib/viewstate-module';

const props = defineProps<{
  sdk: API;
  request?: RequestFull;
}>();

const currentRequest = ref<RequestFull | null>(null);
const viewStateValue = ref<string>('');
const parseResult = ref<ViewStateParseResult | null>(null);
const parseError = ref<string>('');

const viewStateDetected = computed(() => viewStateValue.value.length > 0);

onMounted(() => {
  if (props.request) {
    currentRequest.value = props.request;
    analyzeRequest();
  }
});

function analyzeRequest() {
  if (!currentRequest.value?.raw) return;

  const rawRequest = currentRequest.value.raw;
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
</script>

<style scoped>
.viewstate-analyzer {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}
</style>
