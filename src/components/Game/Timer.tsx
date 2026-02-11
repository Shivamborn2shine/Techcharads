import React, { useEffect, useState } from 'react';
import styles from './Timer.module.css';

interface TimerProps {
    duration: number;
    timeLeft: number;
}

const Timer: React.FC<TimerProps> = ({ duration, timeLeft }) => {
    const percentage = (timeLeft / duration) * 100;

    // Color transition based on percentage
    const getColor = () => {
        if (percentage > 50) return 'var(--primary)';
        if (percentage > 20) return 'var(--secondary)';
        return 'var(--accent)';
    };

    return (
        <div className={styles.container}>
            <div className={styles.timeText} style={{ color: getColor() }}>
                {timeLeft.toFixed(1)}s
            </div>
            <div className={styles.progressContainer}>
                <div
                    className={styles.progressBar}
                    style={{
                        width: `${percentage}%`,
                        backgroundColor: getColor(),
                        boxShadow: `0 0 10px ${getColor()}`
                    }}
                />
            </div>
        </div>
    );
};

export default Timer;
