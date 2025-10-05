export enum FontStyle {
    normal,
    italic,
}

export function fontStyleToCss(style: FontStyle): string {
    switch (style) {
        case FontStyle.italic: return "italic";
        case FontStyle.normal:
        default: return "normal";
    }
}
