<script setup>
    import { useCounterStore } from '@/stores/currency';
    import { useOrderStore } from '@/stores/order';
    import { useRouter } from 'vue-router';

    const router = useRouter();
    const sum = useCounterStore();
    const order = useOrderStore();
</script>

<template>
    <div class="confirmation">
        <div class="info">
            <div class="cost">
                <div class="calcul">
                    <div class="number">
                        <div class="bill">
                            <div class="details">
                                <p class="type">Total Panier</p>
                                <p class="price">{{ '$' + order.totalCart.toFixed(2) }}</p>
                            </div>
                            <p class="further">+</p>
                        </div>
                        <div class="bill">
                            <div class="details">
                                <p class="type">Livraison AliExpress</p>
                                <p class="price">{{ '$' + order.totalFreight.toFixed(2) }}</p>
                            </div>
                            <p class="further">+</p>
                        </div>
                        <div class="bill" title="Une commission de 15% supplèmentaire sur chaque achat dont les 3.5% de frais de transaction Mvola.">
                            <div class="value">
                                <p class="type">15% de commission</p>
                                <p class="price">${{ order.margin.toFixed(2) }}</p>
                            </div>
                            <img src="/icons/choose.svg" alt="info commission">
                        </div>
                    </div>
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
                        <p>${{ order.totalPrice.toFixed(2) }}</p><p class="utils">ou</p>
                    </div>
                    <p class="ariary">{{ sum.amountWithDots + ' MGA' }}</p>
                </div>
            </div>
            <div class="check_out">
                <button class="cancel" @click="sum.is_updated = false">Annuler</button>
                <button class="purchase" @click="router.push('/web_payment')">Payer</button>
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
                        margin-bottom: 5px;
                        width: 150px;
                        gap: 5px;

                        .bill {
                            display: flex;
                            flex-direction: row;
                            align-items: center;
                            justify-content: space-between;

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

                            img {
                                width: 18px;
                                height: 18px;
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
                    margin-bottom: 5px;
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
            margin-bottom: 25px;

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
                            font-size: 18px;
                            font-family: style.$font-Poppins-Medium;
                            color: style.$text-color;
                        }

                        p:nth-child(2) {
                            font-size: 18px;
                            @include font-shared;
                        }
                    }

                    .ariary {
                        font-size: 18px;
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
                    width: 80px;
                    height: 35px;
                    font-size: 12px;
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

                .purchase {
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: style.$primary-color;
                    @include button-shared;
                }
            }
        }
    }
</style>