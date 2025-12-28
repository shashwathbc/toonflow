import { auth } from "@/lib/firebase";

const API_BASE = "http://localhost:5050/api/projects";

export const getHeaders = () => {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };
    const user = auth.currentUser;
    if (user) {
        headers["x-user-id"] = user.uid;
    }
    return headers;
};

// Dummy Data for fallback
const DUMMY_PROJECT: Project = {
    _id: "training-dummy-id",
    userId: "local-user",
    name: "Training",
    description: "A local training project",
    tags: ["demo", "training"],
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chapters: [
        {
            chapterId: "intro-chapter",
            title: "Intro",
            order: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            pages: [
                {
                    pageId: "page-1",
                    order: 1,
                    canvasData: {}, // Empty canvas
                    updatedAt: new Date().toISOString()
                }
            ]
        }
    ]
};

export interface Project {
    _id: string;
    userId: string;
    name: string;
    description?: string;
    tags?: string[];
    chapters: Chapter[];
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Chapter {
    chapterId: string;
    title: string;
    order: number;
    pages: Page[];
    createdAt: string;
    updatedAt: string;
}

export interface Page {
    pageId: string;
    order: number;
    canvasData: any;
    thumbnailUrl?: string;
    updatedAt: string;
}

export const fetchProjects = async (): Promise<Project[]> => {
    try {
        const res = await fetch(API_BASE, {
            headers: getHeaders(),
        });
        if (!res.ok) {
            console.warn("Fetch projects failed, using dummy data");
            return [DUMMY_PROJECT];
        }
        const data = await res.json();
        // Always append dummy project if not present, or just return mixed?
        // User asked to "keep one dummy...". Let's append it to result.
        return [...data.projects, DUMMY_PROJECT];
    } catch (e) {
        console.warn("Network error, using dummy data", e);
        return [DUMMY_PROJECT];
    }
};

export const createProject = async (name: string, description: string, tags: string[]): Promise<Project> => {
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ name, description, tags }),
    });
    if (!res.ok) {
        throw new Error("Failed to create project");
    }
    return await res.json();
};

export const deleteProject = async (projectId: string): Promise<void> => {
    if (projectId === DUMMY_PROJECT._id) {
        throw new Error("Cannot delete the training project.");
    }
    const res = await fetch(`${API_BASE}/${projectId}`, {
        method: "DELETE",
        headers: getHeaders(),
    });
    if (!res.ok) {
        throw new Error("Failed to delete project");
    }
};

export const getProjectDetails = async (projectId: string): Promise<Project> => {
    if (projectId === DUMMY_PROJECT._id) {
        return DUMMY_PROJECT;
    }
    const res = await fetch(`${API_BASE}/${projectId}`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch project details");
    return await res.json();
};

export const addChapter = async (projectId: string, title: string): Promise<Project> => {
    if (projectId === DUMMY_PROJECT._id) {
        throw new Error("Cannot add chapters to the training project.");
    }
    const res = await fetch(`${API_BASE}/${projectId}/chapters`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error("Failed to add chapter");
    return await res.json();
};

export const savePage = async (projectId: string, chapterId: string, pageData: Partial<Page>): Promise<Page> => {
    if (projectId === DUMMY_PROJECT._id) {
        // Mock save - in memory only for session?
        // For now, just return success with updated data
        return {
            pageId: pageData.pageId || "page-1",
            order: pageData.order || 1,
            canvasData: pageData.canvasData || {},
            thumbnailUrl: pageData.thumbnailUrl,
            updatedAt: new Date().toISOString()
        };
    }
    const res = await fetch(`${API_BASE}/${projectId}/chapters/${chapterId}/pages/save`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(pageData)
    });
    if (!res.ok) throw new Error("Failed to save page");
    const data = await res.json();
    return data.page;
};

export const loadPage = async (projectId: string, chapterId: string, pageId: string): Promise<any> => {
    if (projectId === DUMMY_PROJECT._id) {
        // Return empty canvas or find from DUMMY_PROJECT structure
        const chapter = DUMMY_PROJECT.chapters.find(c => c.chapterId === chapterId);
        const page = chapter?.pages.find(p => p.pageId === pageId);
        return { canvasData: page?.canvasData || {} };
    }
    const res = await fetch(`${API_BASE}/${projectId}/chapters/${chapterId}/pages/${pageId}`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to load page");
    return await res.json();
};
