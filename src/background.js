"use strict";

const url_aeConsent = 'https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=https://e-tsena-dropshipping.onrender.com/ae_authorization/tokenAE/callback/&client_id=511504';
const url_refreshToken = 'https://e-tsena-dropshipping.onrender.com/ae_authorization/tokenAE/refreshTokenAE';
const url_getTime = 'https://e-tsena-dropshipping.onrender.com/ae_authorization/tokenAE/getExpireTime';

// Autorisation d'excécution uniquement sur Alieppress
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.includes('aliexpress.com')) {
            chrome.action.enable();
            chrome.storage.local.get('isAlreadyAuthorize', (result) => {
                if (!result.isAlreadyAuthorize)
                    generationAccessToken();
            });
        } else
            chrome.action.disable();
    });
});

// Vérification si le JWT est toujours valide
const isJWPExpired = () => {
    chrome.storage.local.get(['jwt'], (result) => {
        if (result.jwt) {
            const [token, expireTime] = result.jwt;
            console.log(`Session will end up: ${new Date(expireTime)}`);
    
            if (Date.now() >= expireTime) {
                console.log("Token is expired");
            } else
                console.log("Token is still valid");
        } else
            console.log("Token didn't find");
    });
}

// Obtention des expireTime de 'access_token' et 'refresh_token'
const generationAccessToken = async () => {
    chrome.storage.local.get(['jwt'], async (result) => {
        if (result.jwt) {
            try {
                const [token] = result.jwt;
                let user = await fetch(url_getTime, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log(`There ${JSON.stringify(user)}!`);
                if (!user.ok)
                    console.error(`HTTP error! status: ${user.status}`);

                user = await user.json();
                chrome.storage.local.set({ 'isAlreadyAuthorize': true });
                chrome.storage.local.set({ 'access_token_time': /*user.access_token_time*/ new Date().getTime() + 60 * 1000 });
                chrome.storage.local.set({ 'refresh_token_time': /*user.refresh_token_time*/ new Date().getTime() + 120 * 1000 });
            } catch (err) {
                console.error(`Error Access Token Generation: ${err}`);
            }
        } else
            console.log("Token didn't find");
    });
}

// Renouvellement automatique du token après expiration du 'access_token'
const needRefreshToken = () => {
    chrome.storage.local.get('access_token_time', (result) => {
        if (Date.now() >= result.access_token_time) {
            chrome.storage.local.get(['jwt'], async (result) => {
                if (result.jwt) {
                    const [token] = result.jwt;
                    try {
                        let user = await fetch(url_refreshToken, {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!user.ok)
                            console.error(`HTTP error! status: ${user.status}`);
                    } catch (err) {
                        console.error(`Error Refresh Token Generation: ${err}`);
                    }
                } else
                    console.log("Token didn't find");
            });
        }
    });
}

// Renouvellement manuelle du token après expiration du 'refresh_token_time'
const needNewAccessToken = () => {
    chrome.storage.local.get('refresh_token_time', (result) => {
        if (Date.now() >= result.refresh_token_time) {
            chrome.notifications.create("tokenExpired", {
                type: "basic",
                iconUrl: "./icons/48x48.png",
                title: "🔔 Autorisation à renouveller 🔔",
                message: "Nous avons besoin de votre consentement 😇.",
                buttons: [{ title: "Autoriser l'App" }]
            });
            
            chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
                if (notifId === "tokenExpired" && btnIdx === 0)
                    needAuthorization();
            });
        }
    });
}

const needAuthorization = () => {
    chrome.storage.local.get(['jwt'], (result) => {
        if (result.jwt) {
            const [token] = result.jwt;
            chrome.storage.local.remove('isAlreadyAuthorize', () => {
                if (chrome.runtime.lastError)
                    console.error(chrome.runtime.lastError);
            });
            chrome.tabs.create({ url: url_aeConsent + `&state=${token}` }, (tab) => {
                console.log(`Request for consent: ${tab}`);
            });
        } else
            alert("Vous avez besoin de vous connecter!");
    });
}

const checkTokens = () => {
    isJWPExpired();
    chrome.storage.local.get('isAlreadyAuthorize', (result) => {
        if (result.isAlreadyAuthorize) {
            needRefreshToken();
            needNewAccessToken();
        }
    });
    setTimeout(checkTokens, 1 * 60 * 1000);
};

checkTokens();
