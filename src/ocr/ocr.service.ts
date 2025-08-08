import { Injectable } from '@nestjs/common';
import { createCanvas, loadImage } from 'canvas';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface CropBoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface OcrResult {
    croppedImage: string;
    ocrText: string | null;
}

@Injectable()
export class OcrService {

    async cropImageFromBuffer(imageBuffer: Buffer, bbox: CropBoundingBox): Promise<string> {
        try {
            const originalImage = await loadImage(imageBuffer);
            const originalCanvas = createCanvas(originalImage.width, originalImage.height);
            const originalContext = originalCanvas.getContext('2d');

            originalContext.drawImage(originalImage, 0, 0);

            const { x, y, width, height } = bbox;
            const croppedImageData = originalContext.getImageData(x, y, width, height);

            const croppedCanvas = createCanvas(width, height);
            const croppedContext = croppedCanvas.getContext('2d');
            croppedContext.putImageData(croppedImageData, 0, 0);

            return croppedCanvas.toDataURL('image/png');
        } catch (error) {
            console.error('Error cropping image:', error);
            throw new Error(`Failed to crop image: ${error.message}`);
        }
    }

    async runOCR(base64Image: string): Promise<string | null> {
        const tempDir = os.tmpdir();
        const inputFilePath = path.join(tempDir, `ocr_input_${Date.now()}.png`);

        try {
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(inputFilePath, Buffer.from(base64Data, 'base64'));

            return this.executePythonOCR(inputFilePath);
        } catch (error) {
            console.error('OCR processing failed:', error);
            this.cleanupTempFile(inputFilePath);
            return null;
        }
    }

    private executePythonOCR(inputFilePath: string): Promise<string | null> {
        return new Promise((resolve) => {
            const pythonProcess = spawn('python3', ['scripts/plate_ocr.py', inputFilePath]);

            let stdOutput = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                stdOutput += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (exitCode) => {
                this.cleanupTempFile(inputFilePath);

                if (exitCode === 0) {
                    resolve(stdOutput.trim());
                } else {
                    console.error('OCR script error:', errorOutput);
                    resolve(null);
                }
            });

            pythonProcess.on('error', (error) => {
                console.error('Failed to start Python process:', error);
                this.cleanupTempFile(inputFilePath);
                resolve(null);
            });
        });
    }

    private cleanupTempFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.warn('Failed to delete temporary file:', error);
        }
    }

    async cropAndRunOCR(imageBuffer: Buffer, bbox: CropBoundingBox): Promise<OcrResult> {
        try {
            const croppedImage = await this.cropImageFromBuffer(imageBuffer, bbox);
            const ocrText = await this.runOCR(croppedImage);

            return { croppedImage, ocrText };
        } catch (error) {
            console.error('Crop and OCR failed:', error);
            throw new Error(`Failed to crop and run OCR: ${error.message}`);
        }
    }
}