<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import { useRouter } from 'vue-router';

    const router = useRouter();

    var warning = ref('');
    var isEmptyField = ref(false);
    var isFormSubmited = ref(false);
    var address = ref({
        isUpdated: false,
        content: ''
    });
    var numberPhone = ref({
        isUpdated: false,
        content: ''
    });
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
                        throw new Error(`HTTP error! status: ${response.status}`);
    
                    const data = await response.json();
    
                    address.value.content = data.delivery_address;
                    numberPhone.value.content = data.physical_contact;
                } catch(error) {
                    chrome.notifications.create("failureGetInfo", {
                            type: "basic",
                            iconUrl: "/icons/warning.svg",
                            title: '❌ Network Error ❌',
                            message: "Echec des informations personnelles 😓."
                        },
                        (notificationId) => router.push('/shopping_cart')
                    );
                }
            }
        });
    });

    watch(address, (newVal) => {
        if (newVal.content.trim() === '')
            return isEmptyField.value = true;
        isEmptyField.value = false;

        if (newVal.content.length > 255)
            address.value.content = newVal.content.slice(0, 255);
    }, { deep: true });

    watch(numberPhone, (newVal) => {
        const isDigital = (str) => /^\d+$/.test(str);
        const phone = newVal.content.split(' ').join('');

        if (newVal.content === '') {
            warning.value = '';
            isEmptyField.value = true
            return ;
        }
        isEmptyField.value = false;

        if (!isDigital(phone))
            return warning.value = 'Seulement des nombres entre 0 - 9.';
        if (phone.length !== 10)
            return warning.value = 'Numéro de téléphone introuvable.';
        if (!phone.startsWith('034') && !phone.startsWith('038'))
            return warning.value = 'Opérateur pas encore prise en charge.';
        
        warning.value = '';
        numberPhone.value.content = newVal.content;
    }, { deep: true });

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

    const updateAddressInfo = (token, address) => {
        return fetch(import.meta.env.VITE_URL_SETADDRESSINFO, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                delivery_address: address
            })
        });
    }

    const updateContactInfo = (token, contact) => {
        return fetch(import.meta.env.VITE_URL_SETCONTACTINFO, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                physical_contact: contact.split(' ').join('')
            })
        });
    }

    const handleSubmit = () => {
        chrome.storage.local.get(['jwt'], async (result) => {
            if (result.jwt) {
                const { token } = result.jwt;
                isFormSubmited.value = true;

                try {
                    if (address.value.isUpdated) {
                        const responseAddress = await updateAddressInfo(token, address.value.content);
                        if (!responseAddress.ok)
                            throw new Error(`HTTP error! status: ${responseAddress.status}`);
                    }
                    if (numberPhone.value.isUpdated) {
                        const responseContact = await updateContactInfo(token, numberPhone.value.content);
                        if (!responseContact.ok)
                            throw new Error(`HTTP error! status: ${responseContact.status}`);
                    }

                    chrome.notifications.create("updatedInfo", {
                            type: "basic",
                            iconUrl: "/icons/check_circle.svg",
                            title: `✅ User's Info successfully updated ✅`,
                            message: 'Mise à jour des informations personnelles.'
                        },
                        (notificationId) => setTimeout(() => router.push('/shopping_cart'), 3000)
                    );
                } catch(error) {
                    isFormSubmited.value = false;
                    if (error.message.includes('status: 400')) {
                        chrome.notifications.create("canceledInfo", {
                            type: "basic",
                            iconUrl: "/icons/warning.svg",
                            title: `❌ Don't allowing same information(s) ❌`,
                            message: 'Informations identiques en entrée.'
                        });
                    } else {
                        chrome.notifications.create("failureInfo", {
                                type: "basic",
                                iconUrl: "/icons/warning.svg",
                                title: `❌ Failure to update user's data ❌`,
                                message: 'Un probleme est survenu. Veuillez réessayer!'
                            },
                            (notificationId) => console.error("Failed to update info user: ", error)
                        );
                    }
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
            <div class="address">
                <div class="title">
                    <div class="info">
                        <img src="/icons/location.svg" alt="addresse de livraison">
                        <h2>Adresse de Livraison</h2>
                    </div>
                    <button type="button" class="edit"
                        @click="address.isUpdated = !address.isUpdated"
                    >
                        <img src="/icons/edit_square.svg" alt="Modifier l'adresse">
                    </button>
                </div>
                <input type="text"
                    v-model="address.content" :value="address.content"
                    :class="{ 'enabled_address': address.isUpdated && !isFormSubmited, 'disabled_address': !address.isUpdated || isFormSubmited }"
                    placeholder="Enter a delivery address"
                    :disabled="!address.isUpdated || isFormSubmited"
                >
                <p :class="{ 'counter': address.content.length < 200, 'counter_warning': address.content.length >= 200, 'counter_error': address.content.length >= 255 }">
                    {{ address.content.length }}/255 caractères.
                </p>
            </div>
            <div class="phone">
                <div class="title">
                    <div class="info">
                        <img src="/icons/phone.svg" alt="contact physique">
                        <h2>Numéro Mobile Money</h2>
                    </div>
                    <button type="button" class="edit" 
                        @click="numberPhone.isUpdated = !numberPhone.isUpdated"
                    >
                        <img src="/icons/edit_square.svg" alt="Modifier le contact">
                    </button>
                </div>
                <vue-tel-input v-model="numberPhone.content"
                    :class="{ 'enabled_tel': warning === '' && numberPhone.isUpdated && !isFormSubmited, 'unabled_tel': !numberPhone.isUpdated || isFormSubmited, 'tel_error': warning !== '' }"
                    :default-country="'MG'" :only-countries="['MG']"
                    :disabled="!numberPhone.isUpdated || isFormSubmited"
                />
                <p class="error" v-if="warning !== ''">{{ warning }}</p>
            </div>
            <div class="action">
                <router-link class="cancel" to="/shopping_cart">Annuler</router-link>
                <button type="submit"
                    :disabled="(!address.isUpdated && !numberPhone.isUpdated) || warning !== '' || isEmptyField"
                    :class="{
                        'record': address.isUpdated || numberPhone.isUpdated,
                        'disabled-record':
                            (!address.isUpdated && !numberPhone.isUpdated)
                            || warning !== '' || isEmptyField || isFormSubmited
                    }"
                >
                    <span v-if="isFormSubmited" class="load_record"></span>
                    <img v-else src="/icons/save.svg" alt="enregistrer">
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
            margin-bottom: 20px;
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
            margin-top: 20px;
            gap: 15px;

            .title {
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                margin-bottom: 10px;

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
                        font-size: 20px;
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

            @mixin shared_input {
                font-size: 12px;
                border-radius: 5px;
                color: style.$secondary-color;
                font-family: style.$font-Poppins-Regular;
                background-color: style.$text-color;
                border: none;
            }

            .address {
                @mixin shared_address {
                    width: 95%;
                    height: 30px;
                    padding-left: 15px;
                }

                .enabled_address { 
                    @include shared_input;
                    @include shared_address;

                    &::placeholder {
                        font-size: 12px;
                        color: style.$secondary-color;
                        font-family: style.$font-Poppins-Regular;
                    }

                    &:hover, &:focus {
                        outline: none;
                        border-color: 1px solid rgb(52, 152, 219);
                        box-shadow: 0 0 5px 2px rgb(52, 152, 219);
                    }
                }

                .disabled_address {
                    font-size: 12px;
                    border-radius: 5px;
                    @include shared_address;
                    font-family: style.$font-Poppins-Regular;
                    background-color: rgb(239, 239, 239);
                    color: light-dark(rgb(84, 84, 84));
                    cursor: not-allowed;
                    border: none;
                }

                @mixin shared_counter {
                    font-size: 12px;
                    font-family: style.$font-Poppins-Regular;
                    padding-top: 5px;
                }

                .counter {
                    @include shared_counter;
                    color: style.$text-color;
                }

                .counter_warning {
                    color: #f4ac0f;
                    @include shared_counter;
                }

                .counter_error {
                    color: #ff0000;
                    @include shared_counter;
                }
            }

            .phone {
                width: 100%;

                @mixin shared_tel {
                    width: 100%;
                    height: 30px;
                    @include shared_input;

                    ::v-deep(.vti__dropdown-list) {
                        width: 300px !important;
                    }
                }

                .enabled_tel {
                    @include shared_tel;

                    &:hover,  &:focus {
                        outline: none;
                        border-color: rgb(52, 152, 219);
                        box-shadow: 0 0 5px 2px rgb(52, 152, 219);
                    }
                }

                .unabled_tel { @include shared_tel; }

                .tel_error {
                    @include shared_tel;
                    box-shadow: 0 0 5px 2px rgba(244, 172, 15, 0.5);
                }

                .error {
                    font-size: 12px;
                    color: #f4ac0f;
                    font-family: style.$font-Poppins-Regular;
                    padding-top: 5px;
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

                    .load_record {
                        width: 15px;
                        height: 15px;
                        border: 2px solid #f3f3f3;
                        border-top: 2px solid #3498db;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }

                    &:hover { cursor: not-allowed; }
                    &:has(.load_record) { cursor: wait; }
                }
            }
        }
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>