<script setup>
    import { ref } from 'vue';
    import { useCounterStore } from '@/stores/currency';

    const props = defineProps({
        item: {
            type: Object,
            required: true
        },
        index: {
            type: Number,
            required: true,
            default: -1
        }
    });

    const emit = defineEmits(['remove', 'choose', 'update']);

    const sum = useCounterStore();

    const showFullText = ref({});
    const itemQuantity = ref(props.item.number_item);
    const showNumber = ref(-1);

    const getItemPrice = (item) => {
        let info = item.order_model,
            price = info.is_on_sale ? info.sale_price : info.price;
        return Number(price).toFixed(2) || 0;
    };

    const getDiscount = (item) => {
        let info = item.order_model,
            discount = info.is_on_sale ? `-${Math.round(((info.price - info.sale_price) / info.price) * 100)}%` : null;
        return discount || undefined;
    }

    const handleQuantity = (item, quantity) => {
        let newQuantity = Number(quantity);
        const currentStock = item.order_model.currentStock;

        if (newQuantity < 1)
            newQuantity = 1;
        else if (newQuantity > currentStock) {
            newQuantity = currentStock;
            notifyStock(item, currentStock);
        }

        itemQuantity.value = newQuantity;
        emit('update', { idx: props.index, quantity: newQuantity });
    }

    const notifyStock = async (item, currentStock) => {
        try {
            const response = await fetch(item.img_url);
            const blob = await response.blob();
            
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
</script>

<template>
    <article class="item">
        <div class="models" @click="emit('choose', index)">
            <div :class="{ 'img_models_shown': !sum.is_updated, 'img_models_hidden': sum.is_updated }" 
                :style="{ 'background-image': item.img_url ? `url('${item.img_url}')` : 'none' }"
                :aria-label="item.item_id"
            >
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
                        <div :class="{'nb_item_enabled': index !== showNumber, 'nb_item_unabled': index === showNumber}">
                            <p :class="{ 'nb_display': !sum.is_updated }">{{ item.number_item }}</p>
                            <input type="number" class="nb_input" 
                                v-if="!sum.is_updated" v-model="itemQuantity" 
                                :value="itemQuantity" :min="1"
                                @input="handleQuantity(item, $event.target.value)"
                            >
                            <button class="ajust_nb" v-if="!sum.is_updated" 
                                @click="showNumber < 0 ? showNumber = index : showNumber !== index ? showNumber = index : showNumber = -1"
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
            @click="emit('remove', item.item_id)"
        >
    </article>
</template>

<style scoped lang="scss">
    @use '../style';

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
</style>