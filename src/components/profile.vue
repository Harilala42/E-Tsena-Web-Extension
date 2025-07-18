<script setup>
    import { ref, computed, onMounted } from 'vue';
    import { useRouter } from 'vue-router';

    const router = useRouter();

    var address = ref('');
    var numberPhone = ref('');
    var user = ref({
        picture: '',
        name: '',
        email: ''
    });

    onMounted(() => {
        chrome.storage.local.set({ 'e_tsena_state': 'profile' });

        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                const { token, userInfo } = result.jwt;

                user.value.picture = userInfo.picture;
                user.value.name = userInfo.name;
                user.value.email = userInfo.email;

                try {
                    const response = await fetch(import.meta.env.VITE_URL_GETUSERINFO, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok)
                        return console.error(`HTTP error! status: ${response.status}`);
    
                    const data = await response.json();
    
                    address.value = data.delivery_address;
                    numberPhone.value = data.physical_contact;
                } catch(error) {
                    console.error('Failed getting user\'s info:', error);
                }
            }
        });
    });

    watch(address, (newVal) => {
        
    });

    watch(numberPhone, (newVal) => {
        
    });

    const truncatedEmail = computed(() => {
        const email = user.value.email;
        if (email.length <= 30)
            return email;

        const [localPart, domain] = email.split('@');

        const firstPart = localPart.slice(0, 7);
        const lastPart = localPart.slice(-7);

        return `${firstPart}...${lastPart}@${domain}`;
    });

    const logoutUser = () => {
        chrome.storage.local.remove('jwt', () => {
            if (chrome.runtime.lastError)
                console.error('Error during remove token', chrome.runtime.lastError);
            else {
                console.warn('Token is removed');
                chrome.storage.local.set({ 'isAlreadyAuthorize': 'denied' });
                chrome.notifications.create("logoutUser", {
                    type: "basic",
                    iconUrl: "/icons/check_circle.svg",
                    title: `✅ Successful Google Logout ✅`,
                    message: 'Votre compte Google est déconnecté.'
                });
            }
        });
    }

    const handleSubmit = () => {
        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                const { token } = result.jwt;

                try {
                    const response = await fetch(import.meta.env.VITE_URL_SETUSERINFO, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            delivery_address: address.value,
                            physical_contact: numberPhone.value
                        })
                    });
                    if (!response.ok)
                        return console.error(`HTTP error! status: ${response.status}`);
    
                    chrome.notifications.create("updatedContact", {
                            type: "basic",
                            iconUrl: "/icons/check_circle.svg",
                            title: `✅ User's Info successfully updated ✅`,
                            message: 'Mise à jour des informations personnelles.'
                        },
                        (notificationId) => router.push('/shopping_cart')
                    );
                } catch(error) {
                    console.error('Failed getting user\'s info:', error);
                }
            }
        })
    }
</script>

<template>
    <div class="container">
        <div class="title">
            <div class="icon-title">
                <img src="/icons/person.svg" alt="profile">
                <h1 class="text">Profile</h1>
            </div>
        </div>
        <div class="horizontal-bar"></div>
        <div class="user">
            <div class="profile"
                :style="{ 'background-image': user.picture ? `url('${user.picture}')` : 'none' }"
            ></div>
            <div class="info">
                <h2>{{ user.name }}</h2>
                <button class="logout" @click="logoutUser()">
                    <img src="/icons/google_lg.svg" alt="google logout">
                    <div class="google">
                        <p>Délier mon compte</p>
                        <p>{{ truncatedEmail }}</p>
                    </div>
                </button>
            </div>
        </div>
        <form class="form" @submit.prevent="handleSubmit">
            <div class="adress">
                <div class="title">
                    <div class="info">
                        <img src="/icons/location.svg" alt="addresse de livraison">
                        <h2>Addresse de Livraison</h2>
                    </div>
                    <button class="edit">
                        <img src="/icons/edit_square.svg" alt="">
                    </button>
                </div>
                <input type="text" v-model="address" :value="address" placeholder="">
            </div>
            <div class="phone">
                <div class="title">
                    <div class="info">
                        <img src="/icons/phone.svg" alt="contact physique">
                        <h2>Numéro de Téléphone</h2>
                    </div>
                    <button class="edit">
                        <img src="/icons/edit_square.svg" alt="">
                    </button>
                </div>
                <input type="text" v-model="numberPhone" :value="numberPhone" placeholder="">
            </div>
            <div class="action">
                <router-link class="cancel" to="/shopping_cart">Annuler</router-link>
                <button type="submit"
                    :disabled="!address || !numberPhone"
                    :class="{ 'record': address || numberPhone, 'disabled-record': !address || !numberPhone }"
                >
                    <img src="/icons/save.svg" alt="enregistrer">
                    <p>Enregistrer</p>
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped lang="scss">
    @use '../style';

    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        background-color: style.$background-color;
        min-width: 400px;
        min-height: 500px;
        padding: 0;

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
            margin-bottom: 25px;
        }

        .user {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            width: 350px;
            gap: 10px;

            .profile {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }

            .info {
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                width: 250px;
                gap: 5px;

                h2 {
                    font-weight: bold;
                    font-size: 20px;
                    font-family: style.$font-MontserratAlternates-Bold;
                    color: style.$text-color;
                }

                button {
                    border: none;
                    display: flex;
                    border-radius: 50px;
                    flex-direction: row;
                    align-items: center;
                    justify-content: flex-start;
                    background-color: style.$secondary-color;
                    padding-left: 5px;
                    min-width: 200px;
                    min-height: 50px;

                    img {
                        width: 45px;
                        height: 45px;
                        background-size: cover;
                        background-position: center;
                        background-repeat: no-repeat;
                    }

                    .google {
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-end;
                        text-align: left;
                        font-size: 12px;
                        font-weight: bold;
                        font-family: style.$font-Roboto;
                        color: style.$text-color;
                        padding: 10px 0;
                        cursor: pointer;

                        p {
                            display: flex;
                            flex-wrap: nowrap;
                            max-width: 200px;
                        }
                    }
                }
            }
        }

        .form {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-top: 15px;
            gap: 15px;

            .title {
                display: flex;
                flex-direction: row;
                justify-content: space-between;

                @mixin shared_img {
                    width: 24px;
                    height: 24px;
                }

                .info {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 5px;

                    img { @include shared_img; }

                    h2 {
                        font-size: 18px;
                        font-family: style.$font-MontserratAlternates-Bold;
                        color: style.$text-color;
                    }
                }

                .edit {
                    border: none;
                    background-color: transparent;
                    cursor: pointer;

                    img { @include shared_img; }
                }
            }

            
            input[type="text"] {
                width: 95%;
                height: 30px;
                border: none;
                font-size: 12px;
                border-radius: 5px;
                color: style.$secondary-color;
                font-family: style.$font-Poppins-Regular;
                background-color: style.$text-color;
                padding-left: 15px;

                &::placeholder {
                    font-size: 12px;
                    color: style.$secondary-color;
                    font-family: style.$font-Poppins-Regular;
                }

                &:focus {
                    box-shadow: none;
                    outline: none;
                    border: none;
                }
            }

            .action {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                width: 100%;
                gap: 10px;

                @mixin button-shared {
                    height: 35px;
                    min-width: 75px;
                    font-size: 12px;
                    border-radius: 10px;
                    color: style.$text-color;
                    font-family: style.$font-Poppins-Bold, sans-serif;
                    text-decoration: none;
                    padding: 0 10px;
                }

                .cancel {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    @include button-shared;
                    border: 1px solid style.$primary-color;
                    background-color: transparent;
                    cursor: pointer;
                }

                @mixin record_shared {
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                }

                .record {
                    @include record_shared;
                    @include button-shared;
                    background-color: style.$primary-color;
                    cursor: pointer;
                }

                .disabled-record {
                    @include record_shared;
                    @include button-shared;
                    background-color: #CA6037;
                    cursor: not-allowed;
                }
            }
        }
    }
</style>