"use strict";

// Autorisation d'excécution uniquement sur Alieppress
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.includes('aliexpress.com')) {
            chrome.action.enable();
        } else
            chrome.action.disable();
    });
});

// Renouvellement automatique du token avant expiration du 'access_token'
const generationAccessToken = async () => {
    try {
        let user = await fetch('https://e-tsena-dropshipping.onrender.com/tokenAE/getExpireTime');
        if (!user.ok)
            throw new Error(`HTTP error! status: ${user.status}`);

        user = await user.json();
        console.log(user);
        chrome.storage.local.set({ 'access_token_time': user.access_token_time });
        chrome.storage.local.set({ 'refresh_token_time': user.refresh_token_time });
    } catch (error) {
        throw Error("Error Access Token Generation: " + error);
    }

    chrome.storage.local.get('access_token_time', (result) => {
        const expirationTime = result.access_token_time * 1000;
        const timeUntilExpiration = expirationTime - Date.now() - 60000;
    
        if (timeUntilExpiration > 0)
            setTimeout(refreshAccessToken, timeUntilExpiration);
    });
}

// Renouvellement manuel du token avant expiration du 'refresh_token'
const refreshAccessToken = () => {
    chrome.storage.local.get('refresh_token_time', (result) => {
        const expirationTime = result.refresh_token_valid_time * 1000;
        const timeUntilExpiration = expirationTime - Date.now() - 60000;
            
        if (timeUntilExpiration > 0)
            setTimeout(() => {
                console.log("You need to a new access token now");
                chrome.storage.local.set({ 'isAccessTokenUpdate': true });
            }, timeUntilExpiration);
    });
}
