<script setup>
    import { ref, onMounted } from 'vue';

    const picture = ref('');
    const state = ref('');

    onMounted(() => {
        chrome.storage.onChanged.addListener((details) => {
            if (details.e_tsena_state)
                state.value = details.e_tsena_state.newValue;
        });

        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                const { token, userInfo } = result.jwt;
                picture.value = userInfo.picture;
            }
        });
    });

    const close_popup = () => window.close();
</script>

<template>
    <header>
        <div class="logo">
            <img src="/icons/e-tsena_lg_h.png" alt="logo e-tsena">
        </div>
        <nav>
            <router-link class="icon" v-if="state === 'shopping-cart' || state === 'order-tracking'" to="/profile">
                <div class="profile" v-if="picture"
                    :style="{ 'background-image': picture ? `url('${picture}')` : 'none' }"
                ></div>
                <img src="/icons/person.svg" v-else alt="profile">
            </router-link>
            <router-link class="icon" v-if="state === 'order-tracking' || state === 'profile'" to="/shopping_cart">
                <img src="/icons/shopping_bag.svg" alt="shopping">
            </router-link>
            <router-link class="icon" v-if="state === 'shopping-cart' || state === 'profile'" to="/order_tracking">
                <img src="/icons/truck.svg" alt="tracking">
            </router-link>
            <button class="icon"
                v-if="state !== 'checkout'"
                @click="close_popup"
            >
                <img src="/icons/close.svg" alt="close">
            </button>
            <router-link v-else class="icon" to="/shopping_cart">
                <img src="/icons/right.svg" alt="right">
            </router-link>
        </nav>
    </header>
    <main>
        <slot />
    </main>
    <footer>
        <div class="icon_social">
            <a href="" target="blank"><img src="/icons/facebook.svg" alt="facebook"></a>
            <a href="" target="blank"><img src="/icons/whatsapp.svg" alt="whatsapp"></a>
        </div>
        <div class="footer-bar"></div>
    </footer>
</template>

<style scoped lang="scss">
    @use '../style';

    header {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        grid-area: header;
        padding: 0 25px;

        .logo {
            display: flex;
            justify-content: center;
            align-items: center;

            img {
                width: 125px;
                height: 20px;
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }
        }

        nav {
            display: flex;
            flex-direction: row;
            gap: 15px;

            .icon {
                width: 24px;
                height: 24px;
                cursor: pointer;

                .profile {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                }
            }

            button {
                width: 24px;
                height: 24px;
                border: none;
                background-color: transparent;
            }
        }
    }

    main {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        grid-area: main;
    }

    footer {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        grid-area: footer;
        
        .icon_social {
            display: flex;
            flex-direction: row;
            position: absolute;
            justify-content: center;
            background-color: style.$background-color;
            width: 80px;
            height: 30px;
            z-index: 1;
            gap: 10px;

            a img {
                width: 24px;
                height: 24px;

                &:hover { cursor: pointer; }
            }
        }

        .footer-bar {
            width: 350px;
            height: 1px;
            background-color: style.$text-color;
            margin-bottom: 5px;
        }
    }
</style>