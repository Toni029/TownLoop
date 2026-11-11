export const POLICIES: Record<string, [number,number]>;
export function ms(value: unknown): number;
export function advance(previous: any,scope: string,target: string,now: number,bytes?: number): {windowAt:number;dayAt:number;windowCount:number;dayCount:number;bytesDay:number;lastAt:number;target:string;windowReset:boolean;dayReset:boolean};
export function classify(path:string,before:any,patch:any):string|null;
