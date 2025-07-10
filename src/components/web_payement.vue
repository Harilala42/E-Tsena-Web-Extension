<script setup>
    import { ref, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { useCounterStore } from '@/stores/currency';

    const router = useRouter();
    const sum = useCounterStore();

    var transactionStatus = ref(null);
    var serverCorrelationId = ref(null);
    var transactionId = ref(null);

    onMounted(() => {
        chrome.storage.local.set({ 'e_tsena_state': 'checkout' });
    });

    var pollingInterval = null;
    const handleTransaction = () => {
        pollingInterval = setInterval(async () => {
            await checkTransactionStatus();
            if (transactionStatus.value === 'completed' || transactionStatus.value === 'failed') 
            {
                clearInterval(pollingInterval);
                pollingInterval = null;
                if (transactionStatus.value === 'completed') {
                    chrome.notifications.create("successMvola", {
                        type: "basic",
                        iconUrl: "/icons/mvola.png",
                        title: "✅ Successful Mvola Transaction ✅",
                        message: `Montant ${sum.amountWithDots}MGA payé avec succès.`
                    });
                    chrome.storage.local.set({ cart: JSON.stringify([]) });
                } else {
                    chrome.notifications.create("failureMvola", {
                        type: "basic",
                        iconUrl: "/icons/mvola.png",
                        title: "❌ Failure Mvola Transaction ❌",
                        message: 'Echec de la Transaction! Annulation de la commande.'
                    });
                }
                setTimeout(() => router.push('/shopping_cart'), 5000);
            }
        }, 5000);
    }

    // Pour initialiser une transaction avec Mvola
    const initTransaction = () => {
        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                const { token } = result.jwt;
                const transactionData = {
                    amount: Number(sum.amount).toFixed(0),
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
                        handleTransaction();
                    }
                } catch(error) {
                    console.error(`Error Init transaction: ${error}`);
                    chrome.notifications.create("failureInitMvola", {
                        type: "basic",
                        iconUrl: "/icons/mvola.png",
                        title: "❌ Canceled Mvola Transaction ❌",
                        message: "Impossible d'initiliatiser la transaction 😓."
                    });
                }
            }
        })
    }

    // Pour vérifier le status d'une transaction
    const checkTransactionStatus = async () => {
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
                    if (data.objectReference)
                        transactionId.value = data.objectReference;
                    transactionStatus.value = data.status;
                } catch(error) {
                    console.warn(`Error fetching transaction status: ${error}`);
                    transactionStatus.value = 'failed';
                };
            }
        })
    }
</script>

<template>
    <div class="payement">
        <h1>Test de l'API Mvola</h1>
        <button id="submit" @click="initTransaction">Initier la transaction</button>
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