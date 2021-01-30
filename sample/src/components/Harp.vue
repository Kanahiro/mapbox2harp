<template>
    <div id="wrapper">
        harp.gl
        <canvas id="mapCanvas" />
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted } from 'vue';

import { MapView } from '@here/harp-mapview';
import { MapControls, MapControlsUI } from '@here/harp-map-controls';
import { GeoCoordinates, sphereProjection } from '@here/harp-geoutils';
import { OmvDataSource, APIFormat } from '@here/harp-omv-datasource';
import { Theme } from '@here/harp-datasource-protocol';

import mapbox2harp from '../../../src';
import { mapstyle } from './style';

export default defineComponent({
    name: 'Harp',
    props: {},
    setup(props, context) {
        const theme = mapbox2harp(mapstyle as mapboxgl.Style, 'osm');
        console.log(theme);
        onMounted(() => {
            const canvas = document.getElementById(
                'mapCanvas',
            ) as HTMLCanvasElement;

            // instantiate MapView
            const map = new MapView({
                canvas: canvas,
                theme: theme as Theme,
                projection: sphereProjection,
                target: new GeoCoordinates(35.68, 139.77),
                zoomLevel: 13.3,
                minZoomLevel: 5,
                maxZoomLevel: 18,
            });

            // add controls
            const controls = new MapControls(map);

            // add vectortile datasource
            // https://tile.openstreetmap.jp/data/japan/{z}/{x}/{y}.pbf
            const dataSource = new OmvDataSource({
                baseUrl: 'https://tile.openstreetmap.jp/data/japan',
                apiFormat: APIFormat.TomtomV1,
                styleSetName: 'osm',
            });
            map.addDataSource(dataSource);
        });
    },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
#mapCanvas {
    height: 100%;
    width: 100%;
}
</style>
