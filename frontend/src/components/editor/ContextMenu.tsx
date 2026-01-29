import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    // Prevent menu from going off-screen
    const style: React.CSSProperties = {
        left: x,
        top: y,
    };

    // Adjust if close to right/bottom edge (simple logic)
    if (window.innerWidth - x < 200) style.left = x - 200;
    if (window.innerHeight - y < 200) style.top = y - items.length * 40;

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[180px] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"
            style={style}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, index) => (
                <button
                    key={index}
                    onClick={() => {
                        if (!item.disabled) {
                            item.onClick();
                            onClose();
                        }
                    }}
                    disabled={item.disabled}
                    className={`
                        w-full px-4 py-2 text-sm text-left flex items-center gap-2
                        transition-colors duration-100
                        ${item.disabled
                            ? 'text-zinc-500 cursor-not-allowed'
                            : item.danger
                                ? 'text-red-400 hover:bg-red-500/10'
                                : 'text-zinc-200 hover:bg-zinc-700'
                        }
                    `}
                >
                    {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                    {item.label}
                </button>
            ))}
        </div>,
        document.body
    );
};
