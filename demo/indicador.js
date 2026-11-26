if (navigator.mediaDevices?.setCaptureHandleConfig) {
  const handle = 'central-demo-' + crypto.randomUUID();
  navigator.mediaDevices.setCaptureHandleConfig({ exposeOrigin: true, handle, permittedOrigins: [location.origin] });
  const channel = new BroadcastChannel(handle);
  const badge = document.createElement('div');
  badge.className = 'demo-indicator';
  badge.hidden = true;
  document.body.append(badge);
  let timer;
  channel.onmessage = ({ data }) => {
    clearTimeout(timer);
    badge.textContent = String(data).slice(0, 70);
    badge.hidden = !data;
    timer = setTimeout(() => { badge.hidden = true; }, 7000);
  };
}
