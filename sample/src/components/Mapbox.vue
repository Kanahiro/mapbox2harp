<template>
    <div>
        Mapbox GL JS
        <div id="mapContainer">aaaaaaa</div>
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted } from 'vue';
import { mapstyle } from './style';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
export default defineComponent({
    name: 'Harp',
    props: {},
    setup(props, context) {
        onMounted(() => {
            const map = new mapboxgl.Map({
                container: 'mapContainer',
                style: mapstyle as mapboxgl.Style,
                center: [139.77, 35.68],
                zoom: 12,
                minZoom: 1,
            });
            map.on('click', function(e) {
                console.log(
                    mapstyle.layers.map((layer) => {
                        return layer.id;
                    }),
                );
                // クリックしたポイントにあるoverlayLayers全ての地物を抽出
                const features = map.queryRenderedFeatures(e.point, {
                    layers: mapstyle.layers.map((layer) => {
                        return layer.id;
                    }),
                });
                console.log(features);
            });
        });
    },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
#mapContainer {
    height: 100%;
    width: 100%;
}
</style>
