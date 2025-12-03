import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';
import { join } from 'path';
import { VehicleType } from '@prisma/client';

interface ClassificationResult {
    type: VehicleType;
    confidence: number;
}

@Injectable()
export class ClassificationService implements OnModuleInit {
    private vehicleModel: tf.LayersModel | null = null;
    private readonly logger = new Logger(ClassificationService.name);
    private readonly confidenceThreshold = 0.85;
    private readonly classMap: Record<number, VehicleType> = {
        0: VehicleType.BIKE,
        1: VehicleType.CAR,
        2: VehicleType.MOTORBIKE,
        3: VehicleType.NO_VEHICLE,
    };

    async onModuleInit() {
        await this.loadModel();
    }

    private async loadModel() {
        const modelPath = 'file://' + join(
            process.cwd(),
            'models',
            'classification',
            'best_web_model',
            'model.json'
        );

        this.vehicleModel = await tf.loadLayersModel(modelPath);
        this.logger.log('Vehicle classification model loaded');
    }

    async classifyVehicle(imageBuffer: Buffer): Promise<VehicleType> {
        if (!this.vehicleModel) {
            return VehicleType.NO_VEHICLE;
        }

        try {
            const result = await this.predict(imageBuffer);

            this.logger.log(
                `Vehicle prediction: type=${result.type}, confidence=${(result.confidence * 100).toFixed(2)}%`
            );

            if (result.confidence < this.confidenceThreshold) {
                return VehicleType.NO_VEHICLE;
            }

            return result.type;
        } catch (error) {
            this.logger.error('Classification failed', error);
            return VehicleType.NO_VEHICLE;
        }
    }

    private async predict(imageBuffer: Buffer): Promise<ClassificationResult> {
        const imageTensor = this.preprocessImage(imageBuffer, [224, 224]);
        const output = this.vehicleModel!.predict(imageTensor);
        const predictions = Array.isArray(output) ? output[0] : output;
        const scores = Array.from(await (predictions as tf.Tensor).data());

        imageTensor.dispose();
        predictions.dispose();

        const maxScore = Math.max(...scores);
        const predictedClassIndex = scores.indexOf(maxScore);
        const vehicleType = this.classMap[predictedClassIndex] ?? VehicleType.NO_VEHICLE;

        return { type: vehicleType, confidence: maxScore };
    }

    // Preprocess: decode -> resize -> normalize -> batch
    private preprocessImage(imageBuffer: Buffer, size: [number, number]): tf.Tensor4D {
        const imageTensor = tf.node.decodeImage(imageBuffer, 3) as tf.Tensor3D;
        const resizedImage = tf.image.resizeBilinear(imageTensor, size);
        const normalizedImage = resizedImage.div(tf.scalar(255.0));
        const batchedImage = normalizedImage.expandDims(0) as tf.Tensor4D;

        imageTensor.dispose();
        resizedImage.dispose();
        normalizedImage.dispose();

        return batchedImage;
    }
}