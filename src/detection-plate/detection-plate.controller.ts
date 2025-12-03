import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    BadRequestException,
    Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { DetectionPlateService } from './detection-plate.service';

@Public()
@Controller('detection-plate')
export class DetectionPlateController {
    constructor(private readonly service: DetectionPlateService) {}

    @Post()
    @UseInterceptors(FileInterceptor('image'))
    async detectAndCrop(
        @UploadedFile() file: Express.Multer.File,
        @Res() res: Response,
    ) {
        if (!file?.buffer) {
            throw new BadRequestException('File image tidak ada atau invalid');
        }

        const result = await this.service.cropPlateBySegmentation(file.buffer);

        if (!result) {
            return res.status(404).json({
                message: 'Tidak ada plat nomor terdeteksi',
                count: 0,
            });
        }

        res.setHeader('Content-Type', 'image/png');
        res.send(result.buffer);
    }
}