export class TextDecoration {
    private constructor(private mask: number) { }

    static none = new TextDecoration(0);
    static underline = new TextDecoration(1 << 0);
    static overline = new TextDecoration(1 << 1);
    static lineThrough = new TextDecoration(1 << 2);

    static combine(decorations: TextDecoration[]): TextDecoration {
        let mask = 0;
        for (const d of decorations) mask |= d.mask;
        return new TextDecoration(mask);
    }

    toString(): string {
        if (this.mask === 0) return "none";

        const values: string[] = [];
        if (this.mask & TextDecoration.underline.mask) values.push("underline");
        if (this.mask & TextDecoration.overline.mask) values.push("overline");
        if (this.mask & TextDecoration.lineThrough.mask) values.push("line-through");

        return values.join(" ");
    }
}
