<script setup>
    import { ref, computed, onMounted, watch } from 'vue';
    import { useCounterStore } from '@/stores/currency';
    import { useOrderStore } from '@/stores/order';
    import ReviewItem from './review_order.vue';
    import CartItem from './cart_item.vue';

    const sum = useCounterStore();
    const order = useOrderStore();

    const selectedItems = ref([]);
    const addItem = ref(false);
    const purchaseIt = ref(false);
    const item_id = ref(-1);
    const url = ref('');

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

    watch(selectedItems, (newCart) => {
        chrome.storage.local.set({ cart: JSON.stringify(newCart) });
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

    const getProductInfo = async () => {
        try {
            const url_buffer = url.value;
            if (url_buffer === '') return;

            const itemId = await extractItemID(url_buffer);
            console.log(`ID Item: ${itemId}`);
            addItem.value = true;

            const response = await sendIdToServer(itemId);
            if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

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
                img_url: await getSkuImage(skusInfo[0], imageUrls[0], 0),
                details: item.ae_item_base_info_dto.subject,
                rates: item.ae_item_base_info_dto.avg_evaluation_rating,
                category_id: item.ae_item_base_info_dto.category_id,
                currency_code: item.ae_item_base_info_dto.currency_code,
                sku_item: skusInfo,
                order_model: getInfoSku(skusInfo[0]),
                package_info: item.package_info_dto,
                store_info: item.ae_store_info,
                selectedSkuIndex: 0,
                number_item: 1
            });
        } catch (err) {
            const errorMessage = typeof err?.message === 'string' ? err.message 
                : typeof err === 'string' ? err : 'An unknown error occurred';

            let userMessage = 'An unexpected error occurred';
            
            if (err.response?.status === 404 || !err.response?.ok)
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

    const chooseModel = async (sku, id) => {
        try {
            const imageUrl = await getSkuImage(
                selectedItems.value[id].sku_item[sku],
                selectedItems.value[id].img_default,
                id
            );

            const newModelInfo = getInfoSku(selectedItems.value[id].sku_item[sku]);
            const updatedItem = { ...selectedItems.value[id] };

            updatedItem.img_url = imageUrl;
            updatedItem.order_model = newModelInfo;
            updatedItem.selectedSkuIndex = sku;
            updatedItem.number_item = 1;

            selectedItems.value.splice(id, 1, updatedItem);
            item_id.value = -1;
        } catch (error) {
            console.error('Error in chooseModel:', error);
        }
    };

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

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    }

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
    <section id="title">
        <div class="icon-title">
            <img src="/icons/shopping_cart.svg" alt="cart">
            <h1 class="text">Panier d'Achat</h1>
        </div>
        <div class="icon-title">
            <div class="vertical-bar"></div>
            <img src="/icons/calendar.svg" alt="calendar">
            <h1 class="date">{{ formatDate(Date.now()) }}</h1>
        </div>
    </section>
    <div class="horizontal-bar"></div>
    <section id="cart">
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
        <TransitionGroup name="cartItem" tag="div" class="selectedProduct" v-else>
            <CartItem v-for="(item, idx) in selectedItems"
                :key="item.item_id"
                :item="item" :index="idx"
                @choose="item_id = $event"
                @update="selectedItems[$event.idx].number_item = $event.quantity"
                @remove="selectedItems = selectedItems.filter(id => id.item_id !== $event)"
            >
            </CartItem>
        </TransitionGroup>
    </section>
    <div class="horizontal-bar"></div>
    <section id="review" v-if="!sum.is_updated">
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
    </section>
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
</template>

<style scoped lang="scss">
    @use '../style';

    #title {
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

    #cart {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin-bottom: 15px;

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
            width: 400px;
            min-height: 355px;

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
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;

            .cartItem-leave-active { transition: all 0.5s ease; }

            .cartItem-leave-to { 
                margin: 0;
                padding: 0;
                opacity: 0;
                max-height: 0;
                overflow: hidden;
            }
            
            .cartItem-move { transition: transform 0.5s ease; }
        }
    }

    #review {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        min-width: 350px;

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

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>