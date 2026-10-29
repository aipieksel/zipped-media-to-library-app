declare module 'imagetracerjs' {
  interface TraceColor { r: number; g: number; b: number; a: number }
  interface TracePath {
    isholepath: boolean;
    segments: Array<Record<string, number | string>>;
    holechildren: number[];
  }
  interface TraceData {
    width: number;
    height: number;
    palette: TraceColor[];
    layers: TracePath[][];
  }
  interface TraceOptions {
    [key: string]: number | boolean | TraceColor[];
  }
  const tracer: {
    imagedataToTracedata(image: { width: number; height: number; data: Uint8ClampedArray }, options: TraceOptions): TraceData;
    getsvgstring(data: TraceData, options: TraceOptions): string;
  };
  export default tracer;
}
