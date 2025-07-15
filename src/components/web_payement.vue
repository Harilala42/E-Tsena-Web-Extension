<script setup>
    import { ref, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { useCounterStore } from '@/stores/currency';

    const router = useRouter();
    const sum = useCounterStore();
    const recaptchaUrl = import.meta.env.VITE_URL_RECATPCHA;
    const paymentMethods = ref([
        { id: 'mvola', name: 'Mvola', icon: '/icons/mvola_lg.png' },
        { id: 'orange money', name: 'Orange Money', icon: '/icons/orange_money_lg.png' }
    ]);

    var recaptchaToken = ref(null);
    var transactionStatus = ref(null);
    var serverCorrelationId = ref(null);
    var transactionId = ref(null);

    const selectedMethod = ref(null);
    const selectMethod = id => selectedMethod.value = id;

    onMounted(() => {
        chrome.storage.local.set({ 'e_tsena_state': 'checkout' });

        window.addEventListener("message", (event) => {
            if (event.data?.type === "recaptcha-token")
                recaptchaToken.value = event.data.token;
        });
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
                recaptchaToken.value = null;
                transactionStatus.value = null;
                setTimeout(() => router.push('/shopping_cart'), 3000);
            }
        }, 5000);
    }

    // Pour initialiser une transaction avec Mvola
    const initTransaction = () => {
        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                const { token } = result.jwt;
                transactionStatus.value = 'pending';

                try {
                    const response = await fetch(import.meta.env.VITE_URL_MVOLAINIT, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            amount: Number(sum.amount).toFixed(0),
                            descriptionText: 'Test paiement',
                            debitPartyMsisdn: '0343500003',
                            token: recaptchaToken.value
                        })
                    });
                    if (!response.ok)
                        throw new Error(`HTTP error! status: ${response.status}`);

                    const data = await response.json();
                    if (data.serverCorrelationId) {
                        serverCorrelationId.value = data.serverCorrelationId;
                        handleTransaction();
                    }
                } catch(error) {
                    recaptchaToken.value = null;
                    transactionStatus.value = null;
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
        <div class="options">
            <h2>Mode de Paiement</h2>
            <div class="list">
                <div v-for="method in paymentMethods"
                    :key="method.id" class="card"
                    @click="selectMethod(method.id)"
                >
                    <img :src="method.icon" :alt="method.name" class="card-icon" />
                    <img class="selected" 
                        src="/icons/selected.svg"
                        v-if="selectedMethod === method.id"
                        alt="selected"
                    >
                </div>
            </div>
        </div>
        <iframe class="recaptcha" :src="recaptchaUrl" width="100%" height="125px"/>
        <div class="actions">
            <router-link class="cancel" to="/shopping_cart">Annuler</router-link>
            <button :disabled="!recaptchaToken || transactionStatus"
                :class="{ 'enabled_pay': recaptchaToken && !transactionStatus, 'unenabled_pay': !recaptchaToken || transactionStatus }"
                @click="initTransaction"
            >
                <p>Payer</p>
                <span v-if="transactionStatus === 'pending'" class="load_pay"></span>
                <img v-else src="/icons/arrow_right.svg" alt="payer maintenant">
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

                    img {
                        width: 30px;
                        height: 30px;
                    }
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

        @mixin flex-shared {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .options {
            width: 100%;
            @include flex-shared;
            flex-direction: column;
            
            gap: 10px;

            h2 {
                color: style.$text-color;
                font-family: style.$font-MontserratAlternates-Bold;
                font-size: 20px;
            }

            .list {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                gap: 15px;

                .card {
                    width: 100px;
                    height: 50px;
                    position: relative;
                    border: 1px solid style.$text-color;
                    @include flex-shared;
                    border-radius: 15px;
    
                    .card-icon {
                        width: 100px;
                        height: 100px;
                    }

                    .selected {
                        width: 20px;
                        height: 20px;
                        position: absolute;
                        inset: 1% 1% auto auto;
                        z-index: 1;
                    }
                }
            }
        }

        .recaptcha { border: none; }

        .actions {
            @include flex-shared;
            gap: 20px;

            @mixin button-shared {
                width: 100px;
                height: 35px;
                font-size: 12px;
                border-radius: 10px;
                color: style.$text-color;
                text-decoration: none;
                font-family: style.$font-Poppins-Bold, sans-serif;
            }

            .cancel {
                @include flex-shared;
                @include button-shared;
                border: 1px solid style.$primary-color;
                background-color: transparent;
                cursor: pointer;
            }

            .enabled_pay {
                border: none;
                background-color: style.$primary-color;
                @include button-shared;
                @include flex-shared;
                cursor: pointer;
                gap: 5px;
            }

            .unenabled_pay {
                border: none;
                background-color: #ca6037;
                @include button-shared;
                @include flex-shared;
                gap: 5px;
            }

            .load_pay {
                width: 15px;
                height: 15px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
        }
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>