import React from 'react';
import styles from './LetterDisplay.module.css';

interface LetterDisplayProps {
  letter: string;
}

const LetterDisplay: React.FC<LetterDisplayProps> = ({ letter }) => {
  return (
    <div className={styles.container}>
      <div className={styles.letterGlow}>{letter}</div>
      <h1 className={styles.letter}>{letter}</h1>
    </div>
  );
};

export default LetterDisplay;
