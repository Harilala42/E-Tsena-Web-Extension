<script setup>
    import { ref, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { useCounterStore } from '@/stores/currency';

    const router = useRouter();
    const sum = useCounterStore();

    var serverCorrelationId = ref('');
    var transactionId = ref('');

    onMounted(() => {
        chrome.storage.local.set({ 'e_tsena_state': 'checkout' });
    });

    // Pour initialiser une transaction avec Mvola
    const initTransaction = () => {
        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                const { token } = result.jwt;
                const transactionData = {
                    amount: '20000',
                    descriptionText: 'Test paiement',
                    debitPartyMsisdn: '0343500003'
                };

                try {
                    const response = await fetch(import.meta.env.VITE_URL_MVOLAINIT, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(transactionData)
                    });
                    if (!response.ok)
                        throw new Error(`HTTP error! status: ${response.status}`);

                    const data = await response.json();
                    if (data.serverCorrelationId) {
                        serverCorrelationId.value = data.serverCorrelationId;
                        console.log('Successfull Transaction');
                    }
                } catch(error) {
                    console.error(`Error Init transaction: ${error}`);
                }
            }
        })
    }

    // Pour vérifier le status d'une transaction
    const transactionStatus = () => {
        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                const { token } = result.jwt;

                try {
                    const response = await fetch(import.meta.env.VITE_URL_MVOLASTATUS + serverCorrelationId.value, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    })
                    if (!response.ok)
                        throw new Error(`Failed to fetch transaction status ${response.status}`);
                    
                    const data = await response.json();
                    if (data.objectReference) {
                        transactionId.value = data.objectReference;
                        console.log('Transaction status:', data.status);
                    }
                } catch(error) {
                    console.error(`Error fetching transaction status: ${error}`);
                };
            }
        })
    }

    // Pour vérifier les détails d'une transaction
    const transactionDetails = () => {
        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                const { token } = result.jwt;

                try {
                    const response = await fetch(import.meta.env.VITE_URL_MVOLADETAILS + transactionId.value, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    })
                    if (!response.ok)
                        throw new Error(`Failed to fetch transaction details ${response.status}`);

                    const data = await response.json();
                    if (data) console.log('Transaction Details:', data);
                } catch(error) {
                    console.error(`Error fetching transaction details: ${error}`);
                };
            }
        })
    }
</script>

<template>
    <div class="payement">
        <h1>Test de l'API Mvola</h1>
        <button id="submit" @click="initTransaction">Initier la transaction</button>
        <button id="status" @click="transactionStatus">Vérifier le status de la transaction</button>
        <button id="details" @click="transactionDetails">Vérifier les détails de la transaction</button>
    </div>
</template>

<style scoped lang="scss">
    @use '../style';

    .payement {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        background-color: style.$background-color;
        min-width: 400px;
        min-height: 500px;
    }
</style>