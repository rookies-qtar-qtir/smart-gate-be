import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type Point = [number, number];
type Quad = [Point, Point, Point, Point];

export interface WarpOcrResult {
    warpedPlate: string;  
    processedPlate?: string;  
    ocrText: string | null;
}

interface PythonOcrResponse {
    ocrText: string | null;
    processedImage: string | null;
    error: string | null;
}

const pythonCmd = process.env.PYTHON_BIN ?? (process.platform === 'win32' ? 'python' : 'python3');

@Injectable()
export class OcrService {
    async warpAndOcr(imageBuffer: Buffer, quad: Quad | null): Promise<WarpOcrResult | null> {
        if (!quad || quad.length !== 4) {
            console.error('Invalid quad for warp');
            return null;
        }

        const warpedBuffer = await this.warpPerspective(imageBuffer, quad);
        if (!warpedBuffer) return null;

        const warpedBase64 = `data:image/png;base64,${warpedBuffer.toString('base64')}`;

        const ocrResult = await this.runOCR(warpedBase64);

        return {
            warpedPlate: warpedBase64,
            processedPlate: ocrResult.processedImage ?? undefined,
            ocrText: ocrResult.ocrText
        };
    }

    private async runOCR(base64Image: string): Promise<PythonOcrResponse> {
        const inputPath = path.join(os.tmpdir(), `ocr_input_${Date.now()}.png`);

        try {
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(inputPath, Buffer.from(base64Data, 'base64'));

            return await this.executePythonOCR(inputPath);
        } catch (error) {
            console.error('OCR processing failed:', error);
            this.cleanupFile(inputPath);
            return { ocrText: null, processedImage: null, error: 'Exception occurred' };
        }
    }

    private executePythonOCR(inputPath: string): Promise<PythonOcrResponse> {
        return new Promise((resolve) => {
            const process = spawn(pythonCmd, ['scripts/plate_ocr.py', inputPath]);

            let stdOutput = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => (stdOutput += data.toString()));
            process.stderr.on('data', (data) => (errorOutput += data.toString()));

            process.on('close', (exitCode) => {
                this.cleanupFile(inputPath);

                if (exitCode === 0) {
                    try {
                        const result: PythonOcrResponse = JSON.parse(stdOutput.trim());
                        resolve(result);
                    } catch (e) {
                        console.error('Failed to parse Python JSON output:', stdOutput);
                        resolve({ ocrText: null, processedImage: null, error: 'Invalid JSON output from script' });
                    }
                } else {
                    console.error('OCR script error:', errorOutput);
                    resolve({ ocrText: null, processedImage: null, error: errorOutput });
                }
            });

            process.on('error', (error) => {
                console.error('Failed to start Python process:', error);
                this.cleanupFile(inputPath);
                resolve({ ocrText: null, processedImage: null, error: error.message });
            });
        });
    }

    private async warpPerspective(imageBuffer: Buffer, quad: Quad): Promise<Buffer | null> {
        const timestamp = Date.now();
        const inputPath = path.join(os.tmpdir(), `warp_input_${timestamp}.png`);
        const outputPath = path.join(os.tmpdir(), `warp_output_${timestamp}.png`);

        try {
            fs.writeFileSync(inputPath, imageBuffer);

            const success = await this.executePythonWarp(inputPath, outputPath, quad);
            if (!success) return null;

            const warpedBuffer = fs.readFileSync(outputPath);
            return warpedBuffer;
        } finally {
            this.cleanupFile(inputPath);
            this.cleanupFile(outputPath);
        }
    }

    private executePythonWarp(inputPath: string, outputPath: string, quad: Quad): Promise<boolean> {
        return new Promise((resolve) => {
            const args = ['scripts/warp_perspective.py', inputPath, outputPath, ...quad.flat().map(String)];
            const process = spawn(pythonCmd, args);

            let errorOutput = '';

            process.stderr.on('data', (data) => (errorOutput += data.toString()));

            process.on('close', (exitCode) => {
                if (exitCode === 0) {
                    resolve(true);
                } else {
                    console.error('Warp script error:', errorOutput);
                    resolve(false);
                }
            });

            process.on('error', (error) => {
                console.error('Failed to start Python warp process:', error);
                resolve(false);
            });
        });
    }

    private cleanupFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.warn('Failed to delete temp file:', error);
        }
    }
}
