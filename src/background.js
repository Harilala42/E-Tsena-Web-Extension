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
        chrome.storage.local.set({ 'isAlreadyAuthorize': 'denied' }, () => {
            setTimeout(() => {
                chrome.tabs.create({ url: "https://fr.aliexpress.com/" });
            }, 2000);
        });
    } else if (details.reason === "update")
        console.log("Extension updated");
    else if (details.reason === "chrome_update")
        console.log("Chrome update detected");
});

chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
    if (notifId === "requestToken" && btnIdx === 0) {
        chrome.storage.local.get(['jwt'], (result) => {
            if (result.jwt) {
                const { token } = result.jwt;
                chrome.tabs.create({ url: import.meta.env.VITE_URL_AE_AGREEMENT + `&state=${token}` });
            }
        });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tokenCheck')
        checkTokens();
    else if (alarm.name === 'updateCart') {
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

const isJWTRefreshed = async (tokenJWT, retryCount = 0) => {
    const { token, expireTime, userInfo } = tokenJWT;

    if (retryCount > 5) {
        chrome.storage.local.remove('jwt');
        chrome.storage.local.set({ 'isAlreadyAuthorize': 'denied' });
        console.error("❌ Max Retry attempts reached.");

        return (chrome.notifications.create("failureAuth", {
            type: "basic",
            iconUrl: "/icons/48x48.png",
            title: "⚠️ Recurring connection issue ⚠️",
            message: "Impossible de rafraîchir la session. Vérifiez votre connexion ou reconnectez-vous!"
        }), true);
    }

    if (Date.now() >= expireTime - 3600000) {
        try {
            const res = await fetch(import.meta.env.VITE_URL_REFRESFTOKEN_JWT, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

            const data = await res.json();
            if (data.new_token) {
                const newToken = {
                    token: data.new_token,
                    expireTime: new Date().getTime() + data.expireTime * 1000,
                    userInfo
                };
                chrome.storage.local.set({ 'jwt': newToken });
                return (console.log('JWT successfully refreshed'), true);
            }
        } catch (err) {
            console.error(`Failed to refresh JWT Token: ${err}`);
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            console.log(`🔄 Retrying in ${delay / 1000}s.`);
            setTimeout(() => isJWTRefreshed(tokenJWT, retryCount + 1), delay);
        }
    }
    return (false);
}

const generateAEToken = async (tokenJWT) => {
    try {
        const { token } = tokenJWT;

        const res = await fetch(import.meta.env.VITE_URL_GETEXPIRETIME, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        if (data?.access_token_time > 0 && data?.refresh_token_time > 0) {
            chrome.storage.local.set({
                'isAlreadyAuthorize': 'yes',
                'access_token_time': data.access_token_time,
                'refresh_token_time': data.refresh_token_time
            });
        }
    } catch (err) {
        console.error(`Failed to generate AE Token: ${err}`);
    }
}

const refreshAEToken = (tokenJWT, retryCount = 0) => {
    if (retryCount > 5) {
        chrome.storage.local.set({ 'isAlreadyAuthorize': 'no' });
        console.error("❌ Max Retry attempts reached.");

        return chrome.notifications.create("requestToken", {
            type: "basic",
            iconUrl: "/icons/warning.svg",
            title: "⚠️ Recurring connection issue ⚠️",
            message: "Impossible de rafraîchir la session. Vérifiez votre autorisation!",
            buttons: [{ title: "Autoriser l'App" }]
        });
    }

    chrome.storage.local.get(['access_token_time'], async (result) => {
        const { token } = tokenJWT;

        if (Date.now() >= result.access_token_time) {
            try {
                const res = await fetch(import.meta.env.VITE_URL_REFRESFTOKEN_AE, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

                chrome.storage.local.set({ 'isAlreadyAuthorize': 'refresh' });
            } catch(err) {
                console.error(`Failed to refresh AE Token: ${err}`);
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                console.log(`🔄 Retrying in ${delay / 1000}s.`);
                setTimeout(() => refreshAEToken(tokenJWT, retryCount + 1), delay);
            }
        }
    });
}

const requestAEToken = () => {
    chrome.storage.local.get(['refresh_token_time'], (result) => {
        if (Date.now() >= result.refresh_token_time) {
            chrome.notifications.create("requestToken", {
                type: "basic",
                iconUrl: "/icons/48x48.png",
                title: "🔔 Autorisation à renouveller 🔔",
                message: "Nous avons besoin de votre consentement 😇.",
                buttons: [{ title: "Autoriser l'App" }]
            });
            chrome.storage.local.set({ 'isAlreadyAuthorize': 'no' });
        }
    });
}

const checkTokens = () => {
    chrome.storage.local.get(['jwt', 'isAlreadyAuthorize'], async (result) => {
        const tokenJWT = result.jwt;
        if (!tokenJWT) return console.warn("Token didn't find");
        console.log(`Session will end up at ${new Date(tokenJWT.expireTime)}`);

        if (Date.now() >= tokenJWT.expireTime) {
            chrome.storage.local.remove('jwt');
            chrome.storage.local.set({ 'isAlreadyAuthorize': 'denied' });
            return console.warn('Token is expired');
        }

        if (await isJWTRefreshed(tokenJWT)) return;

        switch (result.isAlreadyAuthorize) {
            case 'no':
                await generateAEToken(tokenJWT);
            break;
            case 'yes':
                refreshAEToken(tokenJWT);
            break;
            default:
                requestAEToken(tokenJWT);
            break;
        }
    });
};

chrome.alarms.create('updateCart', { periodInMinutes: 15 });
chrome.alarms.create('tokenCheck', { periodInMinutes: 10 });
