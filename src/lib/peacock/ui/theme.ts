import { Color } from "../../../main";
import { Injectable } from "../../../widgets/__init__";

export enum ThemeMode {
    light,
    dark,
    system
}

export class ColorScheme {
    primary!: Color;
    secondary!: Color;
    background!: Color;
    surface!: Color;
    error!: Color;
    onPrimary!: Color;
    onSecondary!: Color;
    onBackground!: Color;
    onSurface!: Color;
    onError!: Color;

    constructor(params: Partial<ColorScheme> = {}) {
        Object.assign(this, params);
    }

    static fromSeed(seed: string): ColorScheme {
        const seedColor = Color.fromHex(seed);

        const primary = seedColor;
        const secondary = seedColor.rotate(180);

        const background = Color.fromHex('#FFFFFF');
        const surface = Color.fromHex('#F5F5F5');

        const error = Color.fromHex('#B00020');

        const onPrimary = primary.luminance() > 0.5 ? Color.fromHex('#000000') : Color.fromHex('#FFFFFF');
        const onSecondary = secondary.luminance() > 0.5 ? Color.fromHex('#000000') : Color.fromHex('#FFFFFF');
        const onBackground = Color.fromHex('#000000');
        const onSurface = Color.fromHex('#000000');
        const onError = Color.fromHex('#FFFFFF');

        return new ColorScheme({
            primary,
            secondary,
            background,
            surface,
            error,
            onPrimary,
            onSecondary,
            onBackground,
            onSurface,
            onError
        });
    }
}

export class ThemeData {
    colorScheme!: ColorScheme;

    constructor(params: Partial<ThemeData>) {
        Object.assign(this, params);
    }
}

@Injectable
export class ThemeSettings {
    light!: ThemeData
    dark!: ThemeData

    constructor(params: Partial<ThemeSettings>) {
        Object.assign(this, params);
    }
}