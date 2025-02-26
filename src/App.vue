<script setup>
    import { ref, onMounted, watch } from 'vue';
    import { useRouter } from 'vue-router';

    const router = useRouter();
    const showAuthentication = ref(false);
    const url_oauth20Google = 'https://e-tsena-dropshipping.onrender.com/googleOauth20/auth/google';
    const url_aeConsent = 'https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=https://e-tsena-dropshipping.onrender.com/ae_authorization/tokenAE/callback/&client_id=511504';

    onMounted(() => {
        chrome.storage.local.get(['isAlreadyAuthorize'], (result) => {
            showAuthentication.value = (result.isAlreadyAuthorize == 'no' || result.isAlreadyAuthorize == 'denied')? true : false;
        });
        chrome.storage.onChanged.addListener((details) => {
            if (details.isAlreadyAuthorize)
                showAuthentication.value = (details.isAlreadyAuthorize == 'no' || details.isAlreadyAuthorize == 'denied')? true : false;
        });
    });

    watch(showAuthentication, (newValue, oldValue) => {
        if (!newValue)
            router.push('/shopping_cart');
    });

    // Début de l'authentification Oauth2.0 Google
    const authentication = async () => {
        try {
            const code = await getAuthorizationCode();

            const response = await sendCodeToServer(code);
            if (!response.ok)
                console.error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.token) {
                const token = {
                    token: data.token,
                    expireTime: new Date().getTime() + data.expireTime * 1000
                };
                chrome.storage.local.set({ 'jwt': token }, () => {
                    console.log('JWT successfully stored');
                });
            } else
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

    // Autorisation par l'utilisateur sur AE Open Platform
    const authorization = async () => {
        chrome.storage.local.get(['jwt'], (result) => {
            if (result.jwt) {
                const { token } = result.jwt;
                chrome.storage.local.set({ 'isAlreadyAuthorize': 'no' });
                chrome.tabs.update({ url: url_aeConsent + `&state=${token}` }, (tab) => {
                    window.close();
                    chrome.action.disable();
                });
            }
        });
    }
</script>

<template>
    <div v-if="showAuthentication" class="container">
        <h1>Log in</h1>
        <div class="customBtn" @click="authentication">
            <span class="icon" id="google"></span>
            <span class="buttonText">Sign in with Google</span>
        </div>
        <div class="customBtn" @click="authorization">
            <span class="icon" id="aliexpress"></span>
            <span class="buttonText">Autoriser l'App</span>
        </div>
        <p>Aliexpress à portée de clic</p>
    </div>
</template>

<style scoped lang="scss">
    $background-color: #3A003D;
    $text-color: #FFFFFF;
    $primary-color: #FF5A19;
    $secondary-color: #191919;

    @font-face {
        font-family: 'MontserratAlternates';
        src: url('./fonts/MontserratAlternates-Thin.tff') format('truetype');
    }

    @font-face {
        font-family: 'Roboto';
        src: url('./fonts/Roboto.tff') format('truetype');
    }

    .container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 400px;
        height: 480px;

        h1 {
            font-family: 'MontserratAlternates', sans-serif;
        }
    }
</style>