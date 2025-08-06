import { defineStore } from 'pinia';

export const useCounterStore = defineStore('convertUSDtoMGA', {
    state: () => ({
        amount: 0,
        is_updated: false 
    }),
    getters: {
        amountWithDots: (state) => 
            state.amount
                .toFixed(0)
                .toString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    },
    actions: {
        convertCurrency(usd) {
            chrome.storage.local.get(['jwt'], async (result) => {
                if (result.jwt) {
                    const { token } = result.jwt;

                    try {
                        const response = await fetch(import.meta.env.VITE_URL_CONVERTUSDTOMGA, {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!response.ok)
                            return console.error(`HTTP error! status: ${response.status}`);
        
                        const data = await response.json();
        
                        this.amount = data.conversion_rates.MGA * usd;
                        this.is_updated = true;
                    } catch(error) {
                        this.is_updated = false;
                        console.error(`Failed to convert ${this.amount}$:`, error);
                    }
                }
            });
        },
        prepareOrder() {
            return new Promise((resolve, reject) => {
                chrome.storage.local.get(['cart'], async (result) => {
                    if (!result.cart) resolve([]);

                    try {
                        const cartData = await JSON.parse(result.cart);

                        const currentCart = cartData.map(item => ({
                            product_id: item.item_id,
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
                            order_memo: ''
                        }));
        
                        resolve (currentCart);
                    } catch(err) {
                        reject(`Failed to prepare Order AE: ${err}`);
                    }
                })
            });
        }
    }
});
