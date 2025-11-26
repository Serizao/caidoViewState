<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import Button from 'primevue/button';
import MenuBar from 'primevue/menubar';

import ParseView from './ParseView.vue';
import BruteforceView from './BruteforceView.vue';
import { hasPendingData, pendingDataVersion } from '../stores/viewstate-store';

const page = ref<'Parse' | 'Bruteforce'>('Parse');

const items = [
  {
    label: 'Parse ViewState',
    class: 'mx-1',
    isActive: () => page.value === 'Parse',
    command: () => { page.value = 'Parse'; },
  },
  {
    label: 'Bruteforce Key',
    class: 'mx-1',
    isActive: () => page.value === 'Bruteforce',
    command: () => { page.value = 'Bruteforce'; },
  },
];

const component = computed(() => {
  switch (page.value) {
    case 'Parse':
      return ParseView;
    case 'Bruteforce':
      return BruteforceView;
    default:
      return undefined;
  }
});

const handleLabel = (label: string | ((...args: unknown[]) => string) | undefined) => {
  if (typeof label === 'function') {
    return label();
  }
  return label;
};

// Check for pending data on mount and switch to Bruteforce tab
onMounted(() => {
  if (hasPendingData()) {
    console.log('[ViewState App] Pending data detected on mount, switching to Bruteforce tab');
    page.value = 'Bruteforce';
  }
});

// Watch for new pending data and switch to Bruteforce tab
watch(pendingDataVersion, () => {
  if (hasPendingData()) {
    console.log('[ViewState App] New pending data detected, switching to Bruteforce tab');
    page.value = 'Bruteforce';
  }
});
</script>

<template>
  <div class="h-full flex flex-col gap-1">
    <MenuBar :model="items" class="h-12 gap-2">
      <template #start>
        <div class="px-2 font-bold">🔐 ViewState Tools</div>
      </template>

      <template #item="{ item }">
        <Button
          :severity="item.isActive?.() ? 'secondary' : 'contrast'"
          :outlined="item.isActive?.()"
          size="small"
          :text="!item.isActive?.()"
          :label="handleLabel(item.label)"
          @mousedown="item.command?.()"
        />
      </template>
    </MenuBar>
    <div class="flex-1 min-h-0 overflow-auto">
      <component :is="component" />
    </div>
  </div>
</template>

<style scoped>
#plugin--viewstate-decoder {
  height: 100%;
}
</style>
