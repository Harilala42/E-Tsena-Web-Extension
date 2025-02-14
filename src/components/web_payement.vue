<script>
    import { ref } from 'vue';

    function initTransaction() {
        const transactionData = {
            amount: '20000',
            descriptionText: 'Test paiement',
            debitPartyMsisdn: '0343500003'
        };

        // Pour initialiser une transaction avec Mvola
        fetch('https://e-tsena-dropshipping.onrender.com/mvolaPayement/webpayement/initTransaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transactionData)
        })
        .then(response => response.json())
        .then(data => {
            serverCorrelationId = data.serverCorrelationId;
            console.log('Transaction réussie');
        })
        .catch(error => {
            console.error('Erreur lors de la transaction:', error);
        });
    }

    function transactionStatus() {
        // Pour vérifier le status d'une transaction
        fetch(`https://e-tsena-dropshipping.onrender.com/mvolaPayement/webpayement/transactionStatus/${serverCorrelationId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => {
            if (!response.ok)
                throw new Error('Failed to fetch transaction status');
            return response.json();
        })
        .then(data => {
            transactionId = data.objectReference;
            console.log('Transaction status:', data.status);
        })
        .catch(error => {
            console.error('Error fetching transaction status:', error);
        });
    }

    function transactionDetails() {
        // Pour vérifier les détails d'une transaction
        fetch(`https://e-tsena-dropshipping.onrender.com/mvolaPayement/webpayement/transactionDetails/${transactionId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => {
            if (!response.ok)
                throw new Error('Failed to fetch transaction status');
            return response.json();
        })
        .then(data => {
            console.log('Transaction Details:', data);
        })
        .catch(error => {
            console.error('Error fetching transaction details:', error);
        });
    }
</script>

<template>
    <h1>Test de l'API Mvola</h1>
    <button id="submit" @click="initTransaction">Initier la transaction</button>
    <button id="status" @click="transactionStatus">Vérifier le status de la transaction</button>
    <button id="details" @click="transactionDetails">Vérifier les détails de la transaction</button>
</template>

<style scoped>
    * {
        margin: 0;
        padding: 0;
    }
</style>