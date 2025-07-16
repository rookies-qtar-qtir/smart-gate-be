import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';
import { VehicleType } from '@prisma/client';

@Injectable()
export class TfjsService implements OnModuleInit {
  private model: tf.LayersModel;
  private readonly logger = new Logger(TfjsService.name);
  private readonly confidenceThreshold = 0.85;

  private readonly classMap: { [key: number]: VehicleType } = {
    0: VehicleType.BIKE,
    1: VehicleType.CAR,
    2: VehicleType.NO_VEHICLE,
  };

  async onModuleInit() {
    await this.loadModel();
  }

  private async loadModel() {
    try {
      const modelPath = './models/model_tfjs/model.json';
      this.model = await tf.loadLayersModel(`file://${modelPath}`);
      this.logger.log('TFJS model loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load TFJS model:', error);
      throw new Error('Model loading failed');
    }
  }

  async classifyVehicle(imageBuffer: Buffer): Promise<VehicleType> {
    try {
      const imageTensor = this.preprocessImage(imageBuffer);

      const predictions = this.model.predict(imageTensor) as tf.Tensor;
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

  private preprocessImage(imageBuffer: Buffer): tf.Tensor {
    const imageTensor = tf.node.decodeImage(imageBuffer, 3);
    const resizedImage = tf.image.resizeBilinear(imageTensor, [224, 224]);
    const normalizedImage = resizedImage.div(tf.scalar(255.0));
    const batchedImage = normalizedImage.expandDims(0);

    imageTensor.dispose();
    resizedImage.dispose();
    normalizedImage.dispose();

    return batchedImage;
  }
}