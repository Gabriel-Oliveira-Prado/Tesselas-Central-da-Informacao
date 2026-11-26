// A autorização activeTab pertence à aba em que a pessoa abriu a extensão.
// O selo só aparece se o seletor devolver o identificador daquela superfície.
function installIndicator(key, origin) {
  if (!navigator.mediaDevices?.setCaptureHandleConfig) return false;
  navigator.mediaDevices.setCaptureHandleConfig({ handle: key, permittedOrigins: [origin] });
  let host;
  const cleanup = () => {
    host?.remove();
    navigator.mediaDevices.setCaptureHandleConfig({ handle: '' });
    chrome.runtime.onConnect.removeListener(connect);
  };
  function connect(port) {
    if (port.name !== key) return;
    port.onDisconnect.addListener(cleanup);
    port.onMessage.addListener(text => {
      if (!text) { host?.remove(); host = undefined; return; }
      if (!host) {
        host = document.createElement('div');
        host.style.cssText = 'all:initial!important;position:fixed!important;bottom:12px!important;right:12px!important;z-index:2147483647!important;pointer-events:none!important';
        const badge = document.createElement('span');
        badge.style.cssText = 'display:block;padding:8px 14px;border:2px solid white;border-radius:8px;background:#16254d;color:white;font:bold 16px/1.4 system-ui';
        host.attachShadow({ mode: 'open' }).append(badge);
        document.documentElement.append(host);
      }
      host.shadowRoot.firstChild.textContent = text;
    });
  }
  chrome.runtime.onConnect.addListener(connect);
  return true;
}

export async function prepareIndicator(signal) {
  if (!globalThis.chrome?.scripting) {
    let channel;
    signal.addEventListener('abort', () => { channel?.postMessage(''); channel?.close(); }, { once: true });
    return (track, text) => {
      const capture = track.getCaptureHandle?.();
      if (capture?.origin !== location.origin || !capture.handle.startsWith('central-demo-')) return;
      channel ??= new BroadcastChannel(capture.handle);
      channel.postMessage(text);
    };
  }
  const key = crypto.randomUUID();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (signal.aborted || !tab?.id) return;
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: installIndicator, args: [key, location.origin] });
    if (!result?.result) return;
    const port = chrome.tabs.connect(tab.id, { name: key });
    port.onDisconnect.addListener(() => { void chrome.runtime.lastError; });
    if (signal.aborted) { port.disconnect(); return; }
    signal.addEventListener('abort', () => port.disconnect(), { once: true });
    return (track, text) => {
      if (signal.aborted) return;
      try { port.postMessage(track.getCaptureHandle?.()?.handle === key ? text : ''); } catch { /* A aba pode ter sido fechada. */ }
    };
  } catch { /* Outras superfícies conservam o indicador nativo do navegador. */ }
}
