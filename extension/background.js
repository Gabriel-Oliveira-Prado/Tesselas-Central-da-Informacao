// O listener explícito também concede activeTab. A abertura declarativa do
// painel pode não conceder essa permissão temporária em versões do Chromium.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => {
    console.error('Não foi possível abrir o painel Central da Informação.', error);
  });
});
// Importar texto continua exigindo o acionamento de um botão no painel.
