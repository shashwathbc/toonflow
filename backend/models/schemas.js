import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true }, // Google UID
    email: { type: String },
    name: { type: String },
    createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', UserSchema);

const PageSchema = new mongoose.Schema({
    pageId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    order: { type: Number, required: true },
    canvasData: { type: Object }, // Fabric.js JSON
    thumbnailUrl: { type: String },
    updatedAt: { type: Date, default: Date.now }
});

const ChapterSchema = new mongoose.Schema({
    chapterId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    pages: [PageSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const ProjectSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true }, // Google UID
    isDefault: { type: Boolean, default: false },
    name: { type: String, required: true },
    description: { type: String },
    tags: [{ type: String }],
    chapters: [ChapterSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export const Project = mongoose.model('Project', ProjectSchema);
