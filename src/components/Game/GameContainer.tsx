"use client";

import React, { useState, useEffect, useCallback } from 'react';
import LetterDisplay from './LetterDisplay';
import Timer from './Timer';
import InputArea from './InputArea';
import ScoreDisplay from './ScoreDisplay';
import RegistrationForm from './RegistrationForm';
import styles from './GameContainer.module.css';
import { Play, RotateCcw, Save, Lock } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { isTechTerm } from '@/data/techDictionary';

// Removing Q, X, Y, Z as they are harder. Keeping others.
const ALPHABET = "ABCDEFGHIJKLMNOPRSTUVW";
const GAME_DURATION = 45; // seconds per turn
const MAX_ROUNDS = 15;

interface Participant {
    name: string;
    studentId: string;
}

interface RoundData {
    round: number;
    letter: string;
    input: string;
    timeLeft: number;
    score: number;
    verified?: boolean | null;
}

const GameContainer: React.FC = () => {
    const [gameState, setGameState] = useState<'REGISTER' | 'IDLE' | 'PLAYING' | 'GAME_OVER'>('REGISTER');
    const [participant, setParticipant] = useState<Participant | null>(null);
    const [currentLetter, setCurrentLetter] = useState<string>('');
    const [inputVal, setInputVal] = useState<string>('');
    const [timeLeft, setTimeLeft] = useState<number>(GAME_DURATION);
    const [score, setScore] = useState<number>(0);
    const [round, setRound] = useState<number>(1);
    const [highScore, setHighScore] = useState<number>(0);
    const [inputError, setInputError] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [roundsHistory, setRoundsHistory] = useState<RoundData[]>([]);
    const [endTime, setEndTime] = useState<number | null>(null);

    const generateLetter = useCallback(() => {
        const randomIndex = Math.floor(Math.random() * ALPHABET.length);
        return ALPHABET[randomIndex];
    }, []);

    const handleRegister = (name: string, studentId: string) => {
        setParticipant({ name, studentId });
        setGameState('IDLE');
    };

    const startGame = () => {
        setScore(0);
        setRound(1);
        setRoundsHistory([]);
        startTurn();
    };

    const startTurn = () => {
        setCurrentLetter(generateLetter());
        const durationMs = GAME_DURATION * 1000;
        setEndTime(Date.now() + durationMs);
        setTimeLeft(GAME_DURATION);
        setInputVal('');
        setGameState('PLAYING');
        setInputError(false);
    };

    // Helper handling round end (either by submit or timeout)
    const handleRoundEnd = (points: number, timeRemaining: number, inputValue: string) => {
        // Prevent double calling
        if (gameState !== 'PLAYING') return;

        // Capture current round data
        const newRoundData: RoundData = {
            round: round,
            letter: currentLetter,
            input: inputValue,
            timeLeft: timeRemaining,
            score: points,
            verified: isTechTerm(inputValue) ? true : null
        };

        const updatedHistory = [...roundsHistory, newRoundData];
        setRoundsHistory(updatedHistory);

        const newTotalScore = score + points;
        setScore(newTotalScore);

        if (round >= MAX_ROUNDS) {
            endGame(newTotalScore, updatedHistory);
        } else {
            setRound(prev => prev + 1);
            startTurn();
        }
    };

    const endGame = useCallback(async (finalScore: number, history: RoundData[]) => {
        setGameState('GAME_OVER');

        // Check local high score
        if (finalScore > highScore) {
            setHighScore(finalScore);
            localStorage.setItem('techCharads_highscore', finalScore.toString());
        }

        // Save to Firebase
        if (participant) {
            setIsSaving(true);
            try {
                await addDoc(collection(db, "results"), {
                    name: participant.name,
                    studentId: participant.studentId,
                    totalScore: finalScore,
                    roundsCompleted: MAX_ROUNDS,
                    rounds: history, // Save detailed history
                    timestamp: serverTimestamp(),
                    clientTimestamp: new Date().toISOString()
                });
                console.log("Score saved to Firebase");
            } catch (error) {
                console.error("Error saving score: ", error);
            } finally {
                setIsSaving(false);
            }
        }
    }, [highScore, participant]);

    // Timer logic
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (gameState === 'PLAYING' && endTime) {
            interval = setInterval(() => {
                const now = Date.now();
                const remaining = Math.max(0, (endTime - now) / 1000);

                setTimeLeft(remaining);

                if (remaining <= 0) {
                    clearInterval(interval);
                    handleRoundEnd(0, 0, inputVal); // Time ran out
                }
            }, 100);
        }

        return () => clearInterval(interval);
    }, [gameState, endTime, inputVal, roundsHistory, score]); // Dependencies for closure

    // Load high score
    useEffect(() => {
        const saved = localStorage.getItem('techCharads_highscore');
        if (saved) setHighScore(parseInt(saved));
    }, []);

    const handleInput = (val: string) => {
        setInputVal(val);
        if (inputError) setInputError(false);
    };

    const handleSubmit = () => {
        if (gameState !== 'PLAYING') return;

        const trimmedInput = inputVal.trim().toUpperCase();

        // Basic validation: Starts with correct letter and is not empty
        if (!trimmedInput || trimmedInput[0] !== currentLetter) {
            setInputError(true);
            return;
        }

        // Award points based on time left
        const points = timeLeft;
        handleRoundEnd(points, timeLeft, inputVal);
    };

    return (
        <div className={styles.gameWrapper}>

            {gameState !== 'REGISTER' && (
                <ScoreDisplay score={score} highScore={highScore} round={gameState === 'GAME_OVER' ? MAX_ROUNDS : round} maxRounds={MAX_ROUNDS} />
            )}

            <div className={styles.mainArea}>
                {gameState === 'REGISTER' && (
                    <RegistrationForm onRegister={handleRegister} />
                )}

                {gameState === 'IDLE' && (
                    <div className={styles.overlay}>
                        <h1 className={styles.title}>TECH CHARADS</h1>
                        <p className={styles.instruction}>Welcome, <span className={styles.highlight}>{participant?.name}</span></p>
                        <p className={styles.instruction}>15 Rounds • 45 Seconds Each</p>
                        <button className={styles.actionBtn} onClick={startGame}>
                            <Play size={24} /> START GAME
                        </button>
                    </div>
                )}

                {gameState === 'GAME_OVER' && (
                    <div className={styles.overlay}>
                        <h2 className={styles.gameOverTitle}>GAME FINISHED</h2>
                        <p className={styles.finalScore}>Final Score: {score}</p>
                        {isSaving && <p className={styles.saving}>Saving score...</p>}
                        <button className={styles.actionBtn} onClick={startGame}>
                            <RotateCcw size={24} /> PLAY AGAIN
                        </button>
                    </div>
                )}

                {(gameState === 'PLAYING') && (
                    <>
                        <LetterDisplay letter={currentLetter} />
                        <Timer duration={GAME_DURATION} timeLeft={timeLeft} />
                        <InputArea
                            value={inputVal}
                            onChange={handleInput}
                            onSubmit={handleSubmit}
                            disabled={gameState !== 'PLAYING'}
                            isError={inputError}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default GameContainer;
