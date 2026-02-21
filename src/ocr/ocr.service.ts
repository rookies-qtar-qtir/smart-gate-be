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

@Injectable()
export class OcrService {
    private getPythonCommand(): string {
        if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;

        const venvPath = path.join(process.cwd(), '.venv');
        if (fs.existsSync(venvPath)) {
            return path.join(
                venvPath,
                process.platform === 'win32' ? 'Scripts' : 'bin',
                process.platform === 'win32' ? 'python.exe' : 'python'
            );
        }

        return process.platform === 'win32' ? 'python' : 'python3';
    }

    async warpAndOcr(imageBuffer: Buffer, quad: Quad | null): Promise<WarpOcrResult | null> {
        if (!quad || quad.length !== 4) return null;

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
            this.cleanupFile(inputPath);
            return { ocrText: null, processedImage: null, error: 'Exception occurred' };
        }
    }

    private executePythonOCR(inputPath: string): Promise<PythonOcrResponse> {
        return new Promise((resolve) => {
            const scriptPath = path.join(process.cwd(), 'scripts', 'plate_ocr.py');
            const childPython = spawn(this.getPythonCommand(), [scriptPath, inputPath]);

            let stdOutput = '';
            let errorOutput = '';

            childPython.stdout.on('data', (data) => (stdOutput += data.toString()));
            childPython.stderr.on('data', (data) => (errorOutput += data.toString()));

            childPython.on('close', (exitCode) => {
                this.cleanupFile(inputPath);

                if (exitCode === 0) {
                    try {
                        const result: PythonOcrResponse = JSON.parse(stdOutput.trim());
                        resolve(result);
                    } catch (e) {
                        resolve({ ocrText: null, processedImage: null, error: 'Invalid JSON output' });
                    }
                } else {
                    resolve({ ocrText: null, processedImage: null, error: errorOutput });
                }
            });

            childPython.on('error', (error) => {
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
            return fs.readFileSync(outputPath);
        } finally {
            this.cleanupFile(inputPath);
            this.cleanupFile(outputPath);
        }
    }

    private executePythonWarp(inputPath: string, outputPath: string, quad: Quad): Promise<boolean> {
        return new Promise((resolve) => {
            const scriptPath = path.join(process.cwd(), 'scripts', 'warp_perspective.py');
            const args = [scriptPath, inputPath, outputPath, ...quad.flat().map(String)];
            const childPython = spawn(this.getPythonCommand(), args);

            childPython.on('close', (exitCode) => {
                resolve(exitCode === 0);
            });

            childPython.on('error', () => {
                resolve(false);
            });
        });
    }

    private cleanupFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) { }
    }
}