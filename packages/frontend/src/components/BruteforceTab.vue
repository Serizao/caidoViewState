<template>
  <div class="bruteforce-tab p-4">
    <!-- Input Section -->
    <div class="input-section mb-6">
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-2">
          ViewState (Base64)
        </label>
        <textarea
          v-model="viewStateInput"
          class="w-full h-24 p-3 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          placeholder="Paste your signed ViewState here..."
        ></textarea>
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Wordlist (one key per line)
        </label>
        <textarea
          v-model="wordlistInput"
          class="w-full h-32 p-3 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          placeholder="Enter potential keys, one per line..."
        ></textarea>
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Algorithm
        </label>
        <select
          v-model="algorithm"
          class="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        >
          <option value="HMAC-SHA256">HMAC-SHA256</option>
          <option value="HMAC-SHA1">HMAC-SHA1</option>
          <option value="HMAC-SHA384">HMAC-SHA384</option>
          <option value="HMAC-SHA512">HMAC-SHA512</option>
        </select>
      </div>
      
      <div class="flex gap-2">
        <button
          @click="startBruteforce"
          :disabled="!canStart || isRunning"
          class="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {{ isRunning ? '⏳ Running...' : '🔓 Start Bruteforce' }}
        </button>
        <button
          v-if="isRunning"
          @click="stopBruteforce"
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Stop
        </button>
        <button
          @click="clearAll"
          :disabled="isRunning"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Progress -->
    <div v-if="isRunning || progress > 0" class="progress-section mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg">
      <div class="flex justify-between text-sm text-gray-400 mb-2">
        <span>Progress: {{ testedKeys }} / {{ totalKeys }} keys</span>
        <span>{{ progressPercent }}%</span>
      </div>
      <div class="w-full bg-gray-700 rounded-full h-2">
        <div
          class="bg-blue-500 h-2 rounded-full transition-all duration-300"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>
    </div>

    <!-- Result -->
    <div v-if="foundKey" class="result-section mb-4 p-4 bg-green-900 border border-green-700 rounded-lg">
      <h3 class="text-lg font-semibold text-green-100 mb-2">🎉 Key Found!</h3>
      <div class="bg-gray-900 p-3 rounded">
        <code class="text-green-400 font-mono text-sm break-all">{{ foundKey }}</code>
      </div>
      <button
        @click="copyKey"
        class="mt-3 px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
      >
        {{ copied ? 'Copied!' : 'Copy Key' }}
      </button>
    </div>

    <div v-else-if="finished && !foundKey" class="result-section mb-4 p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
      <h3 class="text-lg font-semibold text-yellow-100">❌ Key Not Found</h3>
      <p class="text-sm text-yellow-200 mt-1">No matching key found in the wordlist.</p>
    </div>

    <!-- Empty State -->
    <div v-if="!viewStateInput && !wordlistInput" class="empty-state text-center py-12">
      <div class="text-6xl mb-4">🔐</div>
      <h3 class="text-lg font-medium text-gray-300 mb-2">ViewState MAC Key Bruteforce</h3>
      <p class="text-sm text-gray-500 max-w-md mx-auto">
        Try to find the MAC validation key used to sign a ViewState.
        Paste the ViewState and a wordlist of potential keys.
      </p>
      <div class="mt-4 p-3 bg-gray-800 rounded-lg inline-block">
        <p class="text-xs text-gray-400">
          ⚠️ This feature requires the ViewState to be signed (MAC enabled).
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeMount } from 'vue';

console.log('[BruteforceTab] Script setup executing');

const viewStateInput = ref('');
const wordlistInput = ref('');
const algorithm = ref('HMAC-SHA256');
const isRunning = ref(false);
const finished = ref(false);
const foundKey = ref('');
const testedKeys = ref(0);
const totalKeys = ref(0);
const copied = ref(false);

const canStart = computed(() => {
  return viewStateInput.value.trim() && wordlistInput.value.trim();
});

const progress = computed(() => {
  if (totalKeys.value === 0) return 0;
  return testedKeys.value / totalKeys.value;
});

const progressPercent = computed(() => {
  return Math.round(progress.value * 100);
});

onBeforeMount(() => {
  console.log('[BruteforceTab] onBeforeMount');
});

onMounted(() => {
  console.log('[BruteforceTab] onMounted');
});

async function startBruteforce() {
  console.log('[BruteforceTab] startBruteforce called');
  isRunning.value = true;
  finished.value = false;
  foundKey.value = '';
  testedKeys.value = 0;

  const keys = wordlistInput.value
    .split('\n')
    .map(k => k.trim())
    .filter(k => k.length > 0);

  totalKeys.value = keys.length;

  for (let i = 0; i < keys.length; i++) {
    if (!isRunning.value) break;
    testedKeys.value = i + 1;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  isRunning.value = false;
  finished.value = true;
}

function stopBruteforce() {
  isRunning.value = false;
}

function clearAll() {
  viewStateInput.value = '';
  wordlistInput.value = '';
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

<style scoped>
textarea:focus,
select:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}
</style>
