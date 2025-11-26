<script setup lang="ts">
import { ref, computed } from 'vue';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import Card from 'primevue/card';
import Panel from 'primevue/panel';
import Tag from 'primevue/tag';

import { parseViewState, decodeViewState } from '../lib/viewstate-module';

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
    const maxBytes = Math.min(decoded.length, 256);
    for (let i = 0; i < maxBytes; i += bytesPerLine) {
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

function doParse() {
  parseError.value = '';
  parseResult.value = null;
  if (!viewStateInput.value.trim()) {
    parseError.value = 'Please enter a ViewState value';
    return;
  }
  try {
    parseResult.value = parseViewState(viewStateInput.value.trim());
  } catch (e) {
    parseError.value = e instanceof Error ? e.message : 'Failed to parse ViewState';
  }
}

function loadExample(ex: { name: string; value: string }) {
  viewStateInput.value = ex.value;
  doParse();
}

function clear() {
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
</script>

<template>
  <div class="p-4 flex flex-col gap-4">
    <!-- Input Section -->
    <Card>
      <template #title>
        <span class="text-sm font-semibold">ViewState Input</span>
      </template>
      <template #content>
        <Textarea
          v-model="viewStateInput"
          rows="4"
          class="w-full font-mono text-sm"
          placeholder="Paste your ViewState here..."
        />
        
        <div class="flex gap-2 mt-3">
          <Button label="Parse ViewState" icon="fas fa-play" @click="doParse" :disabled="!viewStateInput.trim()" />
          <Button label="Clear" icon="fas fa-trash" severity="secondary" @click="clear" />
        </div>

        <div class="flex items-center gap-2 mt-3 flex-wrap">
          <span class="text-xs text-surface-500">Examples:</span>
          <Button
            v-for="ex in examples"
            :key="ex.name"
            :label="ex.name"
            size="small"
            severity="contrast"
            text
            @click="loadExample(ex)"
          />
        </div>
      </template>
    </Card>

    <!-- Error -->
    <div v-if="parseError" class="p-3 bg-red-500/20 border border-red-500 rounded-md">
      <span class="text-red-400 text-sm"><strong>Error:</strong> {{ parseError }}</span>
    </div>

    <!-- Results -->
    <template v-if="parseResult">
      <!-- Success Banner -->
      <div class="p-3 bg-green-500/20 border border-green-500 rounded-md">
        <span class="text-green-400 font-semibold">✅ ViewState parsed successfully!</span>
      </div>

      <!-- Analysis Summary -->
      <Card>
        <template #title>
          <span class="text-sm font-semibold">Analysis Results</span>
        </template>
        <template #content>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="flex items-center gap-2">
              <span class="text-surface-400">Encrypted:</span>
              <Tag :severity="parseResult.encrypted ? 'danger' : 'success'" :value="parseResult.encrypted ? 'YES' : 'NO'" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-surface-400">Signed (MAC):</span>
              <Tag :severity="parseResult.mac ? 'success' : 'danger'" :value="parseResult.mac ? 'YES' : 'NO'" />
              <span v-if="parseResult.macAlgorithm" class="text-xs text-surface-500">({{ parseResult.macAlgorithm }})</span>
            </div>
          </div>

          <Panel v-if="parseResult.mac && parseResult.digest" header="MAC Digest" toggleable collapsed class="mb-3">
            <code class="text-xs text-orange-400 break-all">{{ parseResult.digest }}</code>
          </Panel>

          <div class="p-2 bg-surface-800 rounded text-sm text-surface-400">
            Size: {{ viewStateInput.length }} chars
          </div>
        </template>
      </Card>

      <!-- Parsed JSON Structure -->
      <Panel v-if="!parseResult.encrypted" header="Parsed ViewState Structure" toggleable class="panel-json">
        <template #icons>
          <Button :label="copiedJson ? 'Copied!' : 'Copy JSON'" size="small" text @click="copyJson" />
        </template>
        <pre class="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-auto max-h-80">{{ jsonString }}</pre>
      </Panel>

      <!-- Raw ViewState -->
      <Panel header="Raw ViewState Value" toggleable collapsed>
        <template #icons>
          <Button :label="copiedRaw ? 'Copied!' : 'Copy'" size="small" text @click="copyRaw" />
        </template>
        <pre class="text-xs text-surface-300 font-mono whitespace-pre-wrap break-all overflow-auto max-h-40">{{ viewStateInput }}</pre>
      </Panel>

      <!-- Hex Dump -->
      <Panel header="Hex Dump (Binary)" toggleable collapsed>
        <pre class="text-xs text-surface-400 font-mono overflow-auto max-h-40">{{ hexDump }}</pre>
      </Panel>
    </template>

    <!-- Empty State -->
    <div v-if="!parseResult && !parseError" class="text-center py-12">
      <div class="text-6xl mb-4">🔍</div>
      <h3 class="text-lg font-medium text-surface-300 mb-2">No ViewState Parsed</h3>
      <p class="text-sm text-surface-500">Paste a ViewState value above and click "Parse ViewState" to analyze it.</p>
    </div>
  </div>
</template>

<style scoped>
.panel-json :deep(.p-panel-content) {
  background: var(--p-surface-900);
}
</style>

