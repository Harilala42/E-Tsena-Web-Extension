<script setup>
    import { ref, onMounted } from 'vue';

    onMounted(() => {
        chrome.storage.local.set({ 'e_tsena_state': 'order-tracking' });
    });
</script>

<template>
    <div class="title">
        <div class="icon-title">
            <img src="/icons/clock.svg" alt="clock">
            <h1 class="text">Suivi de Commande</h1>
        </div>
    </div>
    <div class="horizontal-bar"></div>
</template>

<style scoped lang="scss">
    @use '../style';

    .title {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        margin-bottom: 5px;
        width: 350px;

        .icon-title {
            display: flex;
            flex-direction: row;
            gap: 5px;

            img {
                width: 24px;
                height: 24px;
            }

            .text {
                font-weight: 800;
                font-size: 20px;
                color: style.$text-color;
                font-family: style.$font-MontserratAlternates-Bold;
            }
        }
    }

    .horizontal-bar {
        width: 350px;
        height: 1px;
        background-color: style.$text-color;
        margin-bottom: 10px;
    }
</style>