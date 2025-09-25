// three의 examples 모듈 타입을 간단히 선언해서 TS 빨간줄 제거
declare module "three/examples/jsm/loaders/GLTFLoader" {
  export class GLTFLoader {
    constructor(manager?: any)
    load(url: string, onLoad?: (gltf: any) => void, onProgress?: (ev: any) => void, onError?: (err: any) => void): void
    parse(data: string | ArrayBuffer, path: string, onLoad: (gltf: any) => void, onError?: (err: any) => void): void
  }
}

declare module "three/examples/jsm/utils/SkeletonUtils" {
  export const SkeletonUtils: {
    clone: <T = any>(source: T) => T
  }
}
