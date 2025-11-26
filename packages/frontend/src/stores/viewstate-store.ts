import { ref } from 'vue';

// Store for passing ViewState data between components
export interface ViewStateData {
  viewState: string;
  generator: string;
  appPath: string;
}

// Reactive store
const pendingData = ref<ViewStateData | null>(null);

export function setPendingViewStateData(data: ViewStateData) {
  pendingData.value = data;
  console.log('[ViewState Store] Data set:', data);
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

