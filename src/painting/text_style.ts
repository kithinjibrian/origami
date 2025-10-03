export interface TextStyleParams {
    color?: string
    font_size?: number
}

export class TextStyle {
    color?: string;
    font_size?: number;

    constructor({
        color,
        font_size,
    }: TextStyleParams) {
        this.color = color;
        this.font_size = font_size;
    }
}