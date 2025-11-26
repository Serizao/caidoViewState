import { ref, watch } from 'vue';

// Store for passing ViewState data between components
export interface ViewStateData {
  viewState: string;
  generator: string;
  appPath: string;
}

// Reactive store - exported for watching
export const pendingData = ref<ViewStateData | null>(null);

// Counter to trigger reactivity even with same data
export const pendingDataVersion = ref(0);

export function setPendingViewStateData(data: ViewStateData) {
  pendingData.value = data;
  pendingDataVersion.value++; // Increment to trigger watchers
  console.log('[ViewState Store] Data set (version ' + pendingDataVersion.value + '):', data);
}

export function getPendingViewStateData(): ViewStateData | null {
  const data = pendingData.value;
  // Clear after reading (one-time use)
  pendingData.value = null;
  return data;
}

export function hasPendingData(): boolean {
  return pendingData.value !== null;
}
