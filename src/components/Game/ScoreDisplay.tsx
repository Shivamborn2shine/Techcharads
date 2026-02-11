import React from 'react';
import styles from './ScoreDisplay.module.css';

interface ScoreDisplayProps {
    score: number;
    highScore: number;
    round: number;
    maxRounds: number;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score, highScore, round, maxRounds }) => {
    return (
        <div className={styles.container}>
            <div className={styles.scoreBox}>
                <span className={styles.label}>ROUND</span>
                <span className={styles.value}>{round} / {maxRounds}</span>
            </div>
            <div className={styles.scoreBox}>
                <span className={styles.label}>SCORE</span>
                <span className={styles.value}>{score.toFixed(1)}</span>
            </div>
            <div className={`${styles.scoreBox} ${styles.highScore}`}>
                <span className={styles.label}>BEST</span>
                <span className={styles.value}>{highScore}</span>
            </div>
        </div>
    );
};

export default ScoreDisplay;
