"use strict";

chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.includes('https://fr.aliexpress.com/')) {
            checkTokens();
            chrome.action.enable();
        } else
            chrome.action.disable();
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url && tab.url.includes('https://fr.aliexpress.com/')) {
        checkTokens();
        chrome.action.enable();
    } else
        chrome.action.disable();
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
                chrome.tabs.create({ url: import.meta.env.VITE_URL_AE_AGREEMENT + `&state=${token}` });
            }
        });
    }
});

// Mise à jour des informations du 'shopping cart'
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateCart') {
        chrome.storage.local.get(['cart', 'jwt'], async (result) => {
            if (result.cart && result.jwt) {
                const { token } = result.jwt;
                const cartData = await JSON.parse(result.cart);
                
                const updatePromises = cartData.map(async (item, id) => {
                    try {
                        const response = await fetch(import.meta.env.VITE_URL_INFOPRODUCT_AE, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ itemId: item.item_id })
                        });

                        if (!response.ok)
                            return console.error(`HTTP error! status: ${response.status}`);

                        const data = await response.json();

                        const updatedItem = data.info.aliexpress_ds_product_get_response.result;
                        const skusInfo = updatedItem.ae_item_sku_info_dtos.ae_item_sku_info_d_t_o;
                        const price = parseFloat(skusInfo[item.selectedSkuIndex].sku_price);
                        const sale_price = parseFloat(skusInfo[item.selectedSkuIndex].offer_sale_price);
                        const stock = parseInt(skusInfo[item.selectedSkuIndex].sku_available_stock);

                        if (stock <= 0) {
                            cartData.splice(id, 1);
                        } else {
                            item.order_model = {
                                price: price,
                                sale_price: sale_price,
                                is_on_sale: sale_price < price,
                                currentStock: stock
                            };
                        }
                    } catch (error) {
                        console.error(`Failed to update item ${item.item_id}:`, error);
                    }
                });

                await Promise.all(updatePromises);
                await chrome.storage.local.set({ cart: JSON.stringify(cartData) });
            }
        });
    }
});

// Vérification si le JWT a besoin d'un refresh
const isJWPRefreshed = async () => {
    chrome.storage.local.get(['jwt'], async (result) => {
        if (result.jwt) {
            const { token, expireTime } = result.jwt;
            console.log(`Session will end up: ${new Date(expireTime)}`);
    
            const deadline = 24 * 60 * 60 * 1000; // Delai de 24H avant expiration
            if (Date.now() >= expireTime - deadline) {
                try {
                    let user = await fetch(import.meta.env.VITE_URL_REFRESFTOKEN_JWT, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!user.ok)
                        return console.error(`HTTP error! status: ${user.status}`);

                    const data = await user.json();
                    if (data.new_token) {
                        const token = {
                            token: data.new_token,
                            expireTime: new Date().getTime() + data.expireTime * 1000
                        };
                        chrome.storage.local.set({
                                'jwt': token,
                                'isAlreadyRefreshed': 'yes'
                            }, () => console.log('JWT successfully refreshed')
                        );
                    } else
                        console.error('JWT from server is required');
                } catch (err) {
                    console.error(`Error Refresh Token JWT Generation: ${err}`);
                }
            } else
                console.log("Token is still valid");
        }
    });
}

// Vérification si le JWT est toujours valide
const isJWPExpired = async () => {
    chrome.storage.local.get(['jwt'], (result) => {
        if (result.jwt) {
            const { expireTime } = result.jwt;
            console.log(`New Session will end up: ${new Date(expireTime)}`);
    
            if (Date.now() >= expireTime) {
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
                let user = await fetch(import.meta.env.VITE_URL_GETEXPIRETIME, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!user.ok && user.status === 401)
                    return console.warn('User have to authorize the app');
                else if (!user.ok)
                    return console.error(`HTTP error! status: ${user.status}`);

                user = await user.json();
                chrome.storage.local.set({
                    'isAlreadyAuthorize': 'yes',
                    'access_token_time': user.access_token_time,
                    'refresh_token_time': user.refresh_token_time
                });
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
                        let user = await fetch(import.meta.env.VITE_URL_REFRESFTOKEN_AE, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!user.ok)
                            return console.error(`HTTP error! status: ${user.status}`);
                        chrome.storage.local.set({ 'isAlreadyAuthorize': 'refresh' });
                    } catch (err) {
                        console.error(`Error Refresh Token AE Generation: ${err}`);
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
const checkTokens = () => {
    chrome.storage.local.get(['isAlreadyRefreshed', 'isAlreadyAuthorize'],
        async (result) => {
            if (result.isAlreadyRefreshed === 'no')
                await isJWPRefreshed();
            else if (result.isAlreadyRefreshed === 'yes')
                await isJWPExpired();

            switch (result.isAlreadyAuthorize) {
                case 'denied':
                    return console.warn("Token didn't find");
                case 'no':
                    await generationAccessToken();
                break;
                case 'yes':
                    await needRefreshToken();
                break;
                case 'refresh':
                    await needNewAccessToken();
                break;
                default:
                    console.error('Invalid value');
            }
        }
    );
};

chrome.alarms.create('updateCart', { periodInMinutes: 15 });
setInterval(checkTokens, 5 * 60 * 1000);
