<template>
  <details :class="['collapsible-section', className]" :open="defaultOpen">
    <summary class="cursor-pointer p-3 bg-gray-800 rounded flex items-center justify-between hover:bg-gray-750">
      <div class="flex items-center gap-2">
        <span class="arrow">▶</span>
        <span :class="['font-semibold', titleClass]">{{ title }}</span>
      </div>
      <slot name="actions"></slot>
    </summary>
    <div :class="['p-3 bg-gray-900 rounded-b border border-gray-700 border-t-0', contentClass]">
      <slot></slot>
    </div>
  </details>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  defaultOpen?: boolean;
  titleClass?: string;
  contentClass?: string;
  className?: string;
}>();
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
</style>

