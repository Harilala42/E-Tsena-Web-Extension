"use strcit";

// Autorisation d'excécution uniquement sur Alieppress
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.includes('aliexpress.com')) {
            chrome.action.enable();
            chrome.storage.local.get('isAccessTokenUpdate', (result) => {
                if (result.isAccessTokenUpdate) {
                    chrome.storage.local.set({ 'isAccessTokenUpdate': false });
                    generationAccessToken();
                }
            });
        } else
            chrome.action.disable();
    });
});

// Après installation réussi de l'extension
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        chrome.windows.create({
            url: "https://e-tsena-dropshipping.onrender.com/googleOauth20/signin",
            type: "popup",
            width: 400,
            height: 500,
            left: 200,
            top: 150
        });
        chrome.storage.local.set({ 'isAccessTokenUpdate': true });
    } else if (details.reason === "update") {
        console.log("Extension mise à jour !");
    }
});

// Renouvellement automatique du token avant expiration du 'access_token'
async function generationAccessToken () {
    try {
        let user = await fetch('https://e-tsena-dropshipping.onrender.com/tokenAE/getExpireTime');
        if (!user.ok)
            throw new Error(`HTTP error! status: ${user.status}`);

        const { access_token_time, refresh_token_time } = await user.json();
        chrome.storage.local.set({ 'access_token_time': access_token_time });
        chrome.storage.local.set({ 'refresh_token_time': refresh_token_time });
    } catch (error) {
        throw Error("Error Access Token Generation", error);
    }

    chrome.storage.local.get('access_token_time', (result) => {
        const expirationTime = result.access_token_time * 1000;
        const timeUntilExpiration = expirationTime - Date.now() - 60000;
    
        if (timeUntilExpiration > 0)
            setTimeout(refreshAccessToken, /*timeUntilExpiration*/10000); 
    });
}

// Renouvellement manuel du token avant expiration du 'refresh_token'
function refreshAccessToken () {
    chrome.storage.local.get('refresh_token_time', (result) => {
        const expirationTime = result.refresh_token_valid_time * 1000;
        const timeUntilExpiration = expirationTime - Date.now() - 60000;
            
        if (timeUntilExpiration > 0)
            setTimeout(async () => {
                await chrome.windows.create({
                    url: "https://e-tsena-dropshipping.onrender.com/googleOauth20/profile",
                    type: "popup",
                    width: 400,
                    height: 500,
                    left: 200,
                    top: 150
                });
                chrome.storage.local.set({ 'isAccessTokenUpdate': true });
            }, /*timeUntilExpiration*/10000);
    });
}
