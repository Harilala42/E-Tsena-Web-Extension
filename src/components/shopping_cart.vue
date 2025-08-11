<script setup>
    import { ref, computed, onMounted, watch } from 'vue';
    import { useCounterStore } from '@/stores/currency';
    import { useOrderStore } from '@/stores/order';
    import ReviewItem from './review_order.vue';

    const sum = useCounterStore();
    const order = useOrderStore();

    var selectedItems = ref([]);
    const showFullText = ref({});
    var showNumber = ref(-1);
    var addItem = ref(false);
    var purchaseIt = ref(false);
    var item_id = ref(-1);
    var price_id = ref(-1);
    var url = ref('');

    onMounted(() => {
        let cartData = [];
        sum.is_updated = false;

        chrome.storage.local.set({ 'e_tsena_state': 'shopping-cart' });

        chrome.storage.local.get(['cart'], async (result) => {
            if (result.cart) {
                cartData = await JSON.parse(result.cart);
                selectedItems.value = cartData;
            }
        });
        chrome.storage.onChanged.addListener(async (details) => {
            if (details.cart) {
                cartData = await JSON.parse(details.cart.newValue);
                selectedItems.value = cartData;
                console.log('Cart Updated');
            }
        });
    });

    watch(selectedItems, (newVal) => {
        chrome.storage.local.set({ cart: JSON.stringify(newVal) });

        if (price_id.value < 0)
            return ;

        if (newVal[price_id.value].number_item === selectedItems.value[price_id.value].number_item)
            selectedItems.value[price_id.value].number_item = numberItem(newVal[price_id.value]);
        price_id.value = -1;
    }, { deep: true });

    const isPurchaseButtonEnabled = computed(() => {
        return selectedItems.value.length !== 0 && !addItem.value && !purchaseIt.value
    });

    const truncatedUrl = computed(() => {
        return url.value.length > 20 ? url.value.substring(0, 30) : url.value;
    });

    const totalPrice = computed(() => {
        return selectedItems.value.reduce((sum, item) => {
            let info = item.order_model,
                price = info.is_on_sale ? info.sale_price : info.price;

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
            addItem.value = true;

            const response = await sendIdToServer(itemId);
            if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            // Extraction des informations utiles
            const item = data.info.aliexpress_ds_product_get_response.result;
            const skusInfo = item.ae_item_sku_info_dtos.ae_item_sku_info_d_t_o;
            const imageUrls = item.ae_multimedia_info_dto.image_urls.split(';');

            url.value = ''; addItem.value = false;
            const existingItem = selectedItems.value.find(id => id.item_id === itemId);
            if (existingItem)
                throw new Error('Product is already in the cart');

            selectedItems.value.push({
                item_id: itemId,
                item_url: url_buffer,
                img_default: imageUrls[0],
                isPending: false,
                img_url: await getSkuImage(skusInfo[0], imageUrls[0], 0),
                details: item.ae_item_base_info_dto.subject,
                rates: item.ae_item_base_info_dto.avg_evaluation_rating,
                sku_item: skusInfo,
                order_model: getInfoSku(skusInfo[0]),
                package_info: item.package_info_dto,
                selectedSkuIndex: 0,
                number_item: 1
            });
        } catch (error) {
            const errorMessage = typeof error?.message === 'string' ? error.message 
                : typeof error === 'string' ? error : 'An unknown error occurred';

            let userMessage = 'An unexpected error occurred';
            
            if (error.response?.status === 404 || !error.response?.ok)
                userMessage = 'Un problème est survenu lors de la recherche 😓.';
            else if (errorMessage.includes('out of stock'))
                userMessage = 'Le produit est en rupture de stock 😓.';
            else if (errorMessage.includes('already in the cart'))
                userMessage = 'Le produit est déjà dans le panier 😅.';
            else if (errorMessage.includes('Invalid domain'))
                userMessage = 'Veuillez fournir un URL AliExpress valide 😓.';
            else if (errorMessage.includes('No ID item') || url.value)
                userMessage = 'Impossible d\'identifier le produit 😓.';
            
            url.value = ''; addItem.value = false;
            chrome.notifications.create("failureGetItem", {
                type: "basic",
                iconUrl: "/icons/warning.svg",
                title: `❌ ${errorMessage} ❌`,
                message: userMessage
            });
        }
    }

    // Obtention des informations d'un 'sku_item'
    const getInfoSku = (sku_item) => {
        const price = parseFloat(sku_item.sku_price);
        const sale_price = parseFloat(sku_item.offer_sale_price);
        const stock = parseInt(sku_item.sku_available_stock);

        if (stock <= 0)
            throw new Error('Product is out of stock');

        return {
            price: price,
            sale_price: sale_price,
            is_on_sale: sale_price < price,
            currentStock: stock
        }
    }

    // Obtention de l'image produit du model
    const getSkuImage = async (sku_item, img_default, id) => {
        try {
            const variant = sku_item.ae_sku_property_dtos;
            const infoVariant = variant.ae_sku_property_d_t_o[0];
            const imageSku = infoVariant.sku_image;

            if (imageSku) {
                await preloadImage(imageSku);
                return imageSku;
            } else {
                await preloadImage(img_default);
                return img_default;
            }
        } catch (error) {
            console.error('Unexpected Error in getSkuImage:', error);
            return img_default;
        }
    };

    // Obtention des variants du produit
    const getVariantName = (sku_attr) => {
        if (!sku_attr) return 'Default';

        const variants = sku_attr.ae_sku_property_d_t_o;
        let variantNames = [];

        variants.forEach(id => {
            if (id.property_value_definition_name)
                variantNames.push(id.property_value_definition_name);
            else
                variantNames.push(id.sku_property_value);
        });
        return variantNames.join(' ') || 'Default';
    };

    // Obtention du prix réel du produit
    const getItemPrice = (item) => {
        let info = item.order_model,
            price = info.is_on_sale ? info.sale_price : info.price;
        return Number(price).toFixed(2) || 0;
    };

    // Obtention du pourcentage de promotion du produit
    const getDiscount = (item) => {
        let info = item.order_model,
            discount = info.is_on_sale ? `-${Math.round(((info.price - info.sale_price) / info.price) * 100)}%` : null;
        return discount || undefined;
    }

    // Obtention d'un model spécifique du produit
    const chooseModel = async (sku, id) => {
        if (selectedItems.value[id].isPending)
            return;
        selectedItems.value[id].isPending = true;

        try {
            const imageUrl = await getSkuImage(
                selectedItems.value[id].sku_item[sku],
                selectedItems.value[id].img_default,
                id
            );

            selectedItems.value[id].img_url = imageUrl;
            selectedItems.value[id].order_model = getInfoSku(selectedItems.value[id].sku_item[sku]);
            selectedItems.value[id].selectedSkuIndex = sku;
            selectedItems.value[id].number_item = 1;
            item_id.value = -1;
        } catch (error) {
            console.error('Error in chooseModel:', error);
        }  finally {
            selectedItems.value[id].isPending = false;
        }
    };

    // Notification Push pour le nombre de stock
    const notifyStock = async (item, currentStock) => {
        try {
            const response = await fetch(item.img_url);
            const blob = await response.blob();
            
            // Convertion en data URL
            const reader = new FileReader();
            reader.onloadend = () => {
                chrome.notifications.create("stockWarning", {
                    type: "basic",
                    iconUrl: reader.result,
                    title: "❌ Stock insuffisant ❌",
                    message: `Only ${currentStock} items available in stock`
                });
            };
            reader.readAsDataURL(blob);
        } catch (error) {
            chrome.notifications.create("stockWarning", {
                type: "basic",
                iconUrl: "/icons/warning.svg",
                title: "❌ Stock insuffisant ❌",
                message: `Only ${currentStock} items available in stock`
            });
        }
    }

    // Vérification du nombre de commande possible
    const numberItem = (item) => {
        const currentStock = item.order_model.currentStock;
        let currentNumber = item.number_item;

        if (currentNumber < 1)
            currentNumber = 1;
        else if (currentNumber > currentStock) {
            currentNumber = currentStock;
            notifyStock(item, currentStock);
        }
        return currentNumber;
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
                if (!result.jwt) return ;

                const { token } = result.jwt;

                resolve(fetch(import.meta.env.VITE_URL_INFOPRODUCT_AE, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ itemId: itemId })
                }));
            });
        });
    };

    // Affichage du total de la commande
    const purchaseOrder = () => {
        chrome.storage.local.get(['cart', 'jwt'], async (result) => {
            if (!result.cart || !result.jwt) return ;

            const { token } = result.jwt;
            const cartData = await JSON.parse(result.cart);
            purchaseIt.value = true;

            try {
                await order.getBillOrder(token, cartData);
                const usd = order.totalPrice;
                sum.convertCurrency(usd);
            } catch(err) {
                console.error(err);
                chrome.notifications.create("failurePurchase", {
                    type: "basic",
                    iconUrl: "/icons/warning.svg",
                    title: '❌ We encountered a problem ❌',
                    message: 'Un problème est survenu. Veuillez réessayer!'
                });
            } finally {
                purchaseIt.value = false;
            }
        });
    }

    // Obtention de la date d'aujourd'hui
    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    }

    // Pré-chargement des images critiques
    const preloadImage = (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.src = url;
            img.onload = () => resolve(img);
            img.onerror = () => reject('Failure Load Image');
        });
    };
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
                    <button @click="getProductInfo"
                        :class="{ 'addItem': !sum.is_updated || !addItem, 'disabledAddItem': sum.is_updated || addItem }" 
                        :disabled="sum.is_updated || addItem"
                    >
                        <img src="/icons/paste.svg" alt="cart"><p>Ajouter</p>
                    </button>
                </div>
            </div>
            <div class="empty_cart" v-if="selectedItems.length == 0">
                <img src="/icons/empty_cart.png" alt="empty cart">
                <p class="message">Le panier est vide.</p>
            </div>
            <div class="selectedProduct" v-else>
                <div class="item" v-for="item in selectedItems" :key="selectedItems.indexOf(item)">
                    <div class="models" @click="!sum.is_updated ? item_id = selectedItems.indexOf(item) : item_id = -1">
                        <div :class="{ 'img_models_shown': !sum.is_updated, 'img_models_hidden': sum.is_updated }" 
                            :style="{ 'background-image': item.img_url ? `url('${item.img_url}')` : 'none' }"
                            :aria-label="item.item_id">
                            <img src="/icons/choose.svg" v-if="!sum.is_updated" alt="choose" title="Choisir une option">
                        </div>
                    </div>
                    <div class="info_product">
                        <div class="utils">
                            <img src="/icons/star.svg" alt="star">
                            <p class="rates">{{ item.rates }}</p>
                            <p class="discount" v-if="item.order_model.is_on_sale" >{{ getDiscount(item) }}</p>  
                            <p class="stock">({{ item.order_model.currentStock }} en stock)</p>     
                        </div>
                        <div class="details">
                            <p class="description">
                                {{
                                    showFullText[item.item_id] ? 
                                        item.details : 
                                        `${item.details.substring(0, 100)}${(item.details.length > 100 && !showFullText[item.item_id]) ? '...' : null}`
                                }}
                                <span v-if="item.details.length > 100" class="see_more" @click="showFullText[item.item_id] = !showFullText[item.item_id]">
                                    {{ showFullText[item.item_id] ? 'Voir moins' : 'Voir plus' }}
                                </span>
                            </p>
                            <div class="ref">
                                <div class="number">
                                    <p class="price">${{ getItemPrice(item) }}</p><p>X</p>
                                    <div :class="{'nb_item_enabled': selectedItems.indexOf(item) !== showNumber, 'nb_item_unabled': selectedItems.indexOf(item) === showNumber}">
                                        <p :class="{ 'nb_display': !sum.is_updated }">{{ item.number_item }}</p>
                                        <input type="number" class="nb_input" 
                                            v-if="!sum.is_updated" v-model="item.number_item" 
                                            :value="numberItem(item)" 
                                            @input="price_id = selectedItems.indexOf(item)"
                                            :min="1"
                                        >
                                        <button class="ajust_nb" v-if="!sum.is_updated" 
                                            @click="showNumber < 0 ? showNumber = selectedItems.indexOf(item) : showNumber !== selectedItems.indexOf(item) ? showNumber = selectedItems.indexOf(item) : showNumber = -1"
                                        >
                                            <img src="/icons/pencil.svg" alt="adjust number" width="18px" height="18px">
                                        </button>
                                    </div>
                                </div>
                                <a :href="item.item_url" target="blank">
                                    <img src="/icons/link.svg" alt="link">
                                    <p>Voir l'article</p>
                                </a>
                            </div>
                        </div>
                    </div>
                    <img src="/icons/delete.svg" class="removeItem" alt="delete"
                        v-if="!showFullText[item.item_id] && !sum.is_updated"
                        @click="selectedItems = selectedItems.filter(id => id.item_id !== item.item_id)"
                    >
                </div>
            </div>
        </div>
        <div class="horizontal-bar"></div>
        <div class="review" v-if="!sum.is_updated">
            <div class="total">
                <p>Total :</p>
                <p class="total_price">${{ totalPrice }}</p>
                <p class="total_price">+</p>
                <p class="txt_utils">15% de<br> commission</p>
            </div>
            <button 
                :class="{
                    'buyIt': isPurchaseButtonEnabled, 
                    'disabled-buyIt': !isPurchaseButtonEnabled
                }" 
                :disabled="!isPurchaseButtonEnabled"
                @click="purchaseOrder()"
            >
                <p v-if="!purchaseIt">Acheter</p>
                <span v-else class="load_purchase"></span>
            </button>
        </div>
        <ReviewItem v-else></ReviewItem>
        <div class="sku_item" v-if="item_id >= 0">
            <div class="sku_id"
                :class="{ 'disabled_option': sku.sku_available_stock <= 0 }"
                v-for="sku in selectedItems[item_id].sku_item"
                :key="selectedItems[item_id].sku_item.indexOf(sku)"
                @click="chooseModel(selectedItems[item_id].sku_item.indexOf(sku), item_id)"
            >
                <p class="sku">
                    {{ getVariantName(sku.ae_sku_property_dtos) }}
                    <img src="/icons/check_circle.svg" 
                        v-if="selectedItems[item_id].sku_item.indexOf(sku) === selectedItems[item_id].selectedSkuIndex" 
                        alt="choice"
                    >
                </p>
            </div>
            <div class="close_win" @click="item_id = -1">
                <img src="/icons/close.svg" alt="close">
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
        position: relative;
        background-color: style.$background-color;
        min-width: 400px;
        min-height: 500px;
        padding: 0;

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
                    font-size: 12px;
                    font-family: style.$font-Poppins-Regular;
                    border-radius: 15px 0 0 15px;
                    background-color: transparent;
                    padding-left: 15px;

                    &::placeholder {
                        color: style.$secondary-color;
                        font-size: 12px;
                        font-family: style.$font-Poppins-Regular;
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
                        &:hover { cursor: not-allowed; }
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
                min-height: 355px;
                max-height: 355px;
                display: flex;
                flex-direction: column;
                align-items: center;
                overflow-y: auto;
                overflow-x: hidden;
                transition: max-height 0.8s ease;
                gap: 5px;

                .item {
                    width: 350px;
                    display: flex;
                    flex-direction: row;
                    justify-content: center;
                    align-items: center;
                    position: relative;
                    border: 1px solid style.$primary-color;
                    border-radius: 15px;
                    margin-top: 8px;
                    padding: 5px 0;
                    gap: 5px;

                    .models {
                        width: 80px;
                        height: 80px;
                        margin-left: 10px;

                        @mixin img_models {
                            width: 80px;
                            height: 80px;
                            background-size: cover;
                            background-position: center;
                            background-repeat: no-repeat;
                            position: relative;
                            border-radius: 5px;

                            img {
                                width: 24px;
                                height: 24px;
                            }
                        }

                        .img_models_shown {
                            @include img_models;

                            .id_models {
                                width: 15px;
                                height: 15px;
                                text-align: center;
                                position: absolute;
                                inset: 3px;
                            }

                            &:hover { cursor: pointer; }
                        }

                        .img_models_hidden { @include img_models; }
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

                            .stock {
                                @include shared_font;
                                font-size: 12px;
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

                                .see_more {
                                    text-decoration: underline;
                                    &:hover { cursor: pointer; }
                                }
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

                                    @mixin shared_number {
                                        font-size: 12px;
                                        font-family: style.$font-Poppins-Bold;
                                        color: style.$text-color;
                                    }

                                    p { @include shared_number; }

                                    @mixin ajust_style {
                                        display: flex;
                                        flex-direction: row;
                                        align-items: center;
                                        justify-content: center;
                                        gap: 3px;

                                        .ajust_nb {
                                            display: flex;
                                            flex-direction: row;
                                            align-items: center;
                                            background-color: style.$background-color;
                                            padding-bottom: 4px;
                                            cursor: pointer;
                                            border: none;

                                            .icon {
                                                border: none;
                                                margin-left: 2px;
                                                background-color: transparent;
                                                &:hover { cursor: pointer; }
                                            }
                                        }
                                    }

                                    .nb_item_enabled {
                                        @include shared_number;
                                        
                                        .nb_input { display: none; }
                                        @include ajust_style;
                                    }

                                    .nb_item_unabled {
                                        .nb_display { display: none; }
                                        @include ajust_style;

                                        input[type="number"] {
                                            width: 50px;
                                            border: none;
                                            display: flex;
                                            background-color: transparent;
                                            @include shared_number;

                                            &:focus {
                                                outline: none;
                                                border: none;
                                                box-shadow: none;
                                            }
                                        }
                                    }
                                }

                                a {
                                    display: flex;
                                    flex-direction: row;
                                    align-items: center;
                                    font-family: style.$font-Poppins-Regular;
                                    font-size: 10px;
                                    color: style.$text-color;
                                    margin-right: 5px;
                                    gap: 3px;

                                    img {
                                        width: 18px;
                                        height: 18px;
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
                        top: -12.5%;
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
                gap: 8px;

                @mixin shared_p {
                    font-size: 20px;
                    color: style.$text-color;
                }

                p:first-child {
                    font-weight: 800;
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
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: #CA6037;
                @include shared-btn;

                .load_purchase {
                    width: 12px;
                    height: 12px;
                    border: 2px solid #f3f3f3;
                    border-top: 2px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                &:hover { cursor: not-allowed; }
            }
        }

        .sku_item {
            width: 80%;
            max-height: 80%;
            overflow-y: auto;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(style.$secondary-color, 0.9);
            border-top-left-radius: 15px;
            border-bottom-left-radius: 15px;
            padding: 20px;
            z-index: 10;

            .sku_id {
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
                width: fit-content;
                text-align: start;
                color: style.$text-color;
                font-family: style.$font-Poppins-Bold;
                font-size: 15px;
                gap: 5px;

                .sku {
                    display: flex;
                    gap: 5px;
                }

                &:hover { cursor: pointer; }
            }

            .disabled_option {
                pointer-events: none;
                text-decoration: line-through solid style.$primary-color 2px;
            }
            
            .close_win {
                width: 50px;
                height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: rgba(style.$primary-color, 0.75);
                border-bottom-left-radius: 15px;
                position: fixed;
                top: 0;
                right: 0;

                img {
                    width: 40px;
                    height: 40px;
                }

                &:hover { cursor: pointer; }
            }
        }
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>