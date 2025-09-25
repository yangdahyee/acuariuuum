// GLTFLoader/SkeletonUtils를 '.js'로 임포트해도
// 타입은 확장자 없는 선언을 쓰게 매핑
declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  export * from "three/examples/jsm/loaders/GLTFLoader"
  export { GLTFLoader as default } from "three/examples/jsm/loaders/GLTFLoader"
}
declare module "three/examples/jsm/utils/SkeletonUtils.js" {
  export * from "three/examples/jsm/utils/SkeletonUtils"
}
