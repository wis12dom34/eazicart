import { tokenStore } from "./client";

const channelName = "eazicart-account-change";
const eventKey = "eazicart.account-change";
const sender = crypto.randomUUID();

export function reloadForAccountChange(destination?: string) {
  tokenStore.clear();
  if (destination) window.location.replace(destination);
  else window.location.reload();
}

export function announceAccountChange() {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage(sender);
    channel.close();
  }
  try {
    localStorage.setItem(eventKey, crypto.randomUUID());
  } catch {
    // BroadcastChannel remains available when storage is disabled.
  }
}

export function watchAccountChanges() {
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(channelName)
      : undefined;
  if (channel) {
    channel.onmessage = (event) => {
      if (event.data !== sender) reloadForAccountChange();
    };
  }
  const changed = (event: StorageEvent) => {
    if (event.key === eventKey) reloadForAccountChange();
  };
  window.addEventListener("storage", changed);
  return () => {
    channel?.close();
    window.removeEventListener("storage", changed);
  };
}
