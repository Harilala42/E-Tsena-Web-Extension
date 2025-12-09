<script setup>
    import { ref, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import Layout from './layouts/layout.vue';

    const router = useRouter();
    
    const showAuthentication = ref(true);
    const statusAuth = ref('');

    onMounted(() => {
        chrome.storage.local.set({ 'e_tsena_state': '' });

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

    const checkStatusAuth = (status) => {
        if (status === 'denied') {
            statusAuth.value = 'identity';
            showAuthentication.value = true;
        } else if (status === 'no') {
            statusAuth.value = 'authorization';
            showAuthentication.value = true;
        } else
            showAuthentication.value = false;
    }

    const authentication = async () => {
        try {
            statusAuth.value = 'load';
            const data = await getJWTAuthentication();
            const token = {
                token: data.token,
                expireTime: new Date().getTime() + data.expireTime * 1000,
                userInfo: data.userInfo
            };

            chrome.storage.local.set({
                'jwt': token,
                'isAlreadyAuthorize': 'no'
            });
            chrome.notifications.create("successAuth", {
                type: "basic",
                iconUrl: "/icons/check_circle.svg",
                title: "✅ Successful Google Authentication ✅",
                message: `Bienvenue ${token.userInfo.name} 😄.`
            });
        } catch (error) {
            statusAuth.value = 'identity';
            console.error('Error Authentication: ', error);
            chrome.notifications.create("failureAuth", {
                type: "basic",
                iconUrl: "/icons/warning.svg",
                title: "❌ Failed Google Authentication ❌",
                message: "Un problème est survenu lors de l'authentification 😓."
            });
        }
    };

    const getJWTAuthentication = () => {
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
                async (redirect_uri) => {
                    if (chrome.runtime.lastError) reject(`Error getting code: ${chrome.runtime.lastError.message}`);

                    const url = new URL(redirect_uri);
                    const code = url.searchParams.get('code');

                    if (code) {
                        try {
                            const res = await fetch(import.meta.env.VITE_URL_OAUTH20_GOOGLE, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code: code })
                            });
                            if (!res.ok) reject(`HTTP error! status: ${res.status}`);
                            const authData = await res.json();

                            resolve(authData);
                        } catch(err) {
                            reject(`Error fetching JWT: ${err.message}`);
                        }
                    } else {
                        reject('No code returned from Google');
                    }
                }
            );
        });
    };

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
    <div v-if="showAuthentication" class="auth">
        <img src="/icons/e-tsena_lg_v.png" alt="brand" class="brand">
        <div class="login">
            <img src="/icons/login.svg" alt="login">
            <h1>Connexion</h1>
        </div>
        <button @click="authentication"
            :class="{ 'disabled-customBtn': statusAuth != 'identity', 'customBtn': statusAuth == 'identity' }"
        >
            <span class="icon" id="google"></span>
            <span class="btnText">
                {{ statusAuth == 'load' ? 'Connexion en cours...' : 'Se connecter avec Google' }}
            </span>
            <span v-if="statusAuth == 'load'" class="spinner"></span>
        </button>
        <button @click="authorization"
            :class="{ 'disabled-customBtn': statusAuth != 'authorization', 'customBtn': statusAuth == 'authorization' }"
        >
            <span class="icon" id="aliexpress"></span>
            <span class="btnText">Autoriser l'extension web</span>
        </button>
        <p class="slogan">AliExpress à portée de <span class="cta">clic</span>!</p>
    </div>
    <div class="container" v-else>
        <Layout>
            <router-view />
        </Layout>
    </div>
</template>

<style scoped lang="scss">
    @use 'style';

    .container {
        width: 400px;
        height: 600px;
        position: relative;
        background-color: style.$background-color;
    
        display: grid;
        grid-template-columns: 150px 1fr 150px;
        grid-template-rows: 50px 1fr 50px;
        grid-template-areas:
            "header header header"
            "main    main   main"
            "footer footer footer";
    }

    .auth {
        width: 400px;
        height: 500px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 30px 0;

        .brand {
            width: 250px;
            height: 150px;
        }

        .login {
            display: flex;
            flex-direction: row;
            margin-bottom: 21px;
            gap: 5px;

            img {
                width: 35px;
                height: 42px;
            }

            h1 {
                font-size: 35px;
                font-weight: bold;
                font-family: style.$font-MontserratAlternates-Regular;
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
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>