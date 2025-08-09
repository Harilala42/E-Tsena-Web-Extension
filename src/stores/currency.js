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
        
                        this.is_updated = true;
                        this.amount = data.conversion_rates.MGA * usd;
                        return (this.amount);
                    } catch(error) {
                        this.is_updated = false;
                        console.error(`Failed to convert ${this.amount}$:`, error);
                    }
                }
            });
        }
    }
});
