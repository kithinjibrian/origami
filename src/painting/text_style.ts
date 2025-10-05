import { FontStyle, FontWeight } from "../lib/peacock/__init__";
import { Reactive } from "../types/__init__";
import { resolveReactive } from "../utils/__init__";

import { Color } from "./color";
import { TextDecoration } from "./text_decoration";

export interface TextStyleParams {
    color?: Reactive<Color>
    backgroundColor?: Reactive<Color>
    fontSize?: Reactive<number>
    fontWeight?: Reactive<FontWeight>
    fontStyle?: Reactive<FontStyle>
    letterSpacing?: Reactive<number>
    wordSpacing?: Reactive<number>
    height?: Reactive<number>
    decoration?: Reactive<TextDecoration>
}

export class TextStyle {
    color?: Reactive<Color>
    backgroundColor?: Reactive<Color>
    fontSize?: Reactive<number>
    fontWeight?: Reactive<FontWeight>
    fontStyle?: Reactive<FontStyle>
    letterSpacing?: Reactive<number>
    wordSpacing?: Reactive<number>
    height?: Reactive<number>
    decoration?: Reactive<TextDecoration>

    constructor({
        color,
        backgroundColor,
        fontSize,
        fontWeight,
        fontStyle,
        letterSpacing,
        wordSpacing,
        height,
        decoration,
    }: TextStyleParams) {
        this.color = color;
        this.backgroundColor = backgroundColor;
        this.fontSize = fontSize;
        this.fontWeight = fontWeight;
        this.fontStyle = fontStyle;
        this.letterSpacing = letterSpacing;
        this.wordSpacing = wordSpacing;
        this.height = height;
        this.decoration = decoration;
    }

    applyTo(el: HTMLElement, effect: (fn: () => void) => void) {
        if (this.color) {
            effect(() => {
                const c = resolveReactive(this.color);
                el.style.color = c ? c.toString() : "";
            });
        }
        if (this.backgroundColor) {
            effect(() => {
                const bg = resolveReactive(this.backgroundColor);
                el.style.backgroundColor = bg ? bg.toString() : "";
            });
        }
        if (this.fontSize) {
            effect(() => {
                const fs = resolveReactive(this.fontSize);
                el.style.fontSize = fs != null ? `${fs}px` : "";
            });
        }
        if (this.fontWeight) {
            effect(() => {
                const fw = resolveReactive(this.fontWeight);
                el.style.fontWeight = fw ? fw.toString() : "";
            });
        }
        if (this.fontStyle) {
            effect(() => {
                const fs = resolveReactive(this.fontStyle);
                el.style.fontStyle = fs === FontStyle.italic ? "italic" : "normal";
            });
        }
        if (this.letterSpacing) {
            effect(() => {
                const ls = resolveReactive(this.letterSpacing);
                el.style.letterSpacing = ls != null ? `${ls}px` : "";
            });
        }
        if (this.wordSpacing) {
            effect(() => {
                const ws = resolveReactive(this.wordSpacing);
                el.style.wordSpacing = ws != null ? `${ws}px` : "";
            });
        }
        if (this.height) {
            effect(() => {
                const h = resolveReactive(this.height);
                el.style.lineHeight = h != null ? `${h}` : "";
            });
        }
        if (this.decoration) {
            effect(() => {
                const d = resolveReactive(this.decoration);
                el.style.textDecoration = d ? d.toString() : "";
            });
        }
    }
}