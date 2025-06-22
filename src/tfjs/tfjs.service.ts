import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';
import { VehicleType } from '@prisma/client';

@Injectable()
export class TfjsService implements OnModuleInit {
  private model: tf.LayersModel;
  private readonly logger = new Logger(TfjsService.name);

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

      const predictedClassIndex = predictionData.indexOf(
        Math.max(...Array.from(predictionData)),
      );

      imageTensor.dispose();
      predictions.dispose();

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

//   async classifyVehicleWithConfidence(imageBuffer: Buffer): Promise<{
//     prediction: VehicleType;
//     confidence: number;
//     allScores: { [key in VehicleType]: number };
//   }> {
//     try {
//       const imageTensor = this.preprocessImage(imageBuffer);
//       const predictions = this.model.predict(imageTensor) as tf.Tensor;
//       const predictionData = await predictions.data();

//       const scores = Array.from(predictionData);
//       const maxScore = Math.max(...scores);
//       const predictedClassIndex = scores.indexOf(maxScore);

//       const allScores = {
//         [VehicleType.BIKE]: scores[0],
//         [VehicleType.CAR]: scores[1],
//         [VehicleType.NO_VEHICLE]: scores[2],
//       };

//       imageTensor.dispose();
//       predictions.dispose();

//       return {
//         prediction:
//           this.classMap[predictedClassIndex] || VehicleType.NO_VEHICLE,
//         confidence: maxScore,
//         allScores,
//       };
//     } catch (error) {
//       this.logger.error(
//         'Vehicle classification with confidence failed:',
//         error,
//       );
//       return {
//         prediction: VehicleType.NO_VEHICLE,
//         confidence: 0,
//         allScores: {
//           [VehicleType.BIKE]: 0,
//           [VehicleType.CAR]: 0,
//           [VehicleType.NO_VEHICLE]: 1,
//         },
//       };
//     }
//   }
}
