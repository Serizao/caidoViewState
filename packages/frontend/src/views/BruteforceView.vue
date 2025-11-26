<script setup lang="ts">
import { ref, computed } from 'vue';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import Card from 'primevue/card';
import Select from 'primevue/select';
import ProgressBar from 'primevue/progressbar';

const viewState = ref('');
const wordlist = ref('');
const algorithm = ref('HMAC-SHA256');
const isRunning = ref(false);
const finished = ref(false);
const foundKey = ref('');
const testedKeys = ref(0);
const totalKeys = ref(0);
const copied = ref(false);

const algorithms = [
  { label: 'HMAC-SHA256', value: 'HMAC-SHA256' },
  { label: 'HMAC-SHA1', value: 'HMAC-SHA1' },
  { label: 'HMAC-SHA384', value: 'HMAC-SHA384' },
  { label: 'HMAC-SHA512', value: 'HMAC-SHA512' },
];

const canStart = computed(() => viewState.value.trim() && wordlist.value.trim());
const progress = computed(() => totalKeys.value === 0 ? 0 : Math.round((testedKeys.value / totalKeys.value) * 100));

async function startBruteforce() {
  isRunning.value = true;
  finished.value = false;
  foundKey.value = '';
  testedKeys.value = 0;

  const keys = wordlist.value.split('\n').map(k => k.trim()).filter(k => k.length > 0);
  totalKeys.value = keys.length;

  for (let i = 0; i < keys.length; i++) {
    if (!isRunning.value) break;
    testedKeys.value = i + 1;
    await new Promise(resolve => setTimeout(resolve, 10));
    // TODO: Implement actual HMAC verification
  }

  isRunning.value = false;
  finished.value = true;
}

function stop() {
  isRunning.value = false;
}

function clear() {
  viewState.value = '';
  wordlist.value = '';
  foundKey.value = '';
  testedKeys.value = 0;
  totalKeys.value = 0;
  finished.value = false;
}

function copyKey() {
  navigator.clipboard.writeText(foundKey.value).then(() => {
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  });
}
</script>

<template>
  <div class="p-4 flex flex-col gap-4">
    <!-- Input Section -->
    <Card>
      <template #title>
        <span class="text-sm font-semibold">Bruteforce Configuration</span>
      </template>
      <template #content>
        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-sm text-surface-400 mb-2">ViewState (Base64)</label>
            <Textarea
              v-model="viewState"
              rows="3"
              class="w-full font-mono text-sm"
              placeholder="Paste your signed ViewState here..."
            />
          </div>

          <div>
            <label class="block text-sm text-surface-400 mb-2">Wordlist (one key per line)</label>
            <Textarea
              v-model="wordlist"
              rows="5"
              class="w-full font-mono text-sm"
              placeholder="Enter potential keys, one per line..."
            />
          </div>

          <div>
            <label class="block text-sm text-surface-400 mb-2">Algorithm</label>
            <Select
              v-model="algorithm"
              :options="algorithms"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>
        </div>
        
        <div class="flex gap-2 mt-4">
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
      </template>
    </Card>

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
      <h3 class="text-lg font-semibold text-green-400 mb-2">🎉 Key Found!</h3>
      <code class="block p-3 bg-surface-900 rounded text-green-400 font-mono text-sm break-all">{{ foundKey }}</code>
      <Button :label="copied ? 'Copied!' : 'Copy Key'" size="small" class="mt-3" @click="copyKey" />
    </div>

    <!-- Result: Not Found -->
    <div v-else-if="finished && !foundKey" class="p-4 bg-yellow-500/20 border border-yellow-500 rounded-md">
      <h3 class="text-lg font-semibold text-yellow-400">❌ Key Not Found</h3>
      <p class="text-sm text-yellow-300 mt-1">No matching key found in the wordlist.</p>
    </div>

    <!-- Empty State -->
    <div v-if="!viewState && !wordlist" class="text-center py-12">
      <div class="text-6xl mb-4">🔐</div>
      <h3 class="text-lg font-medium text-surface-300 mb-2">ViewState MAC Key Bruteforce</h3>
      <p class="text-sm text-surface-500 max-w-md mx-auto">
        Try to find the MAC validation key used to sign a ViewState.
        Paste the ViewState and a wordlist of potential keys.
      </p>
      <div class="mt-4 p-3 bg-surface-800 rounded inline-block">
        <p class="text-xs text-surface-400">⚠️ This feature requires the ViewState to be signed (MAC enabled).</p>
      </div>
    </div>
  </div>
</template>

