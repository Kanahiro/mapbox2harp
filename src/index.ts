import {
    Theme,
    Styles,
    Style,
    StyleAttributes,
    Technique,
    Expr,
} from '@here/harp-datasource-protocol';

import { ExpressionNames } from './defnitions';

const PX_TO_METER_MULTIPLIER = 3;

type MapboxVectorLayerType =
    | 'symbol'
    | 'circle'
    | 'line'
    | 'fill'
    | 'fill-extrusion';

interface MapboxVectorTileLayer extends mapboxgl.Layer {
    source: string;
    'source-layer': string;
    type: MapboxVectorLayerType;
}

type Expression = Array<number | string | Array<any>>;

export default function mapbox2harp(
    mapboxStyle: mapboxgl.Style,
    styleName: string,
): { [key: string]: Style[] } {
    if (mapboxStyle.sources === undefined || mapboxStyle.layers === undefined)
        throw Error('empty has no source or no layer.');

    const vectorSourceIds = Object.keys(mapboxStyle.sources).filter(
        (sourceId) => mapboxStyle.sources![sourceId].type === 'vector',
    );

    const styles: Array<Style> = (mapboxStyle.layers as MapboxVectorTileLayer[])
        .filter((layer) => vectorSourceIds.includes(layer.source))
        .map((layer) => mbLayer2harpStyle(layer))
        .filter((style) => Boolean(style)) as Array<Style>;

    return {
        [styleName]: styles,
    };
}

function mbLayer2harpStyle(mapboxLayer: MapboxVectorTileLayer): Style | null {
    const baseStyle = {
        id: mapboxLayer.id,
        technique: 'circles',
        layer: mapboxLayer['source-layer'],
        when: mapboxLayer.filter ? translateExpr(mapboxLayer.filter) : [],
        color: getHarpColorBy(mapboxLayer) as string,
        opacity: getHarpOpacityBy(mapboxLayer) as number,
    };
    if (baseStyle.color === null) {
        return null;
    }
    switch (mapboxLayer.type) {
        case 'symbol':
            return {
                ...baseStyle,
                technique: 'text',
                ...getTextStyleAttributes(mapboxLayer as mapboxgl.SymbolLayer),
            };
        case 'circle':
            return {
                ...baseStyle,
                technique: 'circles',
            };
        case 'line':
            return {
                ...baseStyle,
                metricUnit: 'Pixel', // deprecated
                technique: getLineTechnique(mapboxLayer as mapboxgl.LineLayer),
                ...getLineStyleAttributes(mapboxLayer as mapboxgl.LineLayer),
            };
        case 'fill':
            return {
                ...baseStyle,
                technique: 'fill',
            };
        case 'fill-extrusion':
            return {
                ...baseStyle,
                technique: 'extruded-polygon',
            };
    }
}

function getTextStyleAttributes(mapboxLayer: mapboxgl.SymbolLayer): Object {
    const textField = mapboxLayer.layout?.['text-field'];
    let textExpr: string | Expression | null = null;
    if (textField === undefined) return {};
    if (typeof textField === 'string') {
        const propLiteralMatches = textField.match(/{.+}/);
        if (!propLiteralMatches) textExpr = textField;
        const nonPropTextArr = textField.split(/{.+}/);
        if (nonPropTextArr[0] === '' && nonPropTextArr[1] === '') {
            textExpr = ['get', textField];
        } else {
            let seperated: string[] = [];
            nonPropTextArr
                .filter((text) => text !== '')
                .forEach((text) => {
                    const units = textField.split(text);
                    if (seperated.length === 0) seperated = [units[0]];
                    seperated.push(text);
                    if (units[1] !== '') seperated.push(units[1]);
                });
            const expr = seperated.map((unit: string) => {
                if (unit.match(/{.+}/))
                    return ['get', unit.replace('{', '').replace('}', '')];
                return unit;
            });
            textExpr = ['concat', ...expr];
        }
    }
    return {
        text: textExpr,
        color: mapboxLayer.paint?.['text-color']
            ? translateExpr(mapboxLayer.paint?.['text-color'] as any)
            : '#000000',
        size: mapboxLayer.layout?.['text-size']
            ? translateExpr(mapboxLayer.layout?.['text-size'] as any)
            : 16,
        backgroundColor: mapboxLayer.paint?.['text-halo-color']
            ? (mapboxLayer.paint?.['text-halo-color'] as any)
            : undefined,
        backgroundOpacity: mapboxLayer.paint?.['text-halo-color']
            ? 1.0
            : undefined,
    };
}

function getHarpColorBy(
    mapboxLayer: MapboxVectorTileLayer,
): string | object | Expression | null {
    if (mapboxLayer.paint === undefined) {
        return '#000000';
    }
    const color:
        | string
        | object
        | Expression
        | undefined = (mapboxLayer.paint as any)[`${mapboxLayer.type}-color`];
    if (color === undefined) {
        if ((mapboxLayer.paint as any)[`${mapboxLayer.type}-pattern`]) {
            // TODO: sprite-pattern
            return null;
        }
        return '#000000';
    } else {
        if (typeof color === 'string') {
            return color;
        } else {
            return translateExpr(color);
        }
    }
}

function getHarpOpacityBy(
    mapboxLayer: MapboxVectorTileLayer,
): number | object | Expression {
    if (mapboxLayer.paint === undefined) {
        return 1.0;
    }
    const opacity:
        | number
        | object
        | Expression
        | undefined = (mapboxLayer.paint as any)[`${mapboxLayer.type}-opacity`];
    if (opacity === undefined) return 1.0;
    if (typeof opacity === 'number') {
        return opacity;
    } else {
        return translateExpr(opacity);
    }
}

function getLineTechnique(
    mapboxLayer: mapboxgl.LineLayer,
): 'solid-line' | 'dashed-line' {
    if (mapboxLayer.paint?.['line-dasharray'] === undefined)
        return 'solid-line';
    return 'dashed-line';
}

function getLineStyleAttributes(mapboxLayer: mapboxgl.LineLayer): Object {
    const attributes = {
        lineWidth: 1,
    };
    if (mapboxLayer.paint?.['line-width'] !== undefined) {
        if (typeof mapboxLayer.paint['line-width'] === 'number') {
            (attributes as any).lineWidth = mapboxLayer.paint['line-width'];
        } else {
            //style function
            (attributes as any).lineWidth = translateExpr(
                mapboxLayer.paint['line-width'],
            );
        }
    }
    if (mapboxLayer.paint?.['line-dasharray'] !== undefined) {
        (attributes as any)['dashSize'] =
            Number(mapboxLayer.paint['line-dasharray'][0]) *
            PX_TO_METER_MULTIPLIER;
        (attributes as any)['gapSize'] =
            Number(mapboxLayer.paint['line-dasharray'][1]) *
            PX_TO_METER_MULTIPLIER;
    }
    return attributes;
}

function translateExpr(
    mapboxExpression: { [key: string]: any } | Expression,
): Expression {
    if (Array.isArray(mapboxExpression)) {
        let expression: Expression = [];

        for (let i = 0; i < mapboxExpression.length; i++) {
            const ops: number | string | Expression = mapboxExpression[i];
            if (typeof ops === 'number') {
                expression.push(ops);
                continue;
            }
            if (typeof ops !== 'string') {
                expression.push(translateExpr(ops));
                continue;
            }
            if (ops === '$type') {
                expression.push(['geometry-type']);
                continue;
            }
            if (ExpressionNames.includes(ops)) {
                expression.push(ops);
                continue;
            }
            if (ExpressionNames.includes(String(mapboxExpression[i - 1]))) {
                expression.push(['get', ops]);
                continue;
            }

            if (mapboxExpression[0] === 'in' || mapboxExpression[0] === '!in') {
                expression.push(['literal', mapboxExpression.slice(i)]);
                break;
            }
            // string value
            expression.push(ops);
        }
        return expression;
    } else {
        /**
         * when style function, like following
         * {
                base: 1.2, // can be undefined
                stops: [
                    [12, 0.5],
                    [13, 1],
                    [14, 4],
                    [20, 15],
                ],
            }
         */

        if (mapboxExpression['stops'] === undefined) return [];

        return [
            'interpolate',
            mapboxExpression['base']
                ? ['exponential', mapboxExpression['base']]
                : ['linear'],
            ['zoom'],
            ...mapboxExpression['stops'].reduce(
                (pre: any[], current: any[]) => {
                    pre.push(...current);
                    return pre;
                },
                [],
            ),
        ];
    }
}
