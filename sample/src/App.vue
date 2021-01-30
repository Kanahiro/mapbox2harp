<template>
    <div id="wrapper">
        <Mapbox id="mapbox" />
        <Harp id="harp" />
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Harp from './components/Harp.vue';
import Mapbox from './components/Mapbox.vue';

export default defineComponent({
    name: 'App',
    components: {
        Harp,
        Mapbox,
    },
});
</script>

<style scoped>
#wrapper {
    height: 1000px;
}
#harp {
    height: 100%;
    width: 50%;
    display: inline-block;
}
#mapbox {
    height: 100%;
    width: 50%;
    display: inline-block;
}
</style>
