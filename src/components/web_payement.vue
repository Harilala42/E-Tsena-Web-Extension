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
        <div class="warning">
            <h2>Passer Commande</h2>
            <p>Toutes vos informations sont protégées par des protocoles de sécurité avancés. Si vous avez des questions ou des préoccupations, notre service client est disponible pour vous assister.</p>
        </div>
        <div class="amount">
            <div class="icon">
                <div class="credit_cart">
                    <img src="/icons/credit_cart.svg" alt="montant de la transaction">
                </div>
                <h2>Montant <br>de la Transaction</h2>
            </div>
            <div class="sum">
                <p>Ar</p>
                <h1>{{ sum.amountWithDots }}</h1>
            </div>
        </div>
        <div class="actions">
            <button class="cancel" @click="router.push('/shopping_cart')">Annuler</button>
            <button class="pay" @click="initTransaction">
                <p>Payer</p>
                <img src="/icons/arrow_right.svg" alt="payer avec Mvola">
            </button>
        </div>
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
        gap: 15px;

        .warning {
            width: 350px;

            h2 {
                color: #F4AC0F;
                font-family: style.$font-MontserratAlternates-Bold;
                font-size: 15px;
            }

            p {
                color: style.$text-color;
                font-family: style.$font-Poppins-Regular;
                font-size: 12px;
            }
        }

        .amount {
            min-width: 350px;
            height: 60px;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-around;
            background-color: #430346;
            border: solid 1px style.$primary-color;
            padding: 0 5px;
            border-radius: 5px;

            .icon {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: flex-start;
                gap: 8px;

                .credit_cart {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background-color: style.$primary-color;
                    border-radius: 5px;
                }

                h2 {
                    color: style.$text-color;
                    font-family: style.$font-MontserratAlternates-Bold;
                    font-size: 15px;
                }
            }

            .sum {
                display: flex;
                flex-direction: row;
                align-content: flex-start;
                color: style.$text-color;
                font-family: style.$font-Poppins-Bold;
                gap: 5px;

                p { font-size: 15px; }
                h1 { font-size: 25px; }
            }
        }

        .actions {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;

            @mixin button-shared {
                width: 100px;
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

            .pay {
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: style.$primary-color;
                @include button-shared;
                gap: 5px;
            }
        }
    }
</style>