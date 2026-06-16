declare module "pdfjs-dist/webpack.mjs" {
  import type {
    DocumentInitParameters,
    PDFDocumentLoadingTask,
    PDFWorker
  } from "pdfjs-dist/types/src/display/api";

  export function getDocument(src?: DocumentInitParameters): PDFDocumentLoadingTask;
  export const GlobalWorkerOptions: {
    workerPort?: Worker | null;
    workerSrc: string;
  };
  export type { DocumentInitParameters, PDFDocumentLoadingTask, PDFWorker };
}
