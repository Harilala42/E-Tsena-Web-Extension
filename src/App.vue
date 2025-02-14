<script setup>
    import { ref } from 'vue';

    function authentication() {
        chrome.identity.getAuthToken({interactive: true}, async (token) => {
            console.log(token);
            try {
                const response = await fetch('https://e-tsena-dropshipping.onrender.com/googleOauth20/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessToken: token })
                });

                if (!response.ok)
                    throw new Error(`HTTP error! status: ${user.status}`);

                const data = await response.json();
                console.log('Result\'s request:', data);
            } catch (error) {
                throw Error("Error durring Send Token: " + error);
            }
        });
    }
</script>

<template>
    <div id="customBtn" @click="authentication">
        <span class="icon"></span>
        <span class="buttonText">Sign with Google</span>
    </div>
</template>

<style scoped>
    #customBtn {
        display: inline-block;
        background: white;
        color: #444;
        width: 190px;
        border-radius: 5px;
        border: thin solid #888;
        box-shadow: 1px 1px 1px grey;
        white-space: nowrap;
    }
    #customBtn:hover {
        cursor: pointer;
    }
    span.icon {
        background: url('/icons/google_lg.svg') transparent 5px 50% no-repeat;
        display: inline-block;
        vertical-align: middle;
        width: 42px;
        height: 42px;
    }
    span.buttonText {
        display: inline-block;
        vertical-align: middle;
        padding-left: 10px;
        font-size: 14px;
        font-weight: bold;
        font-family: 'Roboto', sans-serif;
    }
</style>