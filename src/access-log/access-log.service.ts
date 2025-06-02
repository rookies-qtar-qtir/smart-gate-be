import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { AccessLog } from './schemas/access-log.schema';

@Injectable()
export class AccessLogService {
  constructor(
    @InjectModel(AccessLog.name)
    private accessLogModel: mongoose.Model<AccessLog>,
  ) { }

  async create(log: Partial<AccessLog>): Promise<AccessLog> {
    return this.accessLogModel.create(log);
  }

  async findAll(): Promise<AccessLog[]> {
    return this.accessLogModel.find().sort({ time: -1 }).exec();
  }

  async findByUid(uid: string): Promise<AccessLog[]> {
    return this.accessLogModel.find({ uid }).sort({ time: -1 }).exec();
  }

  async findByDate(start: Date, end: Date): Promise<AccessLog[]> {
    return this.accessLogModel.find({ time: { $gte: start, $lte: end } })
      .sort({ time: -1 }).exec();
  }
}
