import React, { useRef, useEffect } from 'react';
import styles from './InputArea.module.css';

interface InputAreaProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    disabled: boolean;
    isError?: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ value, onChange, onSubmit, disabled, isError }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!disabled && inputRef.current) {
            inputRef.current.focus();
        }
    }, [disabled]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSubmit();
        }
    };

    return (
        <div className={styles.container}>
            <input
                ref={inputRef}
                type="text"
                className={`${styles.input} ${isError ? styles.error : ''}`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a tech term..."
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
            />
            <div className={styles.focusBorder}></div>
        </div>
    );
};

export default InputArea;
