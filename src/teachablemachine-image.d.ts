declare module "@teachablemachine/image" {
  export type Prediction = {
    className: string;
    probability: number;
  };

  export type CustomMobileNet = {
    predict: (image: HTMLVideoElement) => Promise<Prediction[]>;
  };

  export function load(modelUrl: string, metadataUrl: string): Promise<CustomMobileNet>;
}
