import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { AccessLogsModule } from './access-logs/access-logs.module';
import { TfjsModule } from './tfjs/tfjs.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { OcrModule } from './ocr/ocr.module';
import { ClassificationModule } from './classification/classification.module';
import { DetectionPlateModule } from './detection-plate/detection-plate.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UsersModule,
    AccessLogsModule,
    TfjsModule,
    AuthModule,
    OcrModule,
    ClassificationModule,
    DetectionPlateModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule { }