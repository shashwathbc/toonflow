export interface DemoChapter {
    id: string;
    title: string;
    pages: number;
    thumbnail?: string;
    createdAt: string;
}

export interface DemoProject {
    id: string;
    name: string;
    description: string;
    thumbnail?: string;
    chapters: DemoChapter[];
    createdAt: string;
}

export const demoProjects: DemoProject[] = [
    {
        id: 'demo-ramayana',
        name: 'Ramayana: The Immortal War',
        description: 'Experience the epic tale of Lord Rama in this stunning webtoon adaptation. Explore this demo project to learn the basics of manga creation.',
        thumbnail: '/ramayana-cover.png',
        createdAt: '2024-01-01T00:00:00Z',
        chapters: [
            {
                id: 'demo-ramayana-intro',
                title: 'Intro',
                pages: 12,
                thumbnail: '/ramayana-cover.png',
                createdAt: '2023-12-31T00:00:00Z'
            },
            {
                id: 'demo-ramayana-ch1',
                title: 'Chapter 1: The Exile Begins',
                pages: 5,
                thumbnail: '/ramayana-cover.png',
                createdAt: '2024-01-01T00:00:00Z'
            },
            {
                id: 'demo-ramayana-ch2',
                title: 'Chapter 2: Forest Encounter',
                pages: 5,
                thumbnail: '/ramayana-cover.png',
                createdAt: '2024-01-02T00:00:00Z'
            },
            {
                id: 'demo-ramayana-ch3',
                title: 'Chapter 3: The Golden Deer',
                pages: 5,
                thumbnail: '/ramayana-cover.png',
                createdAt: '2024-01-03T00:00:00Z'
            }
        ]
    }
];

// Helper function to check if a project is a demo
export const isDemoProject = (projectId: string): boolean => {
    return projectId.startsWith('demo-');
};

// Helper function to get demo project by ID
export const getDemoProject = (projectId: string): DemoProject | undefined => {
    return demoProjects.find(p => p.id === projectId);
};

// Helper function to get demo chapter
export const getDemoChapter = (projectId: string, chapterId: string): DemoChapter | undefined => {
    const project = getDemoProject(projectId);
    return project?.chapters.find(c => c.id === chapterId);
};
