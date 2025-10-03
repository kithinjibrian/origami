export interface ColorParams {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

export class Color {
    red: number;
    green: number;
    blue: number;
    alpha: number;

    constructor({
        red,
        green,
        blue,
        alpha
    }: ColorParams) {
        this.red = red;
        this.green = green;
        this.blue = blue;
        this.alpha = alpha;
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
}