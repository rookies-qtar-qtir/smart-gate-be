import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';
import { VehicleType } from '@prisma/client';

interface PlateDetection {
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  class: string;
}

@Injectable()
export class TfjsService implements OnModuleInit {
  private vehicleModel: tf.LayersModel;
  private plateModel: tf.GraphModel;
  private readonly logger = new Logger(TfjsService.name);
  private readonly confidenceThreshold = 0.85;
  private readonly plateConfidenceThreshold = 0.5;
  private readonly iouThreshold = 0.5;

  private readonly classMap: { [key: number]: VehicleType } = {
    0: VehicleType.BIKE,
    1: VehicleType.CAR,
    2: VehicleType.NO_VEHICLE,
  };

  async onModuleInit() {
    await this.loadModels();
  }

  private async loadModels() {
    try {
      this.vehicleModel = await tf.loadLayersModel('file://./models/model_tfjs/model.json');
      this.logger.log('Vehicle classification model loaded successfully');

      this.plateModel = await tf.loadGraphModel('file://./models/best_web_model/model.json');
      this.logger.log('Plate detection model loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load models:', error);
      throw new Error('Model loading failed');
    }
  }

  async classifyVehicle(imageBuffer: Buffer): Promise<VehicleType> {
    try {
      const imageTensor = this.preprocessImageForClassification(imageBuffer);
      const predictions = this.vehicleModel.predict(imageTensor) as tf.Tensor;
      const predictionData = await predictions.data();
      const scores = Array.from(predictionData);
      const maxScore = Math.max(...scores);
      const predictedClassIndex = scores.indexOf(maxScore);

      imageTensor.dispose();
      predictions.dispose();

      if (maxScore < this.confidenceThreshold) {
        this.logger.warn(`Low confidence prediction: ${(maxScore * 100).toFixed(2)}%, returning NO_VEHICLE`);
        return VehicleType.NO_VEHICLE;
      }

      return this.classMap[predictedClassIndex] || VehicleType.NO_VEHICLE;
    } catch (error) {
      this.logger.error('Error during vehicle classification:', error);
      return VehicleType.NO_VEHICLE;
    }
  }

  async detectPlate(imageBuffer: Buffer): Promise<PlateDetection | null> {
    const originalImage = tf.node.decodeImage(imageBuffer, 3);
    const imageWidth = originalImage.shape[1];
    const imageHeight = originalImage.shape[0];
    const imageTensor = this.preprocessImageForDetection(originalImage as tf.Tensor3D);

    try {
      const predictions = this.plateModel.predict(imageTensor) as tf.Tensor;
      const detections = await this.processYoloOutput(predictions, imageWidth, imageHeight);

      if (detections.length === 0) {
        this.logger.warn('No plate detected with sufficient confidence');
        return null;
      }

      const bestDetection = detections.reduce((prev, current) =>
        prev.confidence > current.confidence ? prev : current
      );

      this.logger.log(`Plate detected with confidence: ${(bestDetection.confidence * 100).toFixed(2)}%`);
      return bestDetection;
    } catch (error) {
      this.logger.error('Error during plate detection:', error);
      return null;
    } finally {
      tf.dispose([originalImage, imageTensor]);
    }
  }

  private preprocessImageForDetection(image: Buffer | tf.Tensor3D): tf.Tensor4D {
    const imageTensor = image instanceof Buffer ? tf.node.decodeImage(image, 3) : image;
    const resizedImage = tf.image.resizeBilinear(imageTensor, [640, 640]);
    const normalizedImage = resizedImage.div(tf.scalar(255.0));
    const batchedImage = normalizedImage.expandDims(0);

    if (image instanceof Buffer) {
      tf.dispose(imageTensor);
    }
    tf.dispose([resizedImage, normalizedImage]);

    return batchedImage as tf.Tensor4D;
  }

  private preprocessImageForClassification(imageBuffer: Buffer): tf.Tensor {
    const imageTensor = tf.node.decodeImage(imageBuffer, 3);
    const resizedImage = tf.image.resizeBilinear(imageTensor, [224, 224]);
    const normalizedImage = resizedImage.div(tf.scalar(255.0));
    const batchedImage = normalizedImage.expandDims(0);

    tf.dispose([imageTensor, resizedImage, normalizedImage]);
    return batchedImage;
  }

  private async processYoloOutput(outputTensor: tf.Tensor, imageWidth: number, imageHeight: number): Promise<PlateDetection[]> {
    const transposed = outputTensor.squeeze([0]).transpose();
    const data = await transposed.array() as number[][];

    const { boxes, scores } = this.extractValidDetections(data, imageWidth, imageHeight);

    if (boxes.length === 0) {
      tf.dispose(transposed);
      return [];
    }

    const detections = await this.applyNonMaxSuppression(boxes, scores, imageWidth, imageHeight);
    tf.dispose(transposed);
    return detections;
  }

  private extractValidDetections(data: number[][], imageWidth: number, imageHeight: number) {
    const boxes: number[][] = [];
    const scores: number[] = [];
    const scaleX = imageWidth / 640;
    const scaleY = imageHeight / 640;

    data.forEach(row => {
      const confidence = row[4];
      if (confidence >= this.plateConfidenceThreshold) {
        const [cx, cy, w, h] = row.slice(0, 4);
        const x1 = (cx - w / 2) * scaleX;
        const y1 = (cy - h / 2) * scaleY;
        const x2 = (cx + w / 2) * scaleX;
        const y2 = (cy + h / 2) * scaleY;

        boxes.push([y1, x1, y2, x2]);
        scores.push(confidence);
      }
    });

    return { boxes, scores };
  }

  private async applyNonMaxSuppression(boxes: number[][], scores: number[], imageWidth: number, imageHeight: number): Promise<PlateDetection[]> {
    const boxTensor = tf.tensor2d(boxes);
    const scoreTensor = tf.tensor1d(scores);

    const nmsIndices = await tf.image.nonMaxSuppressionAsync(
      boxTensor,
      scoreTensor,
      10,
      this.iouThreshold,
      this.plateConfidenceThreshold
    );

    const keptIndices = await nmsIndices.data();
    const detections: PlateDetection[] = [];

    for (const index of keptIndices) {
      const [y1, x1, y2, x2] = boxes[index];
      detections.push({
        bbox: {
          x: Math.max(0, x1),
          y: Math.max(0, y1),
          width: Math.min(x2 - x1, imageWidth - x1),
          height: Math.min(y2 - y1, imageHeight - y1),
        },
        confidence: scores[index],
        class: 'plate',
      });
    }

    tf.dispose([boxTensor, scoreTensor, nmsIndices]);
    return detections;
  }
}