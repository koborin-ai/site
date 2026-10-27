declare module 'subset-font' {
  function subsetFont(
    font: Uint8Array,
    text: string,
    options?: { targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype' },
  ): Promise<Uint8Array>;
  export default subsetFont;
}

declare module 'fontverter' {
  export function convert(font: Uint8Array, toFormat: string, fromFormat?: string): Promise<Uint8Array>;
}
