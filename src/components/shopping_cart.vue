<script setup>
    import { ref, computed, onMounted, watch } from 'vue';
    import { useRouter } from 'vue-router';

    const router = useRouter();
    var selectedItems = ref([]);
    var purchaseIt = ref(false);
    var url = ref('');

    onMounted(() => {
        chrome.storage.local.get(['cart'], async (result) => {
            let cartData = [];

            if (result.cart) {
                cartData = await JSON.parse(result.cart);
                selectedItems.value = cartData;
            }
        });
    });

    watch(selectedItems, (newVal) => {
        chrome.storage.local.set({ cart: JSON.stringify(newVal) });
    }, { deep: true });

    const truncatedUrl = computed(() => {
        return url.value.length > 20 ? url.value.substring(0, 30) : url.value;
    });

    const totalPrice = computed(() => {
        return selectedItems.value.reduce((sum, item) => {
            let price;

            if (item.has_wholesale) {
                const applicableTier = item.wholesale_tiers
                    ?.sort((a, b) => b.min_quantity - a.min_quantity)
                    ?.find(tier => item.number_item >= parseInt(tier.min_quantity));
                
                price = applicableTier 
                    ? parseFloat(applicableTier.wholesale_price.replace(/"/g, ''))
                    : item.is_on_sale ? item.sale_price : item.price;
            } else
                price = item.is_on_sale ? item.sale_price : item.price;
            
            return sum + parseFloat(price) * item.number_item;
        }, 0).toFixed(2);
    });

    // Obtention des informations du Product AE
    const getProductInfo = async () => {
        try {
            const url_buffer = url.value;
            if (url_buffer === '')
                return ;

            const itemId = await extractItemID(url_buffer);
            console.log(`ID Item: ${itemId}`);
            purchaseIt.value = true;

            const response = await sendIdToServer(itemId);
            if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            // Extraction des informations utiles
            const item = data.info.aliexpress_ds_product_get_response.result;
            const skuInfo = item.ae_item_sku_info_dtos.ae_item_sku_info_d_t_o[0];
            const imageUrls = item.ae_multimedia_info_dto.image_urls.split(';');

            // Vérification des stocks du produit
            if (parseInt(skuInfo.sku_available_stock) <= 0)
                throw new Error('Product is out of stock');

            // Gestion des ventes en gros du produit
            const wholesalePrice = skuInfo.wholesale_price_tiers?.length 
                ? parseFloat(skuInfo.wholesale_price_tiers[0].wholesale_price.replace(/"/g, ''))
                : null;

            // Obtention des prix du produit
            const basePrice = wholesalePrice || parseFloat(skuInfo.sku_price);
            const salePrice = parseFloat(skuInfo.offer_sale_price);
            const isOnSale = salePrice < basePrice;

            url.value = ''; purchaseIt.value = false;
            const existingItem = selectedItems.value.find(id => id.item_id === itemId);
            if (existingItem)
                throw new Error('Product is already in the cart');
            else {
                selectedItems.value.push({
                    item_id: itemId,
                    item_url: url_buffer,
                    price: basePrice,
                    img_url: imageUrls[0],
                    details: item.ae_item_base_info_dto.subject,
                    rates: item.ae_item_base_info_dto.avg_evaluation_rating,
                    sale_price: salePrice,
                    is_on_sale: isOnSale,
                    number_item: 1,

                    // Ajout des informations pour les 'whole_sale'
                    has_wholesale: skuInfo.wholesale_price_tiers?.length > 0,
                    wholesale_tiers: skuInfo.wholesale_price_tiers || [],
                });
            }
        } catch (error) {
            const errorMessage = typeof error?.message === 'string' ? error.message 
                : typeof error === 'string' ? error : 'An unknown error occurred';

            let userMessage = 'An unexpected error occurred';
            
            if (error.response?.status === 404)
                userMessage = 'Le produit recherché est introuvable 😓.';
            else if (errorMessage.includes('out of stock'))
                userMessage = 'Le produit est en rupture de stock 😓.';
            else if (errorMessage.includes('already in the cart'))
                userMessage = 'Le produit est déjà présent 😅.';
            else if (errorMessage.includes('Invalid domain'))
                userMessage = 'Veuillez fournir un URL AliExpress valide 😓.';
            else if (errorMessage.includes('No ID item') || url.value)
                userMessage = 'Impossible d\'identifier le produit 😓.';
            
            url.value = ''; purchaseIt.value = false;
            chrome.notifications.create("failureGetItem", {
                type: "basic",
                iconUrl: "/icons/warning.svg",
                title: `❌ ${errorMessage} ❌`,
                message: userMessage
            });
        }
    }

    // Extraction du itemID de l'URL
    const extractItemID = (url) => {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);

            const allowedDomains = ['fr.aliexpress.com', 'www.aliexpress.com'];
            if (!allowedDomains.includes(parsedUrl.hostname))
                reject('Invalid domain');

            const path = parsedUrl.pathname;
            const match = path.match(/\/item\/(\d+)\.html/);

            if (match && match[1])
                resolve(match[1]);
            
            reject('No ID item found');
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

    // Obtention du 'real price' du produit
    const getItemPrice = (item) => {
        let price;
        
        if (item.has_wholesale) {
            const applicableTier = item.wholesale_tiers
                ?.sort((a, b) => b.min_quantity - a.min_quantity)
                ?.find(tier => item.number_item >= parseInt(tier.min_quantity));
            
            price = applicableTier
                ? parseFloat(applicableTier.wholesale_price?.replace(/"/g, '') || item.price)
                : item.is_on_sale ? item.sale_price : item.price;
        } else
            price = item.is_on_sale ? item.sale_price : item.price;
        
        return Number(price).toFixed(2) || 0;
    };

    // Vérification si les ventes en gros sont en solde
    const hasWholesaleDiscount = (item) => {
        return item.has_wholesale && item.wholesale_tiers.some(
            tier => item.number_item >= parseInt(tier.min_quantity)
        );
    };

    // Obtention de la date d'aujourd'hui
    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    }
</script>

<template>
    <div class="container">
        <div class="title">
            <div class="icon-title">
                <img src="/icons/shopping_cart.svg" alt="cart">
                <h1 class="text">Panier d'Achat</h1>
            </div>
            <div class="icon-title">
                <div class="vertical-bar"></div>
                <img src="/icons/calendar.svg" alt="calendar">
                <h1 class="date">{{ formatDate(Date.now()) }}</h1>
            </div>
        </div>
        <div class="horizontal-bar"></div>
        <div class="cart">
            <div class="searchBar">
                <input type="text" placeholder="Collez votre url ici" v-model="url" :value="truncatedUrl">
                <div class="btnSearch">
                    <img src="/icons/close_search.svg" v-if="url !== ''" alt="cart" @click="url = ''">
                    <button :class="{ 'addItem': !purchaseIt, 'disabledAddItem': purchaseIt }" :disabled="purchaseIt" @click="getProductInfo">
                        <img src="/icons/paste.svg" alt="cart"><p>Ajouter</p>
                    </button>
                </div>
            </div>
            <div class="empty_cart" v-if="selectedItems.length == 0">
                    <img src="/icons/empty_cart.png" alt="empty cart">
                    <p class="message">Le panier est vide.</p>
            </div>
            <div class="selectedProduct" v-else>
                <div class="item" v-for="item in selectedItems" :key="item.item_id">
                    <div class="models">
                        <div class="img_models" 
                            :style="{ 'background-image': `url(${item.img_url})` }"
                            :aria-label="item.item_id">
                            <p class="id_models">1</p>
                        </div>
                    </div>
                    <div class="info_product">
                        <div class="utils">
                            <img src="/icons/star.svg" alt="star">
                            <p class="rates">{{ item.rates }}</p>
                            <p class="discount" v-if="item.is_on_sale" >{{ item.is_on_sale ? '-' + Math.round(((item.price - item.sale_price) / item.price) * 100) + '%' : undefined }}</p>
                            <span v-if="hasWholesaleDiscount(item)" class="wholesale">(Vente en gros)</span>
                        </div>
                        <div class="details">
                            <p class="description">{{ item.details.length > 100 ? item.details.substring(0, 100) + '...' : item.details }}</p>
                            <div class="ref">
                                <div class="number">
                                    <p class="price">${{ getItemPrice(item) }}</p>
                                    <p>X {{ item.number_item }}</p>
                                    <p class="icon" @click="item.number_item++">+</p><p>/</p>
                                    <p class="icon" @click="item.number_item > 1 ? item.number_item-- : item.number_item = item.number_item">-</p>
                                </div>
                                <a :href="item.item_url" target="blank">
                                    <img src="/icons/link.svg" alt="link">
                                    <p>Voir l'article</p>
                                </a>
                            </div>
                        </div>
                    </div>
                    <img src="/icons/delete.svg" class="removeItem" alt="delete" @click="selectedItems = selectedItems.filter(id => id.item_id !== item.item_id)">
                </div>
            </div>
        </div>
        <div class="horizontal-bar"></div>
        <div class="review">
            <div class="total">
                <p>Total :</p>
                <p class="total_price">${{ totalPrice }} +</p>
                <p class="txt_utils">15% de<br> commission</p>
            </div>
            <button :class="{'buyIt': selectedItems.length !== 0, 'disabled-buyIt': selectedItems.length === 0 }" :disabled="selectedItems.length === 0">Acheter</button>
        </div>
        <div class="social_media">
            <div class="icon_social">
                <a href="" target="blank"><img src="/icons/facebook.svg" alt="facebook"></a>
                <a href="" target="blank"><img src="/icons/whatsapp.svg" alt="whatsapp"></a>
            </div>
            <div class="horizontal-bar"></div>
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
        min-height: 500px;

        .title {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 5px;
            width: 350px;

            .icon-title {
                display: flex;
                flex-direction: row;
                gap: 5px;

                img {
                    width: 24px;
                    height: 24px;
                }

                @mixin shared-h1 {
                    font-weight: 800;
                    font-size: 20px;
                    color: style.$text-color;
                }

                .text {
                    @include shared-h1;
                    font-family: style.$font-MontserratAlternates-Bold;
                }

                .date {
                    @include shared-h1;
                    font-family: style.$font-MontserratAlternates-Regular;
                }

                .vertical-bar {
                    width: 1px;
                    height: 24px;
                    background-color: style.$text-color;
                }
            }
        }

        .horizontal-bar {
            width: 350px;
            height: 1px;
            background-color: style.$text-color;
            margin-bottom: 10px;
        }

        .cart {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            margin-bottom: 10px;

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

                    @mixin shared-addItem {
                        width: 100px;
                        height: 28px;
                        display: flex;
                        flex-direction: row;
                        justify-content: center;
                        align-items: center;
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
                    }

                    .addItem {
                        @include shared-addItem;
                        background-color: style.$primary-color;
                        &:hover { cursor: pointer; }
                    }

                    .disabledAddItem {
                        @include shared-addItem;
                        background-color: #CA6037;
                        pointer-events: none;
                    }
                }
            }

            .empty_cart {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-width: 400px;
                min-height: 350px;

                .message {
                    font-weight: 800;
                    font-size: 20px;
                    color: style.$text-color;
                    font-family: style.$font-MontserratAlternates-Regular;
                    margin-top: 5px;
                }
            }

            .selectedProduct {
                width: 400px;
                height: 350px;
                display: flex;
                flex-direction: column;
                align-items: center;
                overflow-y: auto;
                overflow-x: hidden;
                transition: max-height 0.8s ease;
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

                    .models {
                        width: 80px;
                        height: 80px;
                        margin-left: 10px;

                        .img_models {
                            width: 80px;
                            height: 80px;
                            background-size: cover;
                            background-position: center;
                            background-repeat: no-repeat;
                            position: relative;
                            border-radius: 5px;

                            .id_models {
                                width: 15px;
                                height: 15px;
                                font-size: 12px;
                                font-family: style.$font-Poppins-Bold;
                                color: style.$primary-color;
                                border: 2px solid style.$primary-color;
                                border-radius: 50%;
                                text-align: center;
                                position: absolute;
                                inset: 3px;
                            }

                            &:hover {
                                cursor: pointer;
                                box-shadow: inset 0 0 0 2px style.$primary-color;
                            }
                        }
                    }

                    .info_product{
                        .utils {
                            display: flex;
                            flex-direction: row;
                            align-items: baseline;
                            gap: 5px;

                            img {
                                width: 15px;
                                height: 15px;
                            }

                            .rates {
                                font-size: 15px;
                                font-family: style.$font-Poppins-Medium;
                                color: style.$text-color;
                            }

                            @mixin shared_font {
                                font-family: style.$font-Poppins-Bold;
                                color: style.$primary-color;
                            }

                            .discount {
                                @include shared_font;
                                font-size: 15px;
                            }

                            .wholesale {
                                @include shared_font;
                                font-size: 10px;
                            }
                        }

                        .details {
                            display: flex;
                            flex-direction: column;

                            .description {
                                font-size: 10px;
                                font-family: style.$font-Poppins-Bold;
                                color: style.$text-color;
                                width: 240px;
                            }

                            .ref {
                                display: flex;
                                flex-direction: row;
                                align-items: center;
                                justify-content: space-between;

                                .number {
                                    display: flex;
                                    flex-direction: row;                                
                                    align-items: baseline;
                                    gap: 2px;

                                    .price, .icon {
                                        font-size: 15px;
                                        font-family: style.$font-Poppins-Bold;
                                        color: style.$text-color;
                                    }

                                    p:nth-child(2), p:nth-child(4) {
                                        font-size: 12px;
                                        font-family: style.$font-Poppins-Bold;
                                        color: style.$text-color;
                                    }

                                    .icon {
                                        margin-left: 2px;
                                        &:hover { cursor: pointer; }
                                    }
                                }

                                a {
                                    display: flex;
                                    flex-direction: row;
                                    font-family: style.$font-Poppins-Regular;
                                    font-size: 10px;
                                    color: style.$text-color;
                                    margin-right: 5px;
                                    gap: 5px;

                                    img {
                                        width: 15px;
                                        height: 15px;
                                    }
                                }
                            }
                        }
                    }

                    .removeItem {
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

        .review {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            margin-top: -10px;
            margin-bottom: 10px;
            min-width: 350px;
            min-height: 50px;

            .total {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 10px;

                @mixin shared_p {
                    font-size: 20px;
                    color: style.$text-color;
                }

                p:first-child {
                    @include shared_p;
                    font-family: style.$font-MontserratAlternates-Regular;
                }

                .total_price {
                    @include shared_p;
                    font-family: style.$font-MontserratAlternates-Bold;
                }

                .txt_utils {
                    font-size: 10px;
                    font-family: style.$font-MontserratAlternates-Bold;
                    color: style.$text-color;
                    text-align: center;
                }
            }

            @mixin shared-btn {
                width: 75px;
                height: 30px;
                color: style.$text-color;
                font-family: style.$font-Poppins-Bold;
                font-size: 10px;
                border-radius: 10px;
                border: none;
            }

            button {
                @include shared-btn;
                background-color: style.$primary-color;

                &:hover { cursor: pointer; }
            }

            .disabled-buyIt {
                @include shared-btn;
                pointer-events: none;
                background-color: #CA6037;
            }
        }

        .social_media {
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: center;
            position: relative;
            
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
        }
    }
</style>
