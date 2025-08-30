import { defineStore } from 'pinia';

export const useOrderStore = defineStore('purchaseOrder', {
    state: () => ({
        margin: 0,
        totalCart: 0,
        totalFreight: 0
    }),
    getters: {
        totalPrice: (state) => {
            return Number(state.totalCart) + Number(state.totalFreight) + Number(state.margin);
        }
    },
    actions: {
        prepareOrder() {
            return new Promise((resolve, reject) => {
                chrome.storage.local.get(['cart'], async (result) => {
                    if (!result.cart) resolve([]);

                    try {
                        const cartData = await JSON.parse(result.cart);

                        const currentCart = cartData.map(item => ({
                            product_id: item.item_id,
                            category_id: item.category_id.toFixed(0),
                            currency_code: item.currency_code,
                            product_count: item.number_item,
                            sku_attr: item.sku_item[item.selectedSkuIndex].sku_attr,
                            logistics_service_name: 'CAINIAO_STANDARD',
                            description: item.details,
                            img_url: item
                                .sku_item[item.selectedSkuIndex]
                                ?.ae_sku_property_dtos
                                ?.ae_sku_property_d_t_o[0]
                                ?.sku_image || item.img_default,
                            price: (() => {
                                const price = item.sku_item[item.selectedSkuIndex].sku_price;
                                const salePrice = item.sku_item[item.selectedSkuIndex].offer_sale_price || price;
                                const isOnSale = salePrice < price;

                                return (isOnSale ? Number(salePrice).toFixed(2) : Number(price).toFixed(2));
                            })(),
                            package_info: item.package_info,
                            store_info: {
                                communication_rating: Number(item.store_info.communication_rating),
                                item_as_described_rating: Number(item.store_info.item_as_described_rating),
                                shipping_speed_rating: Number(item.store_info.shipping_speed_rating),
                                store_country_code: item.store_info.store_country_code,
                                store_id: item.store_info.store_id.toFixed(0),
                                store_name: item.store_info.store_name,
                            },
                            order_memo: ''
                        }));
        
                        resolve (currentCart);
                    } catch(err) {
                        reject(`Failed to prepare Order AE: ${err}`);
                    }
                })
            });
        },
        async getBillOrder(token, cartData) {
            try {
                const getDeliveryOptions = (item) => {
                    return fetch(import.meta.env.VITE_URL_DELIVERYFREIGHT_AE, {
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
                }

                const freights = await Promise.all(
                    cartData.map(async (item) => {
                        try {
                            const response = await getDeliveryOptions(item);
                            if (!response.ok)
                                throw new Error(`HTTP error! status: ${response.status}`);
        
                            const data = await response.json();
                            const info = data.info.aliexpress_ds_freight_query_response;
                            const options = info.result.delivery_options.delivery_option_d_t_o;
        
                            return options.reduce((sum, opt) => {
                                return opt.code === 'CAINIAO_STANDARD'
                                    ? sum + Number(opt.shipping_fee_cent || 0)
                                    : sum;
                            }, 0);
                        } catch (error) {
                            throw new Error(`Failed to get delivery price ${item.item_id}: ${error}`);
                        }
                    })
                );
                this.totalFreight = freights.reduce((a, b) => a + b, 0);

                this.totalCart = cartData.reduce((sum, item) => {
                    let info = item.order_model,
                        price = info.is_on_sale ? info.sale_price : info.price;

                    return sum + parseFloat(price) * item.number_item;
                }, 0);
                this.margin = this.totalCart * 0.15;
            } catch(err) { throw err; };
        }
    }
});