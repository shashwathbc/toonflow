export const requireAuth = (req, res, next) => {
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing User ID' });
    }

    req.user = { userId };
    next();
};
