"use strcit";

chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.includes('fr.aliexpress.com'))
            chrome.action.enable();
        else
            chrome.action.disable();
    });
});
  