<script setup>
    import { ref } from 'vue';

    const url_oauth20Google = 'https://e-tsena-dropshipping.onrender.com/googleOauth20/auth/google';
    const url_aeConsent = 'https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=https://e-tsena-dropshipping.onrender.com/ae_authorization/tokenAE/callback/&client_id=511504';

    // Obtention d'un token pour l'envoyer au server
    const authentication = async () => {
        try {
            const token = await getAuthToken();

            let response = await sendTokenToServer(token);

            if (response.status === 401) {
                console.warn("Token expired. Attempt to refresh...");
                const newToken = await refreshAuthToken(token);
                let newResponse = await sendTokenToServer(newToken);
                response = newResponse;
            }
            
            if (!response.ok) {
                console.error(`Error HTTP! Status: ${response.status}`);
            } else {
                const data = await response.json();
                console.log(`Result's request: ${data.message}`);
            }
        } catch (error) {
            console.error(`Error during authentication: ${error.message}`);
        }
    };

    const getAuthToken = () => {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError || !token)
                    reject(`Error getting token: ${chrome.runtime.lastError?.message || 'Unknown error'}`);
                else
                    resolve(token);
            });
        });
    };

    const refreshAuthToken = (token) => {
        return new Promise((resolve, reject) => {
            chrome.identity.removeCachedAuthToken({ token }, () => {
                chrome.identity.getAuthToken({ interactive: true }, (newToken) => {
                    if (chrome.runtime.lastError || !newToken)
                        reject(`Error getting new token: ${chrome.runtime.lastError?.message || 'Unknown error'}`);
                    else
                        resolve(newToken);
                });
            });
        });
    };

    const sendTokenToServer = (token) => {
        return fetch(url_oauth20Google, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    };

    const authorization = async () => {
        // chrome.tabs.create({ url: url_aeConsent }, (tab) => {
        //     console.log('Nouvel onglet ouvert', tab);
        // });
        try {
            let user = await fetch('https://e-tsena-dropshipping.onrender.com/ae_authorization/tokenAE/getExpireTime');
            if (!user.ok)
                throw new Error(`HTTP error! status: ${user.status}`);

            user = await user.json();
            console.log(user);
            chrome.storage.local.set({ 'access_token_time': user.access_token_time });
            chrome.storage.local.set({ 'refresh_token_time': user.refresh_token_time });
        } catch (error) {
            throw Error("Error Access Token Generation: " + error);
        }
    }
</script>

<template>
    <div class="customBtn" @click="authentication">
        <span class="icon" id="google"></span>
        <span class="buttonText">Sign in with Google</span>
    </div>
    <div class="customBtn" @click="authorization">
        <span class="icon" id="aliexpress"></span>
        <span class="buttonText">Autoriser l'App</span>
    </div>
</template>

<style scoped>
    .customBtn {
        display: inline-block;
        background: white;
        color: #444;
        width: 190px;
        border-radius: 5px;
        border: thin solid #888;
        box-shadow: 1px 1px 1px grey;
        white-space: nowrap;
    }
    .customBtn:hover {
        cursor: pointer;
    }
    span.icon {
        background: url('/icons/google_lg.svg') transparent 5px 50% no-repeat;
        display: inline-block;
        vertical-align: middle;
        width: 50px;
        height: 50px;
    }
    span.buttonText {
        display: inline-block;
        vertical-align: middle;
        padding-left: 5px;
        font-size: 14px;
        font-weight: bold;
        font-family: 'Roboto', sans-serif;
    }
    #google{
        background: url('/icons/google_lg.svg') transparent 5px 50% no-repeat;
    }
    #aliexpress {
        background: url('/icons/aliexpress_lg.svg') transparent 5px 50% no-repeat;
    }
</style>