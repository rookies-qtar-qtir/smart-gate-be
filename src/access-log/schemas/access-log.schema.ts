import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ timestamps: true })
export class AccessLog {
    @Prop({ required: true, unique: true })
    uid: string;

    @Prop({ default: Date.now })
    time: Date;

    @Prop({ required: true })
    access: Boolean;
};

export const AccessLogSchema = SchemaFactory.createForClass(AccessLog);