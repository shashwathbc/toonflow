import { Group, Rect, Ellipse, Textbox, Path, Canvas } from 'fabric';

export type BubbleType = 'normal' | 'thinking' | 'shouting' | 'narration' | 'happy' | 'scared';

export const createSmartBubble = (canvas: Canvas, type: BubbleType, x: number, y: number) => {
    let shape: any;
    let textContent = "TEXT";
    const commonProps = {
        fill: 'white',
        stroke: 'black',
        strokeWidth: 3,
        originX: 'center' as const,
        originY: 'center' as const,
    };

    switch (type) {
        case 'normal':
            shape = new Ellipse({
                rx: 70,
                ry: 50,
                ...commonProps
            });
            break;

        case 'thinking':
            // "Cloud" thought bubble
            const thinkingPath = "M 50 20 Q 60 5 80 20 Q 100 5 110 20 Q 130 10 130 30 Q 145 40 130 50 Q 140 70 120 70 Q 110 85 90 75 Q 70 85 50 70 Q 30 75 25 60 Q 5 50 20 40 Q 5 25 25 20 Q 35 5 50 20 Z";
            shape = new Path(thinkingPath, {
                ...commonProps,
                scaleX: 1.5,
                scaleY: 1.5
            });
            textContent = "THINKING";
            break;

        case 'shouting':
            // Jagged/Spiky starburst
            const shoutingPath = "M 50 10 L 60 30 L 80 10 L 85 35 L 110 20 L 100 50 L 130 60 L 105 80 L 120 110 L 90 95 L 80 120 L 65 95 L 40 120 L 40 90 L 10 100 L 30 70 L 5 50 L 35 40 Z";
            shape = new Path(shoutingPath, {
                ...commonProps,
                scaleX: 1.2,
                scaleY: 1.2
            });
            textContent = "SHOUTING!";
            break;

        case 'narration':
            shape = new Rect({
                width: 160,
                height: 90,
                ...commonProps
            });
            textContent = "NARRATION";
            break;

        case 'happy':
            // Soft cloud/flower shape
            const happyPath = "M 50 20 Q 70 10 90 20 Q 110 10 130 30 Q 140 50 130 70 Q 140 90 120 100 Q 100 110 80 100 Q 60 110 40 100 Q 20 90 30 70 Q 20 50 30 30 Q 20 10 50 20 Z";
            shape = new Path(happyPath, {
                ...commonProps,
                scaleX: 1.1,
                scaleY: 1.1
            });
            textContent = "Happy!";
            break;

        case 'scared':
            // Wavy/Trembling outline
            const scaredPath = "M 50 20 Q 55 25 60 20 Q 65 15 70 20 Q 75 25 80 20 Q 85 15 90 20 Q 95 25 100 20 L 100 80 Q 95 75 90 80 Q 85 85 80 80 Q 75 75 70 80 Q 65 85 60 80 Q 55 75 50 80 L 50 20 Z";
            // Making it rounder/more irregular manually would be better, but this simple wave rect works for now
            const scaredOvalPath = "M 40 20 Q 45 15 50 20 Q 55 25 60 20 Q 65 15 70 20 Q 75 25 80 20 Q 85 15 90 20 Q 95 25 100 20 C 120 20 120 80 100 80 Q 95 85 90 80 Q 85 75 80 80 Q 75 85 70 80 Q 65 75 60 80 Q 55 85 50 80 C 30 80 30 20 40 20 Z";

            shape = new Path(scaredOvalPath, {
                ...commonProps,
                scaleX: 1.5,
                scaleY: 1.2
            });
            textContent = "Scared...";
            break;

        default:
            shape = new Ellipse({ rx: 60, ry: 45, ...commonProps });
    }

    // Smart Textbox
    const text = new Textbox(textContent, {
        fontSize: 16,
        fontFamily: 'Comic Sans MS, cursive, sans-serif',
        fill: 'black',
        originX: 'center',
        originY: 'center',
        textAlign: 'center',
        width: 100,
        splitByGrapheme: false, // Word wrap for comics
        editable: true,
        bg: 'bubbleText' // Custom tag for identification
    });

    // Create Group
    const group = new Group([shape, text], {
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        interactive: true,
        subTargetCheck: true, // Crucial: Allows double-clicking text inside group
        data: {
            type: 'smartBubble',
            bubbleType: type
        }
    } as any);

    // Add Auto-Fit Logic Listener?
    // Note: Fabric logic usually needs to be attached to canvas events or the object itself
    // For now, we return the group. We can attach specific listeners in the main canvas loop if needed.

    return group;
};
