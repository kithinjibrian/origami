import { FontStyle, FontWeight } from "../lib/peacock/__init__";
import { Reactive } from "../types/__init__";
import { resolveReactive } from "../utils/__init__";

import { Color } from "./color";
import { TextDecoration } from "./text_decoration";

export interface TextStyleParams {
    color?: Reactive<Color>;
    backgroundColor?: Reactive<Color>;
    fontSize?: Reactive<number>;
    fontWeight?: Reactive<FontWeight>;
    fontStyle?: Reactive<FontStyle>;
    letterSpacing?: Reactive<number>;
    wordSpacing?: Reactive<number>;
    height?: Reactive<number>;
    decoration?: Reactive<TextDecoration>;
}

function applyStyle<T>(
    el: HTMLElement,
    styleProp: string,
    value?: Reactive<T>,
    effect?: (fn: () => void) => void,
    px: boolean = false
) {
    if (value == null) return;

    if (typeof value === "function" && effect) {
        effect(() => {
            const v = (value as any)();
            el.style[styleProp as any] = v != null ? (px ? `${v}px` : v.toString()) : "";
        });
    } else {
        const v = resolveReactive(value);
        el.style[styleProp as any] = v != null ? (px ? `${v}px` : v.toString()) : "";
    }
}

export class TextStyle {
    color?: Reactive<Color>;
    backgroundColor?: Reactive<Color>;
    fontSize?: Reactive<number>;
    fontWeight?: Reactive<FontWeight>;
    fontStyle?: Reactive<FontStyle>;
    letterSpacing?: Reactive<number>;
    wordSpacing?: Reactive<number>;
    height?: Reactive<number>;
    decoration?: Reactive<TextDecoration>;

    constructor(params: TextStyleParams) {
        Object.assign(this, params);
    }

    applyTo(el: HTMLElement, effect: (fn: () => void) => void) {
        applyStyle(el, "color", this.color, effect);
        applyStyle(el, "backgroundColor", this.backgroundColor, effect);
        applyStyle(el, "fontSize", this.fontSize, effect, true);
        applyStyle(el, "fontWeight", this.fontWeight, effect);
        applyStyle(el, "letterSpacing", this.letterSpacing, effect, true);
        applyStyle(el, "wordSpacing", this.wordSpacing, effect, true);
        applyStyle(el, "lineHeight", this.height, effect);
        applyStyle(el, "textDecoration", this.decoration, effect);

        if (this.fontStyle) {
            const setter = () => {
                const fs = resolveReactive(this.fontStyle);
                el.style.fontStyle = fs === FontStyle.italic ? "italic" : "normal";
            };
            effect ? effect(setter) : setter();
        }
    }
}
