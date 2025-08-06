<script setup>
    import { ref, computed, onMounted, watch } from 'vue';
    import { useCounterStore } from '@/stores/currency';
    import { useRouter } from 'vue-router';

    const router = useRouter();
    const sum = useCounterStore();

    var totalCart = ref(0);
    var priceDelivery = ref(0);
    var margin = ref(0);
    var payOrder = ref(false);

    onMounted(() => {
        chrome.storage.local.get(['cart'], async (result) => {
            if (result.cart) {
                const cartData = await JSON.parse(result.cart);

                getDeliveryOptions();

                totalCart.value = cartData.reduce((sum, item) => {
                    let info = item.order_model,
                        price = info.is_on_sale ? info.sale_price : info.price;

                    return sum + parseFloat(price) * item.number_item;
                }, 0);
                margin.value = totalCart.value * 0.15;
            };
        });
    });

    const totalPrice = computed(() => {
        return Number(totalCart.value) + Number(margin.value) + Number(priceDelivery.value);
    });

    watch(payOrder, async (newVal) => {
        if (newVal && !sum.is_updated) {
            const usd = totalPrice.value.toFixed(2);
            await sum.convertCurrency(usd);
        }
    });

    const getDeliveryOptions = () => {
        chrome.storage.local.get(['cart', 'jwt'], async (result) => {
            if (result.cart && result.jwt) {
                const { token } = result.jwt;
                const cartData = await JSON.parse(result.cart);

                let totalFreight = 0;
                let notificationCount = 0;

                const requestServer = cartData.map(async (item, id) => {
                    try {
                        const response = await fetch(import.meta.env.VITE_URL_DELIVERYFREIGHT_AE, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                itemId: item.item_id,
                                itemNumber: item.number_item,
                                selectedSkuId: item.sku_item[item.selectedSkuIndex].sku_id
                            })
                        });

                        if (!response.ok)
                            return console.error(`HTTP error! status: ${response.status}`);

                        const data = await response.json();
                        
                        const info = data.info.aliexpress_ds_freight_query_response;
                        const options = info.result.delivery_options.delivery_option_d_t_o;
                        
                        totalFreight += options.reduce((sum, opt) => {
                            return opt.code === 'CAINIAO_STANDARD'
                                ? sum + Number(opt.shipping_fee_cent || 0)
                                : sum;
                        }, 0);
                    } catch(error) {
                        console.error(`Failed to get delivery price ${item.item_id}:`, error);
                        
                        if (notificationCount == 0) {
                            notificationCount += 1;
                            chrome.notifications.create("failureGetDeliveryPrice", {
                                type: "basic",
                                iconUrl: "/icons/warning.svg",
                                title: "🔃 Please Try Again 🔃",
                                message: "Un problème réseau est survenu"
                            }, (notificationId) => {
                                chrome.storage.local.set({ 'purchaseIt': false });
                            });
                        }
                    }
                });

                await Promise.all(requestServer);
                priceDelivery.value += totalFreight;
                payOrder.value = true;
            };
        });
    };

    const cancelOrder = async () => await chrome.storage.local.set({ 'purchaseIt': false });
</script>

<template>
    <div class="confirmation">
        <div class="info">
            <div class="cost">
                <div class="calcul">
                    <div class="number">
                        <div class="fret">
                            <p class="type">Frais de Livraison par AliExpress</p>
                            <p class="price">{{ !payOrder ? '⏳...' : '$' + priceDelivery.toFixed(2) }}</p>
                        </div>
                        <div class="commission">
                            <p class="type">15% de commission</p>
                            <div class="value">
                                <p class="price">${{ margin.toFixed(2) }}</p>
                                <img src="/icons/choose.svg" alt="info commission" title="Une commission de 15% supplèmentaire sur chaque achat dont les 3.5% de frais de transaction Mvola.">
                            </div>
                        </div>
                    </div>
                    <p class="further">+</p>
                </div>
                <div class="checkout-bar"></div>
            </div>
            <div class="caution">
                <div class="warning">
                    <img src="/icons/warning.svg" alt="caution">
                    <p class="title">Attention!</p>
                </div>
                <p class="text">Ne commander seulement les produits que vous jugez fiable.</p>
            </div>
        </div>
        <div class="final">
            <div class="result">
                <div class="total">
                    <div class="overcome">
                        <p class="utils">Total :</p>
                        <p>${{ totalPrice.toFixed(2) }}</p><p class="utils">ou</p>
                    </div>
                    <p class="ariary">
                        {{ sum.amount === 0 || !payOrder ? '⏳...' : sum.amountWithDots + ' MGA' }}
                    </p>
                </div>
                <img src="/icons/download.svg" alt="télécharger">
            </div>
            <div class="check_out">
                <button class="cancel" @click="cancelOrder">Annuler</button>
                <button :disabled="!payOrder || !sum.is_updated"
                    :class="{'purchase': payOrder && sum.is_updated, 'disabled-purchase': !payOrder || !sum.is_updated}"
                    @click="router.push('/web_payement')"
                >Payer</button>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
    @use '../style';

    .confirmation {
        min-width: 350px;
        min-height: 150px;
        background-color: style.$background-color;

        @mixin display-shared {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
        }

        @mixin font-shared {
            font-family: style.$font-Poppins-Bold, sans-serif;
            color: style.$text-color;
        }

        .info {
            @include display-shared;

            .cost {
                display: flex;
                flex-direction: column;
                justify-content: center;
                width: 150px;

                .calcul {
                    @include display-shared;

                    .number {
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        width: 150px;

                        .type {
                            display: flex;
                            font-size: 12px;
                            @include font-shared;
                            flex-wrap: wrap;
                        }

                        .price {
                            font-size: 15px;
                            @include font-shared;
                        }

                        .value {
                            display: flex;
                            flex-direction: row;
                            align-items: center;
                            justify-content: flex-start;
                            gap: 5px;

                            img {
                                width: 15px;
                                height: 15px;
                            }
                        }
                    }

                    p {
                        font-size: 20px;
                        @include font-shared;
                    }
                }

                .checkout-bar {
                    width: 150px;
                    height: 1px;
                    background-color: style.$text-color;
                    margin-bottom: 10px;
                }
            }

            .caution {
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                flex-wrap: wrap;
                border: 1px solid style.$primary-color;
                border-radius: 15px;
                padding: 10px;
                width: 150px;
                gap: 5px;

                .warning {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 5px;

                    img {
                        width: 24px;
                        height: 24px;
                    }

                    .title {
                        font-size: 15px;
                        font-family: style.$font-MontserratAlternates-Bold, sans-serif;
                        color: style.$primary-color;
                    }
                }

                .text {
                    font-size: 10px;
                    font-family: style.$font-Poppins-Bold, sans-serif;
                    color: style.$text-color;
                }
            }
        }

        .final {
            @include display-shared;
            margin-bottom: 20px;

            .result {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 10px;

                .total {
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;

                    .overcome {
                        display: flex;
                        flex-direction: row;
                        gap: 5px;

                        .utils {
                            font-size: 15px;
                            font-family: style.$font-Poppins-Medium;
                            color: style.$text-color;
                        }

                        p:nth-child(2) {
                            font-size: 15px;
                            @include font-shared;
                        }
                    }

                    .ariary {
                        font-size: 15px;
                        @include font-shared;
                        border: 1px solid style.$primary-color;
                        border-radius: 5px;
                        padding: 0 5px;
                    }
                }

                img {
                    width: 24px;
                    height: 24px;
                    cursor: pointer;
                }
            }

            .check_out {
                display: flex;
                flex-direction: row;
                gap: 10px;

                @mixin button-shared {
                    width: 75px;
                    height: 30px;
                    font-size: 10px;
                    border-radius: 10px;
                    color: style.$text-color;
                    text-decoration: none;
                    font-family: style.$font-Poppins-Bold, sans-serif;
                    cursor: pointer;
                }

                .cancel {
                    @include button-shared;
                    border: 1px solid style.$primary-color;
                    background-color: transparent;
                }

                @mixin purchase_shared {
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .purchase {
                    @include purchase_shared;
                    @include button-shared;
                    background-color: style.$primary-color;
                }

                .disabled-purchase {
                    @include purchase_shared;
                    @include button-shared;
                    background-color: #CA6037;
                    cursor: wait;
                }
            }
        }
    }
</style>