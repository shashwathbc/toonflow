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

// --- Constants for Auto-Fit ---
const MAX_FONT_SIZE = 40;
const MIN_FONT_SIZE = 12;

/**
 * Adjusts the font size of the text element within a group to fit the bubble shape.
 * Follows strict rules: Text Containment, Dynamic Scaling (Grow/Shrink), Constraints.
 * @param group The bubble group containing the shape and text
 */
export const autoFitText = (group: Group) => {
    // 1. Get references
    const objects = group.getObjects();
    const shape = objects[0];
    const text = objects[1] as Textbox;

    if (!shape || !text || text.type !== 'textbox') return;

    // 2. Determine Safe Area based on Shape Type
    // We need unscaled dimensions relative to the group's coordinate system
    const scaleX = group.scaleX || 1;
    const scaleY = group.scaleY || 1;

    // Unscaled dimensions of the group wrapper
    const groupWidth = group.width;
    const groupHeight = group.height;

    // Absolute screen dimensions (for reference/debugging, though logic uses relative)
    const fullWidth = groupWidth * scaleX;
    const fullHeight = groupHeight * scaleY;

    // Safe Area Ratios (Percentage of total width/height usable for text)
    // Customize per bubble type for better visual fit
    // REDUCED RATIOS to ensure text stays well inside borders
    let safeRatioX = 0.7;
    let safeRatioY = 0.6;

    // @ts-ignore
    const type = group.data?.bubbleType || 'normal';

    switch (type) {
        case 'thinking':
            safeRatioX = 0.7;
            safeRatioY = 0.55; // Clouds/Thought bubbles usually have tails/irregularities
            break;
        case 'shouting':
            safeRatioX = 0.55; // Spikes need more clearance
            safeRatioY = 0.55;
            break;
        case 'scared':
            safeRatioX = 0.65;
            safeRatioY = 0.65;
            break;
        case 'narration':
            safeRatioX = 0.85; // Rectangles utilize space well
            safeRatioY = 0.85;
            break;
        case 'normal':
        default:
            safeRatioX = 0.75;
            safeRatioY = 0.65;
            break;
    }

    // Calculate Available Dimensions (Unscaled relative to group)
    // The textbox is inside the group, so it inherits the group's scale.
    // We set the textbox's width/fontSize in *local* units.

    // However, Fabric Textbox 'width' defines the wrapping point.
    // If we want the text to wrap at 80% of the bubble's visual width,
    // we set text.width = group.width * safeRatioX.

    const targetWidth = groupWidth * safeRatioX;
    const targetMaxHeight = groupHeight * safeRatioY;

    // 3. Apply Width Constraint (Wrap)
    if (text.width !== targetWidth) {
        text.set('width', targetWidth);
    }

    // 4. Dynamic Font Scaling (Grow/Shrink Algorithm)
    // Rule: "When user deletes text -> Font size increases back up"
    // Approach: Reset to MAX, then shrink until it fits or hits MIN.

    // Start at MAX
    let currentFontSize = MAX_FONT_SIZE;
    text.set('fontSize', currentFontSize);

    // Helper to check fit
    // Textbox height with cur font size vs Available Height
    // fabric 6 / recent: .height is usually accurate after set width
    // note: text.height is unscaled local height.
    // Since text and shape are both in group with same scale, we compare local height to local constraint.

    // Loop to shrink
    // We use a simple loop. Binary search is optimization but loop is safe for < 40 steps.
    while (
        (text.height! > targetMaxHeight) &&
        currentFontSize > MIN_FONT_SIZE
    ) {
        currentFontSize--;
        text.set('fontSize', currentFontSize);
        // Force recalc if needed, though 'set' usually triggers it.
        // In newer fabric versions, we might need to access height via method if property is stale?
        // text.height should be a getter or updated property.
    }

    // 5. Final Centering
    text.set({
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0
    });
};
