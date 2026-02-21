import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';
import { join } from 'path';

type Point = [number, number];
type Quad = [Point, Point, Point, Point];

interface DetectionResult {
    buffer: Buffer;
    quad: Quad | null;
}

interface LetterboxResult {
    img: tf.Tensor3D;
    ratio: number;
    dw: number;
    dh: number;
}

@Injectable()
export class DetectionPlateService implements OnModuleInit {
    private plateModel: tf.GraphModel | null = null;
    private readonly logger = new Logger(DetectionPlateService.name);
    private readonly confThreshold = 0.75;

    async onModuleInit() {
        const modelPath = 'file://' + join(process.cwd(), 'models', 'detection', 'best_seg_web_model', 'model.json');
        this.plateModel = await tf.loadGraphModel(modelPath);
        this.logger.log('Plate detection model loaded');
    }

    async cropPlateBySegmentation(imageBuffer: Buffer): Promise<DetectionResult | null> {
        if (!this.plateModel) return null;

        try {
            const imgOrig = tf.node.decodeImage(imageBuffer, 3).squeeze() as tf.Tensor3D;
            const [origH, origW] = imgOrig.shape;

            const { img: lbImg, ratio, dw, dh } = this.letterbox(imgOrig, 640);
            const input = lbImg.toFloat().div(255).expandDims(0) as tf.Tensor4D;

            const outs = (await this.plateModel.executeAsync(input)) as tf.Tensor[];
            const detTensor = outs[0].squeeze([0]) as tf.Tensor2D;
            const protosNHWC = outs[1].squeeze([0]) as tf.Tensor3D;
            const detections = (await detTensor.array()) as number[][];

            const bestDetection = this.findBestDetection(detections);

            tf.dispose([lbImg, input, detTensor]);

            if (!bestDetection) {
                tf.dispose([imgOrig, protosNHWC]);
                return null;
            }

            const { maskOrig, quad } = await this.generateMask(bestDetection, protosNHWC, ratio, dw, dh, origH, origW);
            const result = await this.cropAndEncode(imgOrig, maskOrig, origH, origW, quad);

            tf.dispose([imgOrig, protosNHWC]);

            return result;
        } catch (error) {
            this.logger.error('Plate detection failed', error);
            return null;
        }
    }

    private letterbox(img: tf.Tensor3D, size = 640): LetterboxResult {
        const [h, w] = img.shape;
        const ratio = Math.min(size / h, size / w);
        const newH = Math.round(h * ratio);
        const newW = Math.round(w * ratio);
        const dh = (size - newH) / 2;
        const dw = (size - newW) / 2;

        const resized = tf.image.resizeBilinear(img, [newH, newW]) as tf.Tensor3D;
        const [top, left] = [Math.round(dh - 0.1), Math.round(dw - 0.1)];
        const [bottom, right] = [size - newH - top, size - newW - left];
        const padded = tf.pad(resized, [[top, bottom], [left, right], [0, 0]], 114) as tf.Tensor3D;

        return { img: padded, ratio, dw, dh };
    }

    private findBestDetection(detections: number[][]): number[] | null {
        let [bestIdx, bestScore] = [-1, 0];

        for (let i = 0; i < detections.length; i++) {
            const score = detections[i][4];
            if (score > this.confThreshold && score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        return bestIdx >= 0 ? detections[bestIdx] : null;
    }

    private async generateMask(
        detection: number[],
        protosNHWC: tf.Tensor3D,
        ratio: number,
        dw: number,
        dh: number,
        origH: number,
        origW: number
    ): Promise<{ maskOrig: number[][]; quad: Quad | null }> {
        const [bx1, by1, bx2, by2] = detection.slice(0, 4);
        const coeffs = detection.slice(6);

        const protosCHW = protosNHWC.transpose([2, 0, 1]) as tf.Tensor3D;
        const protosFlat = protosCHW.reshape([32, 160 * 160]) as tf.Tensor2D;
        const coeffTensor = tf.tensor2d(coeffs, [1, 32]);
        const maskFlat = coeffTensor.matMul(protosFlat) as tf.Tensor2D;
        const mask160 = maskFlat.reshape([160, 160]).sigmoid() as tf.Tensor2D;

        const mask640 = tf.image.resizeBilinear(mask160.expandDims(-1) as tf.Tensor3D, [640, 640]).squeeze() as tf.Tensor2D;
        const maskArr = (await mask640.array()) as number[][];

        const [bx1c, by1c, bx2c, by2c] = [bx1, by1, bx2, by2].map((v) => Math.max(0, Math.min(640, Math.round(v))));

        for (let y = 0; y < 640; y++) {
            for (let x = 0; x < 640; x++) {
                if (x < bx1c || x >= bx2c || y < by1c || y >= by2c) {
                    maskArr[y][x] = 0;
                }
            }
        }

        const unpadded = this.removePadding(maskArr, dh, dw);
        const maskOrig = await this.resizeToOriginal(unpadded, origH, origW);
        const quad = this.extractQuad(maskOrig, origW, origH);
        const finalMask = quad ? this.rasterizeQuad(quad, origW, origH) : maskOrig;

        tf.dispose([protosCHW, protosFlat, coeffTensor, maskFlat, mask160, mask640]);

        return { maskOrig: finalMask, quad };
    }

    private removePadding(maskArr: number[][], dh: number, dw: number): number[][] {
        const [top, left] = [Math.round(dh), Math.round(dw)];
        const [bottom, right] = [640 - top, 640 - left];
        const [hUnpad, wUnpad] = [bottom - top, right - left];

        const unpadded: number[][] = [];
        for (let y = 0; y < hUnpad; y++) {
            unpadded.push(maskArr[top + y].slice(left, right));
        }

        return unpadded;
    }

    private async resizeToOriginal(maskArr: number[][], origH: number, origW: number): Promise<number[][]> {
        const [h, w] = [maskArr.length, maskArr[0].length];
        const maskTensor = tf.tensor2d(maskArr, [h, w]) as tf.Tensor2D;
        const resized = tf.image.resizeBilinear(maskTensor.expandDims(-1) as tf.Tensor3D, [origH, origW]).squeeze() as tf.Tensor2D;
        const result = (await resized.array()) as number[][];

        tf.dispose([maskTensor, resized]);
        return result;
    }

    private extractQuad(mask: number[][], width: number, height: number): Quad | null {
        let hasPoint = false;
        let tl: Point | null = null;
        let tr: Point | null = null;
        let br: Point | null = null;
        let bl: Point | null = null;
        let [tlScore, brScore, trScore, blScore] = [Infinity, -Infinity, -Infinity, Infinity];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (mask[y][x] <= 0.5) continue;
                hasPoint = true;

                const [s, d] = [x + y, x - y];
                if (s < tlScore) { tlScore = s; tl = [x, y]; }
                if (s > brScore) { brScore = s; br = [x, y]; }
                if (d > trScore) { trScore = d; tr = [x, y]; }
                if (d < blScore) { blScore = d; bl = [x, y]; }
            }
        }

        if (!hasPoint || !tl || !tr || !br || !bl) return null;
        return [tl, tr, br, bl];
    }

    private rasterizeQuad(quad: Quad, width: number, height: number): number[][] {
        const polyMask: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));

        const isInside = (px: number, py: number): boolean => {
            let inside = false;
            for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
                const [xi, yi] = quad[i];
                const [xj, yj] = quad[j];
                const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi;
                if (intersect) inside = !inside;
            }
            return inside;
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (isInside(x, y)) polyMask[y][x] = 1;
            }
        }

        return polyMask;
    }

    private async cropAndEncode(
        imgOrig: tf.Tensor3D,
        maskArr: number[][],
        origH: number,
        origW: number,
        quad: Quad | null
    ): Promise<DetectionResult> {
        let [minX, maxX, minY, maxY] = [origW, 0, origH, 0];
        let hasPoint = false;

        for (let y = 0; y < origH; y++) {
            for (let x = 0; x < origW; x++) {
                if (maskArr[y][x] > 0.5) {
                    hasPoint = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (!hasPoint) {
            [minX, maxX, minY, maxY] = [0, origW, 0, origH];
        } else {
            [minX, maxX, minY, maxY] = [Math.max(0, minX), Math.min(origW, maxX), Math.max(0, minY), Math.min(origH, maxY)];
        }

        const [width, height] = [Math.max(1, Math.round(maxX - minX)), Math.max(1, Math.round(maxY - minY))];

        const croppedQuad: Quad | null = quad ? quad.map(([x, y]) => [x - minX, y - minY]) as Quad : null;

        const mask2d = tf.tensor2d(maskArr, [origH, origW]).greater(0.5).toFloat() as tf.Tensor2D;
        const mask3 = mask2d.expandDims(-1) as tf.Tensor3D;
        const rgba = tf.concat([imgOrig.toFloat().mul(mask3), mask3.mul(255)], -1) as tf.Tensor3D;

        const cropped = rgba.slice([Math.round(minY), Math.round(minX), 0], [height, width, 4]) as tf.Tensor3D;
        const png = await tf.node.encodePng(cropped.toInt());

        tf.dispose([mask2d, mask3, rgba, cropped]);

        return { buffer: Buffer.from(png), quad: croppedQuad };
    }
}