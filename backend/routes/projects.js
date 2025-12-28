import express from 'express';
import { Project, User } from '../models/schemas.js';

const router = express.Router();

// Helper to check ownership
const checkProjectOwnership = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { userId } = req.user;
        const project = await Project.findOne({ _id: projectId, userId });

        if (!project) {
            return res.status(404).json({ error: "Project not found or access denied" });
        }
        req.project = project;
        next();
    } catch (error) {
        res.status(500).json({ error: "Ownership check failed", details: error.message });
    }
};

// 1. Create Project
router.post('/', async (req, res) => {
    try {
        const { userId } = req.user;
        const { name, description, tags } = req.body;

        const newProject = new Project({
            userId,
            name,
            description,
            tags,
            chapters: []
        });

        await newProject.save();
        res.status(201).json(newProject);
    } catch (error) {
        res.status(500).json({ error: "Failed to create project", details: error.message });
    }
});

// 2. Get All Projects
router.get('/', async (req, res) => {
    try {
        const { userId } = req.user;

        // Ensure default project exists for this user
        // Using upsert-like logic or just check and create
        let defaultProject = await Project.findOne({ userId, isDefault: true });
        if (!defaultProject) {
            defaultProject = new Project({
                userId,
                isDefault: true,
                name: "training",
                description: "A default project for experimentation",
                chapters: [{
                    title: "Chapter 1",
                    order: 1,
                    pages: [{ order: 1, canvasData: {}, thumbnailUrl: "" }]
                }]
            });
            await defaultProject.save();
        }

        const projects = await Project.find({ userId }).sort({ createdAt: -1 });
        res.json({ projects });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch projects", details: error.message });
    }
});

// 3. Delete Project
router.delete('/:projectId', checkProjectOwnership, async (req, res) => {
    try {
        const { project } = req;

        if (project.isDefault) {
            return res.status(403).json({ error: "Cannot delete default project" });
        }

        await Project.deleteOne({ _id: project._id });
        res.json({ message: "Project deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete project", details: error.message });
    }
});

// 5. Get Project Details
router.get('/:projectId', checkProjectOwnership, async (req, res) => {
    res.json(req.project);
});

// 4. Add Chapter
router.post('/:projectId/chapters', checkProjectOwnership, async (req, res) => {
    try {
        const { project } = req;
        const { title } = req.body;

        const newOrder = (project.chapters.length > 0)
            ? Math.max(...project.chapters.map(c => c.order)) + 1
            : 1;

        const newChapter = {
            title,
            order: newOrder,
            pages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        project.chapters.push(newChapter);
        await project.save();

        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ error: "Failed to add chapter", details: error.message });
    }
});

// 6. Save Canvas Page
router.post('/:projectId/chapters/:chapterId/pages/save', checkProjectOwnership, async (req, res) => {
    try {
        const { project } = req;
        const { chapterId } = req.params;
        const { pageId, order, canvasData, thumbnailUrl } = req.body;

        const chapter = project.chapters.id(chapterId);
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }

        let page;
        if (pageId) {
            // Update existing
            page = chapter.pages.id(pageId);
            if (!page) return res.status(404).json({ error: "Page not found" });

            page.canvasData = canvasData;
            page.updatedAt = new Date();
            if (thumbnailUrl) page.thumbnailUrl = thumbnailUrl;
            if (order) page.order = order;
        } else {
            // Create New
            const newOrder = order || ((chapter.pages.length > 0) ? Math.max(...chapter.pages.map(p => p.order)) + 1 : 1);
            chapter.pages.push({
                order: newOrder,
                canvasData,
                thumbnailUrl,
                updatedAt: new Date()
            });
            // Get the last added page (which is the new one)
            page = chapter.pages[chapter.pages.length - 1];
        }

        project.updatedAt = new Date();
        chapter.updatedAt = new Date();

        await project.save();
        res.json({ page });

    } catch (error) {
        res.status(500).json({ error: "Failed to save page", details: error.message });
    }
});

// 7. Load Canvas Page
router.get('/:projectId/chapters/:chapterId/pages/:pageId', checkProjectOwnership, async (req, res) => {
    try {
        const { project } = req;
        const { chapterId, pageId } = req.params;

        const chapter = project.chapters.id(chapterId);
        if (!chapter) return res.status(404).json({ error: "Chapter not found" });

        const page = chapter.pages.id(pageId);
        if (!page) return res.status(404).json({ error: "Page not found" });

        res.json({ canvasData: page.canvasData });
    } catch (error) {
        res.status(500).json({ error: "Failed to load page", details: error.message });
    }
});

export default router;
