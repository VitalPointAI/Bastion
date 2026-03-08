declare module '@tak-ps/node-cot' {
  class CoT {
    constructor(cot: string | Buffer);
    raw: Record<string, unknown>;
    to_geojson(): Record<string, unknown>;
  }
  export default CoT;
}
