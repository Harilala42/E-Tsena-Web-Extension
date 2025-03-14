<script setup>
    import { ref, onMounted } from 'vue';
    import { useRouter } from 'vue-router';

    const router = useRouter();
    var doPurchaseIt = ref(false);
    var url = ref('');

    const sendLinkToServer = () => {
        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                try {
                    const { token } = result.jwt;
                    console.log(`ID Item: ${url.value}`);
                    const response = await fetch(import.meta.env.VITE_URL_INFOPRODUCT_AE, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ itemId: url.value })
                    });

                    if (!response.ok)
                        return console.error(`HTTP error! status: ${response.status}`);

                    const data = await response.json();
                    console.log(`Info's product: ${JSON.stringify(data)}`);
                } catch (error) {
                    chrome.notifications.create("failureGetItem", {
                        type: "basic",
                        iconUrl: "/icons/warning.svg",
                        title: "❌ Item found nowhere ❌",
                        message: "Le produit recherché est introuvable 😓."
                    });
                }
            }
        });
    }
</script>

<template>
    <div class="container">
        <div class="cart">
            <img src="/icons/shopping_cart.svg" alt="cart">
            <h1>Panier d'Achat</h1>
        </div>
        <div class="shopping">
            <div class="searchBar">
                <input type="text" class="urlItem" placeholder="Collez votre url ici" v-model="url">
                <button class="addItem" :disabled="doPurchaseIt" @click="sendLinkToServer">
                    <img src="/icons/paste.svg" alt="cart">
                    <p class="text">Ajouter</p>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
    @use '../style';

    .container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: style.$background-color;
        padding: 30px 0;
        min-width: 400px;
        min-height: 480px;

        .cart {
            display: flex;
            flex-direction: row;
            margin-bottom: 10px;

            img {
                width: 24px;
                height: 24px;
                margin-right: 5px;
            }

            h1 {
                font-weight: 800;
                font-size: 20px;
                font-family: style.$font-MontserratAlternates-Bold;
                color: style.$text-color;
            }
        }

        .shopping {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;

            .searchBar {
                display: flex;
                flex-direction: row;

                input {
                    width: 250px;
                    height: 30px;
                    background: style.$text-color;
                    border: none;
                    border-radius: 15px 0 0 15px;
                }

                input::placeholder {
                    color: #494444;
                    font-size: 12px;
                    font-family: style.$font-Poppins-Thin;
                    padding-left: 15px;
                }

                .addItem {
                    width: 100px;
                    height: 30px;
                    display: flex;
                    flex-direction: row;
                    justify-content: center;
                    align-items: center;
                    background-color: style.$primary-color;
                    border: 2px solid #C54412;
                    border-radius: 0 15px 15px 0;

                    img {
                        width: 16px;
                        height: 16px;
                        margin-right: 5px;
                    }

                    p {
                        font-weight: 800;
                        font-size: 12px;
                        font-family: style.$font-Poppins-Bold;
                        color: style.$text-color;
                    }

                    &:hover { cursor: pointer; }
                }
            }
        }
    }
</style>