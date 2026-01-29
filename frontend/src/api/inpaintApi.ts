const API_BASE_URL = 'http://localhost:5050'; // Adjust if needed

export async function requestInpainting(params: {
    baseImage: string;
    mask: string;
    prompt: string;
    style: string;
}): Promise<{ imageUrl: string }> {
    const response = await fetch(`${API_BASE_URL}/api/inpaint`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Inpainting failed');
    }

    return response.json();
}
