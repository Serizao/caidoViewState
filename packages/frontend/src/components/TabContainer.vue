<template>
  <div class="tab-container flex flex-col h-full">
    <!-- Tab Headers -->
    <div class="tab-headers flex border-b border-gray-700 shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="selectTab(tab.id)"
        :class="[
          'tab-header px-4 py-3 text-sm font-medium transition-colors',
          modelValue === tab.id
            ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
        ]"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content flex-1 overflow-y-auto">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Tab {
  id: string;
  label: string;
}

defineProps<{
  tabs: Tab[];
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', tabId: string): void;
}>();

function selectTab(tabId: string) {
  emit('update:modelValue', tabId);
}
</script>

<style scoped>
.tab-header {
  position: relative;
  margin-bottom: -1px;
}
</style>
