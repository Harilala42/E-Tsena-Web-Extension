<script setup>
    import { ref, computed } from 'vue';
    import { useRouter } from 'vue-router';

    const router = useRouter();
    var selectedItems = ref([]);
    var purchaseIt = ref(false);
    var url = ref('');

    const truncatedUrl = computed(() => {
        return url.value.length > 20 ? url.value.substring(0, 30) : url.value;
    });

    // Obtention des informations du Product AE
    const getProductInfo = async () => {
        try {
            const itemId = await extractItemID(url.value);
            console.log(`ID Item: ${itemId}`);

            const response = await sendIdToServer(itemId);
            if (!response.ok)
                return console.error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const item = data.info.aliexpress_ds_product_get_response.result;

            const skuInfo = item.ae_item_sku_info_dtos.ae_item_sku_info_d_t_o[0];
            const imageUrls = item.ae_multimedia_info_dto.image_urls.split(';');

            selectedItems.value.push({
                item_id: itemId,
                price: skuInfo.sku_price,
                img_url: imageUrls[0],
                details: item.ae_item_base_info_dto.subject,
                rates: item.ae_item_base_info_dto.avg_evaluation_rating,
                sale_price: skuInfo.offer_sale_price,
                is_on_sale: skuInfo.offer_sale_price !== skuInfo.sku_price
            });

            console.log(`Info's product: ${JSON.stringify(selectedItems.value[0])}`);
            url.value = '';
        } catch (error) {
            url.value = '';
            chrome.notifications.create("failureGetItem", {
                type: "basic",
                iconUrl: "/icons/warning.svg",
                title: "❌ Item found nowhere ❌",
                message: "Le produit recherché est introuvable 😓."
            });
        }
    }

    // Extraction du itemID de l'URL
    const extractItemID = (url) => {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);

            const allowedDomains = ['fr.aliexpress.com', 'www.aliexpress.com'];
            if (!allowedDomains.includes(parsedUrl.hostname))
                reject('Invalid domain! Please provide a valid AliExpress URL');

            const path = parsedUrl.pathname;
            const match = path.match(/\/item\/(\d+)\.html/);

            if (match && match[1])
                resolve(match[1]);
            
            reject('No ID item found in the url');
        });
    };

    // Envoie du itemId vers le server
    const sendIdToServer = (itemId) => {
        return new Promise((resolve) => {
            chrome.storage.local.get(['jwt'], async (result) => {
                if (result.jwt) {
                    const { token } = result.jwt;

                    resolve(fetch(import.meta.env.VITE_URL_INFOPRODUCT_AE, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ itemId: itemId })
                    }));
                }
            });
        });
    };
</script>

<template>
    <div class="container">
        <div class="title">
            <img src="/icons/shopping_cart.svg" alt="cart">
            <h1>Panier d'Achat</h1>
        </div>
        <div class="cart">
            <div class="searchBar">
                <input type="text" placeholder="Collez votre url ici" v-model="url" :value="truncatedUrl">
                <div class="btnSearch">
                    <img src="/icons/close_search.svg" v-if="url !== ''" alt="cart" @click="url = ''">
                    <button class="addItem" :disabled="purchaseIt" @click="getProductInfo">
                        <img src="/icons/paste.svg" alt="cart"><p>Ajouter</p>
                    </button>
                </div>
            </div>
            <div class="chooseProduct">
                <div class="item"></div>
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

        .title {
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

        .cart {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;

            .searchBar {
                display: flex;
                flex-direction: row;
                align-items: center;
                background: style.$text-color;
                justify-content: space-evenly;
                border-radius: 15px;
                border: none;
                width: 350px;
                height: 30px;

                input[type="text"] {
                    width: 200px;
                    height: 30px;
                    border: none;
                    border-radius: 15px 0 0 15px;
                    background-color: transparent;
                    padding-left: 15px;

                    &::placeholder {
                        color: style.$secondary-color;
                        font-size: 12px;
                        font-family: style.$font-Poppins-Thin;
                    }

                    &:focus {
                        outline: none;
                        border: none;
                        box-shadow: none;
                    }
                }

                .btnSearch {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: flex-end;
                    margin-right: 1px;
                    width: 150px;

                    img:first-child:hover { cursor: pointer; }

                    .addItem {
                        width: 100px;
                        height: 28px;
                        display: flex;
                        flex-direction: row;
                        justify-content: center;
                        align-items: center;
                        background-color: style.$primary-color;
                        border-radius: 15px;
                        border: none;

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
    }
</style>