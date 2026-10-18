declare module "potrace" {
  type Options = { turdSize?: number; optTolerance?: number; threshold?: number; blackOnWhite?: boolean; turnPolicy?: string };
  export class Potrace {
    constructor(options?: Options);
    loadImage(image: Buffer | string, callback: (err: Error | null) => void): void;
    getPathTag(fillColor?: string): string;
  }
}
