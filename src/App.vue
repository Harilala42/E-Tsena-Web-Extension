<script setup>
    import { ref, onMounted } from 'vue';
    import { useRouter } from 'vue-router';

    const router = useRouter();
    var showAuthentication = ref(true);
    var statusAuth = ref('');

    onMounted(() => {
        chrome.storage.local.get(['isAlreadyAuthorize'], (result) => {
            checkStatusAuth(result.isAlreadyAuthorize);
            if (!showAuthentication.value)
                router.push('/shopping_cart');
        });
        chrome.storage.onChanged.addListener((details) => {
            if (details.isAlreadyAuthorize) {
                checkStatusAuth(details.isAlreadyAuthorize.newValue);     
                if (!showAuthentication.value)
                    router.push('/shopping_cart');
            }
        });
    });

    function checkStatusAuth (status) {
        if (status === 'denied') {
            statusAuth.value = 'identity';
            showAuthentication.value = true;
        } else if (status === 'no') {
            statusAuth.value = 'authorization';
            showAuthentication.value = true;
        } else
            showAuthentication.value = false;
    }

    // Début de l'authentification Oauth2.0 Google
    const authentication = async () => {
        try {
            statusAuth.value = 'load';
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
                chrome.storage.local.set({
                        'jwt': token,
                        'isAlreadyRefreshed': 'no',
                        'isAlreadyAuthorize': 'no'
                    }, () => console.log('JWT successfully stored')
                );
            } else
                console.error('JWT from server is required');
        } catch (error) {
            console.error(`Error during authentication: ${error.message}`);
        }
    };

    // Obtention d'un code de Google Server
    const getAuthorizationCode = () => {
        return new Promise((resolve, reject) => {
            let manifest = chrome.runtime.getManifest();

            let client_id = encodeURIComponent(manifest.oauth2.client_id);
            let scopes = encodeURIComponent(manifest.oauth2.scopes.join(' '));
            let redirect_uri = chrome.identity.getRedirectURL();

            const url = 'https://accounts.google.com/o/oauth2/auth' +
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
        return fetch(import.meta.env.VITE_URL_OAUTH20_GOOGLE, {
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
                chrome.tabs.update({
                        url: import.meta.env.VITE_URL_AE_AGREEMENT + `&state=${token}`
                    }, (tab) => window.close()
                );
            }
        });
    }
</script>

<template>
    <div v-if="showAuthentication" class="container">
        <img src="/icons/e-tsena_lg.png" alt="brand" class="brand">
        <div class="login">
            <img src="/icons/login.svg" alt="login">
            <h1>login</h1>
        </div>
        <div :class="{ 'disabled-customBtn': statusAuth != 'identity', 'customBtn': statusAuth == 'identity' }" @click="authentication">
            <span class="icon" id="google"></span>
            <span class="btnText">
                {{ statusAuth == 'load' ? 'Connexion en cours...' : 'Se connecter avec Google' }}
            </span>
            <span v-if="statusAuth == 'load'" class="spinner"></span>
        </div>
        <div :class="{ 'disabled-customBtn': statusAuth != 'authorization', 'customBtn': statusAuth == 'authorization' }" @click="authorization">
            <span class="icon" id="aliexpress"></span>
            <span class="btnText">Autoriser l'extension web</span>
        </div>
        <p class="slogan">Aliexpress à portée de <span class="cta">clic</span>!</p>
    </div>
    <router-view v-else/>
</template>

<style scoped lang="scss">
    @use 'style';

    .container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: style.$background-color;
        padding: 30px 0;
        min-width: 400px;
        min-height: 480px;

        .brand {
            width: 250px;
            height: 150px;
        }

        .login {
            display: flex;
            flex-direction: row;
            margin-bottom: 21px;

            img {
                width: 35px;
                height: 42px;
            }

            h1 {
                font-weight: 800;
                font-size: 35px;
                font-family: style.$font-MontserratAlternates-Thin;
                color: style.$text-color;
            }
        }

        @mixin shared-customBtn-style {
            display: flex;
            flex-direction: row;
            align-items: center;
            background-color: style.$secondary-color;
            color: style.$text-color;
            width: 300px;
            height: 50px;
            margin-bottom: 21px;
            padding-left: 20px;
            border-radius: 50px;
            border: thin solid style.$text-color;
            box-shadow: 1px 1px 1px grey;
            transition: all 1.5ms ease-out;

            .icon {
                width: 50px;
                height: 50px;
            }

            .btnText {
                padding-left: 5px;
                font-size: 14px;
                font-weight: bold;
                font-family: style.$font-Roboto;
            }

            .spinner {
                border: 2px solid #f3f3f3;
                border-top: 2px solid #3498db;
                border-radius: 50%;
                width: 16px;
                height: 16px;
                animation: spin 1s linear infinite;
                margin-left: 10px;
            }

            #google { background: url('/icons/google_lg.svg') transparent 5px 50% no-repeat; }
            #aliexpress { background: url('/icons/aliexpress_lg.svg') transparent 5px 50% no-repeat; }
        }


        .customBtn {
            @include shared-customBtn-style;
            
            &:hover {
                cursor: pointer;
                transform: scale(1.05);
            }
        }

        .disabled-customBtn {
            @include shared-customBtn-style;
            pointer-events: none;
            opacity: 0.5;
            cursor: not-allowed;
        }

        .slogan {
            font-weight: 1000;
            font-size: 20px;
            font-family: style.$font-MontserratAlternates-Bold;
            color: style.$text-color;

            .cta { color: style.$primary-color; }
        }
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>