<script setup>
    import { ref } from 'vue';

    const url_oauth20Google = 'https://e-tsena-dropshipping.onrender.com/googleOauth20/auth/google';
    const url_aeConsent = 'https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=https://e-tsena-dropshipping.onrender.com/ae_authorization/tokenAE/callback/&client_id=511504';

    // Début de l'authentification Oauth2.0 Google
    const authentication = async () => {
        try {
            const code = await getAuthorizationCode();

            const response = await sendCodeToServer(code);
            if (!response.ok)
                console.error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.token)
                chrome.storage.local.set({ 'jwt': data.token }, () => {
                    console.log("JWT successfully stored");
                });
            else
                console.error('JWT from server is required');
        } catch (error) {
            console.error(`Error during authentication: ${error.message}`);
        }
    };

    // Obtention d'un code de Google Server
    const getAuthorizationCode = () => {
        return new Promise((resolve, reject) => {
            var manifest = chrome.runtime.getManifest();

            var client_id = encodeURIComponent(manifest.oauth2.client_id);
            var scopes = encodeURIComponent(manifest.oauth2.scopes.join(' '));
            var redirect_uri = chrome.identity.getRedirectURL();

            var url = 'https://accounts.google.com/o/oauth2/auth' +
                '?client_id=' + client_id +
                '&response_type=code' +
                '&access_type=offline' +
                '&redirect_uri=' + redirect_uri +
                '&scope=' + scopes;

            chrome.identity.launchWebAuthFlow(
                { url: url, interactive: true },
                (redirect_uri) => {
                    if (chrome.runtime.lastError)
                        reject(`Error getting code: ${chrome.runtime.lastError.message}`);

                    const urlParams = new URLSearchParams(new URL(redirect_uri).search);
                    const authorizationCode = urlParams.get("code");
                    resolve(authorizationCode);
                }
            );
        });
    };

    // Envoie du code vers le server
    const sendCodeToServer = (code) => {
        return fetch(url_oauth20Google, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });
    };

    // Authorisation par l'utilisateur sur AE Open Platform
    const authorization = async () => {
        chrome.tabs.create({ url: url_aeConsent }, (tab) => {
            console.log(`Request for consent: ${tab}`);
        });
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