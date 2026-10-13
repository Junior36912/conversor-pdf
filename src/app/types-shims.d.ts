// `ssf` (formatador de números do SheetJS) não publica tipos.
declare module "ssf" {
  interface SSF {
    format(format: string | number, value: unknown, options?: { date1904?: boolean }): string;
    is_date(format: string): boolean;
  }
  const ssf: SSF;
  export default ssf;
}
