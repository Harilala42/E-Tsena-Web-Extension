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
            const url_buffer = url.value;
            const itemId = await extractItemID(url_buffer);
            console.log(`ID Item: ${itemId}`);

            const response = await sendIdToServer(itemId);
            if (!response.ok)
                return console.error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const item = data.info.aliexpress_ds_product_get_response.result;

            const skuInfo = item.ae_item_sku_info_dtos.ae_item_sku_info_d_t_o[0];
            const imageUrls = item.ae_multimedia_info_dto.image_urls.split(';');

            url.value = '';
            const existingItem = selectedItems.value.find(id => id.item_id === itemId);
            if (existingItem)
                existingItem.number_item++;
            else {
                selectedItems.value.push({
                    item_id: itemId,
                    item_url: url_buffer,
                    price: skuInfo.sku_price,
                    img_url: imageUrls[0],
                    details: item.ae_item_base_info_dto.subject,
                    rates: item.ae_item_base_info_dto.avg_evaluation_rating,
                    sale_price: skuInfo.offer_sale_price,
                    is_on_sale: skuInfo.offer_sale_price !== skuInfo.sku_price,
                    number_item: 1
                });
            }
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
            <div class="selectedProduct">
                <div class="item" v-for="item in selectedItems" :key="item.item_id">
                    <img class="img_product" :src="item.img_url" :alt="item.item_id">
                    <div class="info_product">
                        <div class="utils">
                            <img src="/icons/star.svg" alt="star">
                            <p class="rates">{{ item.rates }}</p>
                            <p class="sale_price" v-if="item.is_on_sale" >{{ item.is_on_sale ? '-' + Math.round(((item.price - item.sale_price) / item.price) * 100) + '%' : undefined }}</p>
                        </div>
                        <div class="details">
                            <p class="description">{{ item.details }}</p>
                            <div class="ref">
                                <div class="number">
                                    <p class="price">${{ !item.is_on_sale ? item.price : item.price - (item.price - item.sale_price) }}</p>
                                    <p>X {{ item.number_item }}</p>
                                    <p class="icon" @click="item.number_item++">+</p>
                                    <p class="icon" @click="item.number_item > 1 ? item.number_item-- : item.number_item = item.number_item">-</p>
                                </div>
                                <a :href="item.item_url" target="blank">
                                    <img src="/icons/link.svg" alt="link">
                                    <p>Voir l'article</p>
                                </a>
                            </div>
                        </div>
                    </div>
                    <img src="/icons/delete.svg" alt="delete" @click="selectedItems = selectedItems.filter(id => id.item_id !== item.item_id)">
                </div>
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
                margin-bottom: 10px;

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

            .selectedProduct {
                width: 400px;
                height: 350px;
                display: flex;
                flex-direction: column;
                align-items: center;
                overflow-y: scroll;
                overflow-x: hidden;
                gap: 10px;

                .item {
                    width: 350px;
                    min-height: 100px;
                    display: flex;
                    flex-direction: row;
                    justify-content: center;
                    align-items: center;
                    position: relative;
                    border: 1px solid style.$primary-color;
                    border-radius: 15px;
                    margin-top: 8px;
                    gap: 5px;

                    .img_product {
                        width: 60px;
                        height: 60px;
                        border-radius: 5px;
                        margin-left: 5px;
                    }

                    .info_product{
                        gap: 5px;

                        .utils {
                            display: flex;
                            flex-direction: row;
                            align-content: flex-end;
                            gap: 5px;

                            img {
                                width: 20px;
                                height: 20px;
                            }

                            .rates {
                                font-size: 15px;
                                font-family: style.$font-Poppins-Medium;
                                color: style.$text-color;
                            }

                            .sale_price {
                                font-size: 15px;
                                font-family: style.$font-Poppins-Bold;
                                color: style.$primary-color;
                            }
                        }

                        .details {
                            display: flex;
                            flex-direction: column;

                            .description {
                                font-size: 10px;
                                font-family: style.$font-Poppins-Bold;
                                color: style.$text-color;
                                width: 275px;
                            }

                            .ref {
                                display: flex;
                                flex-direction: row;
                                align-items: center;
                                justify-content: space-between;

                                .number {
                                    display: flex;
                                    flex-direction: row;                                
                                    align-items: center;
                                    gap: 2px;

                                    .price, .icon {
                                        font-size: 15px;
                                        font-family: style.$font-Poppins-Bold;
                                        color: style.$text-color;
                                    }

                                    p:nth-child(2) {
                                        font-size: 12px;
                                        font-family: style.$font-Poppins-Bold;
                                        color: style.$text-color;
                                    }

                                    .icon { margin-left: 2px; }
                                    .icon:hover { cursor: pointer; }
                                }

                                a {
                                    display: flex;
                                    flex-direction: row;
                                    font-family: style.$font-Poppins-Regular;
                                    font-size: 10px;
                                    color: style.$text-color;
                                    margin-right: 10px;
                                    gap: 5px;

                                    img {
                                        width: 15px;
                                        height: 15px;
                                    }
                                }
                            }
                        }
                    }

                    img:last-child {
                        width: 25px;
                        height: 25px;
                        background-color: style.$background-color;
                        position: absolute;
                        z-index: 0;
                        top: -14%;
                        left: 90%;

                        &:hover { cursor: pointer; }
                    }
                }
            }
        }
    }
</style>