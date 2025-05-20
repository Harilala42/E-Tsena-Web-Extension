<script setup>
    import { ref, onMounted } from 'vue';

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
            }
        });
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
                        <p>{{ user.email }}</p>
                    </div>
                </button>
            </div>
        </div>
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
    }
</style>