import {
    Theme,
    Styles,
    Style,
    StyleAttributes,
    Technique,
} from '@here/harp-datasource-protocol';

import { gsiStyle } from './fixture';

interface MapboxVectorTileLayer extends mapboxgl.Layer {
    source: string;
    'source-layer': string;
    type: 'symbol' | 'circle' | 'line' | 'fill' | 'fill-extrusion';
}

const fixture = gsiStyle as mapboxgl.Style;

console.log(JSON.stringify(mapbox2harp(fixture, 'test')));

function mapbox2harp(
    mapboxStyle: mapboxgl.Style,
    styleName: string,
): Theme | null {
    if (mapboxStyle.sources === undefined || mapboxStyle.layers === undefined) {
        return null;
    }

    const vectorTileSources = Object.keys(mapboxStyle.sources).filter(
        (sourceId) => {
            mapboxStyle.sources![sourceId].type === 'vector';
        },
    );

    let styles: Array<Style> = [];
    mapboxStyle.layers.forEach((layer) => {
        if (vectorTileSources.includes((layer as any).source)) {
            return;
        }
        if (layer.type === 'symbol') {
            return;
        }
        styles.push(mbLayer2harpStyle(layer as MapboxVectorTileLayer));
    });

    const harpStyle: Theme = {
        styles: {},
    };
    harpStyle.styles![styleName] = styles;
    return harpStyle;
}

function mbLayer2harpStyle(mapboxLayer: MapboxVectorTileLayer): Style {
    const style: Style = {
        id: mapboxLayer.id,
        technique: getHarpTechniqueNameBy(mapboxLayer),
        color: getHarpColorBy(mapboxLayer) as string,
        layer: mapboxLayer['source-layer'],
    };
    return style;
}

function getHarpTechniqueNameBy(
    mapboxLayer: MapboxVectorTileLayer,
):
    | 'squares'
    | 'circles'
    | 'labeled-icon'
    | 'line-marker'
    | 'line'
    | 'segments'
    | 'solid-line'
    | 'dashed-line'
    | 'label-rejection-line'
    | 'fill'
    | 'standard'
    | 'extruded-line'
    | 'extruded-polygon'
    | 'text'
    | 'shader'
    | 'terrain' {
    switch (mapboxLayer.type) {
        case 'symbol':
            return 'circles';
        case 'circle':
            return 'circles';
        case 'line':
            return 'line';
        case 'fill':
            return 'fill';
        case 'fill-extrusion':
            return 'extruded-polygon';
    }
}

function getHarpColorBy(
    mapboxLayer: MapboxVectorTileLayer,
): string | mapboxgl.StyleFunction | mapboxgl.Expression | undefined {
    if (mapboxLayer.paint === undefined) {
        return '#000000';
    }
    const color = (mapboxLayer.paint as any)[`${mapboxLayer.type}-color`];
    return color !== undefined ? color : '#000000';
