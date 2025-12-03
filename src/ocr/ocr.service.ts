import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type Point = [number, number];
type Quad = [Point, Point, Point, Point];

interface WarpOcrResult {
    warpedPlate: string;
    ocrText: string | null;
}

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
        const ocrText = await this.runOCR(warpedBase64);

        return { warpedPlate: warpedBase64, ocrText };
    }

    async runOCR(base64Image: string): Promise<string | null> {
        const inputPath = path.join(os.tmpdir(), `ocr_input_${Date.now()}.png`);

        try {
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(inputPath, Buffer.from(base64Data, 'base64'));

            return await this.executePythonOCR(inputPath);
        } catch (error) {
            console.error('OCR processing failed:', error);
            this.cleanupFile(inputPath);
            return null;
        }
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

    private executePythonOCR(inputPath: string): Promise<string | null> {
        return new Promise((resolve) => {
            const process = spawn('python3', ['scripts/plate_ocr.py', inputPath]);

            let stdOutput = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => (stdOutput += data.toString()));
            process.stderr.on('data', (data) => (errorOutput += data.toString()));

            process.on('close', (exitCode) => {
                this.cleanupFile(inputPath);

                if (exitCode === 0) {
                    resolve(stdOutput.trim());
                } else {
                    console.error('OCR script error:', errorOutput);
                    resolve(null);
                }
            });

            process.on('error', (error) => {
                console.error('Failed to start Python process:', error);
                this.cleanupFile(inputPath);
                resolve(null);
            });
        });
    }

    private executePythonWarp(inputPath: string, outputPath: string, quad: Quad): Promise<boolean> {
        return new Promise((resolve) => {
            const args = ['scripts/warp_perspective.py', inputPath, outputPath, ...quad.flat().map(String)];
            const process = spawn('python3', args);

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