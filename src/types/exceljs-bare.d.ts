// The browser build of exceljs without polyfills (no eval, so it works under our CSP).
declare module 'exceljs/dist/exceljs.bare.min.js' {
  const ExcelJS: typeof import('exceljs')
  export default ExcelJS
}
