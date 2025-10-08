export class Color {
    red!: number;
    green!: number;
    blue!: number;
    alpha!: number;

    constructor(params: Partial<Color>) {
        Object.assign(this, params);
    }

    static fromARGB(argb: number): Color {
        const a = ((argb >> 24) & 0xFF) / 255;
        const r = (argb >> 16) & 0xFF;
        const g = (argb >> 8) & 0xFF;
        const b = argb & 0xFF;
        return new Color({ red: r, green: g, blue: b, alpha: a });
    }

    static fromHex(hex: string): Color {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        if (hex.length === 6) {
            hex += "FF";
        }
        if (hex.length !== 8) {
            throw new Error(`Invalid HEX color: ${hex}`);
        }
        const red = parseInt(hex.substring(0, 2), 16);
        const green = parseInt(hex.substring(2, 4), 16);
        const blue = parseInt(hex.substring(4, 6), 16);
        const alpha = parseInt(hex.substring(6, 8), 16) / 255;
        return new Color({ red, green, blue, alpha });
    }

    toString(): string {
        return `rgba(${this.red}, ${this.green}, ${this.blue}, ${this.alpha})`;
    }

    private toHSL(): { h: number; s: number; l: number } {
        const r = this.red / 255;
        const g = this.green / 255;
        const b = this.blue / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;

        if (max === min) {
            return { h: 0, s: 0, l };
        }

        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        let h = 0;
        if (max === r) {
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        } else if (max === g) {
            h = ((b - r) / d + 2) / 6;
        } else {
            h = ((r - g) / d + 4) / 6;
        }

        return { h: h * 360, s, l };
    }

    private static fromHSL(h: number, s: number, l: number, a: number = 1): Color {
        h = h / 360;

        const hue2rgb = (p: number, q: number, t: number): number => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        if (s === 0) {
            const gray = Math.round(l * 255);
            return new Color({ red: gray, green: gray, blue: gray, alpha: a });
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
        const g = Math.round(hue2rgb(p, q, h) * 255);
        const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

        return new Color({ red: r, green: g, blue: b, alpha: a });
    }

    rotate(degrees: number): Color {
        const hsl = this.toHSL();
        hsl.h = (hsl.h + degrees) % 360;
        if (hsl.h < 0) hsl.h += 360;
        return Color.fromHSL(hsl.h, hsl.s, hsl.l, this.alpha);
    }

    luminance(): number {
        const rsRGB = this.red / 255;
        const gsRGB = this.green / 255;
        const bsRGB = this.blue / 255;

        const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
        const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
        const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    applyColor(
        element: HTMLElement,
        property: "bg"
    ): void {
        if (property === "bg") {
            element.style.backgroundColor = this.toString();
        }
    }
}