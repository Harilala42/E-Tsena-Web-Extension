"use strict";

const url_aeConsent = 'https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=https://e-tsena-dropshipping.onrender.com/ae_authorization/tokenAE/callback/&client_id=511504';
const url_refreshToken = 'https://e-tsena-dropshipping.onrender.com/ae_authorization/tokenAE/refreshTokenAE';
const url_getTime = 'https://e-tsena-dropshipping.onrender.com/ae_authorization/tokenAE/getExpireTime';

chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.includes('aliexpress.com'))
            chrome.action.enable();
        else
            chrome.action.disable();
    });
});

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        console.log("Extension installed");
        chrome.storage.local.set({ 'isAlreadyAuthorize': 'denied' });
    } else if (details.reason === "update")
        console.log("Extension updated");
    else if (details.reason === "chrome_update")
        console.log("Chrome update detected");
});

chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
    if (notifId === "tokenExpired" && btnIdx === 0) {
        chrome.storage.local.get(['jwt'], (result) => {
            if (result.jwt) {
                const { token } = result.jwt;
                chrome.tabs.create({ url: url_aeConsent + `&state=${token}` }, (tab) => {
                    chrome.action.disable();
                });
            }
        });
    }
});

// Vérification si le JWT est toujours valide
const isJWPExpired = async () => {
    chrome.storage.local.get(['jwt'], (result) => {
        if (result.jwt) {
            const { expireTime } = result.jwt;
            console.log(`Session will end up: ${new Date(expireTime)}`);
    
            if (Date.now() >= expireTime) {
                // Besoin de l'ajout d'un système de refresh_token
                chrome.storage.local.remove('jwt', () => {
                    if (chrome.runtime.lastError)
                        console.error(chrome.runtime.lastError);
                    chrome.storage.local.set({ 'isAlreadyAuthorize': 'denied' });
                });
                console.log("Token is expired");
            } else
                console.log("Token is still valid");
        }
    });
}

// Obtention des expireTime de 'access_token' et 'refresh_token'
const generationAccessToken = async () => {
    chrome.storage.local.get(['jwt'], async (result) => {
        if (result.jwt) {
            try {
                const { token } = result.jwt;
                let user = await fetch(url_getTime, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!user.ok)
                    return console.error(`HTTP error! status: ${user.status}`);

                user = await user.json();
                if (user.access_token_time > 0) {
                    chrome.storage.local.set({
                        'isAlreadyAuthorize': 'yes',
                        'access_token_time': user.access_token_time,
                        'refresh_token_time': user.refresh_token_time
                    });
                }
            } catch (err) {
                console.error(`Error Access Token Generation: ${err}`);
            }
        }
    });
}

// Renouvellement automatique du token après expiration du 'access_token'
const needRefreshToken = async () => {
    chrome.storage.local.get(['access_token_time'], (result) => {
        if (Date.now() >= result.access_token_time) {
            chrome.storage.local.get(['jwt'], async (result) => {
                if (result.jwt) {
                    const { token } = result.jwt;
                    try {
                        let user = await fetch(url_refreshToken, {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!user.ok)
                            return console.error(`HTTP error! status: ${user.status}`);
                        chrome.storage.local.set({ 'isAlreadyAuthorize': 'refresh' });
                    } catch (err) {
                        console.error(`Error Refresh Token Generation: ${err}`);
                    }
                }
            });
        }
    });
}

// Renouvellement manuelle du token après expiration du 'refresh_token'
const needNewAccessToken = async () => {
    chrome.storage.local.get(['refresh_token_time'], (result) => {
        if (Date.now() >= result.refresh_token_time) {
            chrome.notifications.create("tokenExpired", {
                type: "basic",
                iconUrl: "./icons/48x48.png",
                title: "🔔 Autorisation à renouveller 🔔",
                message: "Nous avons besoin de votre consentement 😇.",
                buttons: [{ title: "Autoriser l'App" }]
            });
            chrome.storage.local.set({ 'isAlreadyAuthorize': 'no' });
        }
    });
}

// Cycle de vie d'un token JWT
const checkTokens = async () => {
    await isJWPExpired();
    chrome.storage.local.get('isAlreadyAuthorize', async (result) => {
        if (result.isAlreadyAuthorize === 'denied')
            return console.warn("Token didn't find");
        else if (result.isAlreadyAuthorize === 'no')
            await generationAccessToken();
        else if (result.isAlreadyAuthorize === 'yes')
            await needRefreshToken();
        else if (result.isAlreadyAuthorize === 'refresh')
            await needNewAccessToken();
    });
};

setInterval(checkTokens, 1 * 60 * 1000);