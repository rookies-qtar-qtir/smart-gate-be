import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UserService {
    constructor(
        @InjectModel(User.name) 
        private userModel: mongoose.Model<User>,
    ) {}

    async createUser(data: Partial<User>): Promise<User> {
        return this.userModel.create(data);
    }

    async findAll(): Promise<User[]> {
        return this.userModel.find().exec();
    }

    async findOne(_id: string): Promise<User | null> {
        return this.userModel.findOne({ _id }).exec();
    }

    async updateUser(_id: string, updateData: Partial<User>): Promise<User | null> {
        return this.userModel.findOneAndUpdate({ _id }, updateData, {new: true}).exec();
    }

    async deleteUser(_id: string): Promise<User | null> {
        return this.userModel.findOneAndDelete({ _id }).exec();
    }
}
