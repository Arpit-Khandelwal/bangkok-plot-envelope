import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import type { LngLat, Mesh } from '../core/types';
import type { ModelScene } from './modelScene';

/** How one mesh is drawn. `glass` is for envelopes, `solid` for building floors. */
export interface ModelPart {
  readonly key: string;
  readonly mesh: Mesh;
  readonly look: 'glass' | 'ghost' | 'solid';
  /** CSS colour. */
  readonly color: string;
}

export interface ModelContent {
  /** Lng/lat of the local frame origin that the mesh coordinates are relative to. */
  readonly origin: LngLat;
  readonly parts: readonly ModelPart[];
}

export const MODEL_LAYER_ID = 'plot-model';

type Gl = WebGLRenderingContext | WebGL2RenderingContext;

/**
 * The MapLibre custom layer for the proposal. three.js (about half the app's code) is needed only
 * once a plot produces a model, so this shell holds the map, the GL context and the latest
 * content, and loads the three.js scene (modelScene.ts) on first need or when `preload` is
 * called on idle. Until it arrives the layer draws nothing.
 */
export class ModelLayer implements CustomLayerInterface {
  readonly id = MODEL_LAYER_ID;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private gl: Gl | null = null;
  private scene: ModelScene | null = null;
  private content: ModelContent | null = null;
  private loading: Promise<void> | null = null;
  private sceneClass: typeof ModelScene | null = null;

  private readonly onLoadError: (error: unknown) => void;

  /** `onLoadError` is told when the three.js code could not be downloaded. */
  constructor(onLoadError: (error: unknown) => void = () => undefined) {
    this.onLoadError = onLoadError;
  }

  onAdd(map: MapLibreMap, gl: Gl): void {
    this.map = map;
    this.gl = gl;
    this.mountScene();
  }

  onRemove(): void {
    this.scene?.dispose();
    this.scene = null;
    this.map = null;
    this.gl = null;
  }

  /** Starts downloading the three.js scene without waiting for a model. */
  preload(): void {
    if (this.loading || this.sceneClass) return;
    this.loading = import('./modelScene')
      .then((module) => {
        this.sceneClass = module.ModelScene;
        this.mountScene();
      })
      .catch((error: unknown) => {
        // Allow the next model to try again.
        this.loading = null;
        this.onLoadError(error);
      });
  }

  setContent(content: ModelContent | null): void {
    this.content = content;
    if (this.scene) {
      this.scene.setContent(content);
      this.map?.triggerRepaint();
    } else if (content) {
      this.preload();
    }
  }

  render(_gl: Gl, input: CustomRenderMethodInput): void {
    this.scene?.render(input);
  }

  private mountScene(): void {
    if (this.scene || !this.sceneClass || !this.map || !this.gl) return;
    this.scene = new this.sceneClass(this.map, this.gl);
    this.scene.setContent(this.content);
    this.map.triggerRepaint();
  }
}
