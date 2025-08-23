<script setup>
    import { ref, computed, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { useCounterStore } from '@/stores/currency';
    import { useOrderStore } from '@/stores/order';

    const router = useRouter();
    const sum = useCounterStore();
    const order = useOrderStore();
    
    const recaptchaUrl = import.meta.env.VITE_URL_TURNSTILE;
    const paymentMethods = ref([
        { id: 'mvola', name: 'Mvola', icon: '/icons/mvola_lg.png' },
        { id: 'orange money', name: 'Orange Money', icon: '/icons/orange_money_lg.png' }
    ]);

    var recaptchaToken = ref(null);
    var istransactionInProgress = ref(false);
    var serverCorrelationId = ref(null);
    var transactionId = ref(null);
    var currentCart = ref([]);

    const selectedMethod = ref('mvola');
    const selectMethod = id => selectedMethod.value = id;

    onMounted(async () => {
        chrome.storage.local.set({ 'e_tsena_state': 'checkout' });
        currentCart.value = await order.prepareOrder();

        window.addEventListener("message", (event) => {
            if (event.data?.type === "turnstileToken")
                recaptchaToken.value = event.data.token;
        });
    });

    const isPayButtonEnabled = computed(() =>
        recaptchaToken.value && !istransactionInProgress.value && selectedMethod.value
    );

    const notifySuccess = (message, callback) => {
        chrome.notifications.create("successMvola", 
        {
            type: "basic",
            iconUrl: "/icons/mvola.png",
            title: "✅ Successful Mvola Transaction ✅",
            message
        }, callback);
    }

    const notifyFailure = (message, callback) => {
        chrome.notifications.create("failureMvola", 
        {
            type: "basic",
            iconUrl: "/icons/mvola.png",
            title: "❌ Failure Mvola Transaction ❌",
            message
        }, callback);
    }

    // Pour vérifier le status d'une transaction
    const checkTransactionStatus = (token) => {
        return fetch(import.meta.env.VITE_URL_MVOLASTATUS + serverCorrelationId.value, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    }

    // Initialisation d'une commande AliExpress
    const createOrderAE = (referenceId, token) => {
        return fetch(import.meta.env.VITE_URL_CREATEORDER_AE, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transactionID: referenceId,
                shoppingCart: currentCart.value
            })
        });
    }

    const resetState = () => {
        recaptchaToken.value = null;
        istransactionInProgress.value = false;
    }

    var orderInterval = null;
    const handleOrderCreation = (token) => {
        let isOrderCreated = false;
        const startTime = Date.now();
        orderInterval = setInterval(async () => {
            if (Date.now() - startTime > 2 * 60 * 1000) {
                clearInterval(orderInterval);
                orderInterval = null;
                return console.error('Order creation timed out.');
            }

            if (isOrderCreated) return ;
            isOrderCreated = true;

            try {
                const res = await createOrderAE(transactionId.value, token);
                if (res.status === 200) {
                    clearInterval(orderInterval);
                    orderInterval = null;

                    resetState();
                    notifySuccess(
                        `Montant ${sum.amountWithDots}MGA payé avec succès.`,
                        () => {
                            chrome.storage.local.set({ cart: JSON.stringify([]) });
                            setTimeout(() => router.push('/shopping_cart'), 3000);
                        }
                    );
                }
            } catch(err) {
                console.error('Failed to create order: ', err);
            } finally {
                isOrderCreated = false;
            }
        }, 5000);
    }

    var pollingInterval = null;
    const handleTransaction = (token) => {
        const startTime = Date.now();
        pollingInterval = setInterval(async () => {
            if (Date.now() - startTime > 3 * 60 * 1000) {
                clearInterval(pollingInterval);
                pollingInterval = null;

                resetState();
                return notifyFailure(
                    'Transaction trop longue ⏳.',
                    () => setTimeout(() => router.push('/shopping_cart'), 3000)
                );
            }

            try {
                const res = await checkTransactionStatus(token);
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

                const data = await res.json();
                if (data.objectReference) transactionId.value = data.objectReference;

                const status = data.status;
                if (status === 'completed' || status === 'failed') {
                    clearInterval(pollingInterval);
                    pollingInterval = null;

                    if (status === 'completed') {
                        handleOrderCreation(token);
                    } else {
                        resetState();
                        notifyFailure(
                            'Echec de la Transaction! Annulation de la commande 😓.',
                            () => setTimeout(() => router.push('/shopping_cart'), 3000)
                        );                    
                    }
                }
            } catch (error) {
                console.error("Error checking transaction status:", error);
            }
        }, 10000);
    };

    // Pour initialiser une transaction avec Mvola
    const initTransaction = () => {
        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                const { token } = result.jwt;
                istransactionInProgress.value = true;

                try {
                    const response = await fetch(import.meta.env.VITE_URL_MVOLAINIT, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            amount: Number(sum.amount).toFixed(0),
                            token: recaptchaToken.value
                        })
                    });
                    if (!response.ok)
                        throw new Error(`HTTP error! status: ${response.status}`);

                    const data = await response.json();
                    if (data.serverCorrelationId) {
                        serverCorrelationId.value = data.serverCorrelationId;
                        handleTransaction(token);
                    }
                } catch(error) {
                    console.error(`Error Init transaction: ${error}`);

                    resetState();
                    notifyFailure(
                        "Impossible d'initier la transaction 😓.",
                        () => setTimeout(() => router.push('/shopping_cart'), 3000)
                    );
                }
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
            <button :disabled="!isPayButtonEnabled"
                :class="{ 'enabled_pay': isPayButtonEnabled, 'unenabled_pay': !isPayButtonEnabled }"
                @click="initTransaction"
            >
                <p>Payer</p>
                <span v-if="istransactionInProgress" class="load_pay"></span>
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
                    overflow: hidden;
                    cursor: pointer;
    
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

                .load_pay {
                    width: 15px;
                    height: 15px;
                    border: 2px solid #f3f3f3;
                    border-top: 2px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                &:hover { cursor: not-allowed; }
                &:has(.load_pay) { cursor: wait; }
            }
        }
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>