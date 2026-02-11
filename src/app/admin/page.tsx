"use client";

import React, { useState } from 'react';
import styles from './page.module.css';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { Lock, Eye, X, Check, XCircle, Calculator, Download, Filter } from 'lucide-react';

const ADMIN_PASSWORD = "Velvet10";

interface RoundData {
    round: number;
    letter: string;
    input: string;
    timeLeft: number;
    score: number;
    verified?: boolean | null; // true = accepted, false = rejected, null/undefined = pending
}

interface GameResult {
    id: string;
    name: string;
    studentId: string;
    totalScore: number;
    roundsCompleted: number;
    rounds?: RoundData[];
    timestamp: any;
    clientTimestamp?: string;
}

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [results, setResults] = useState<GameResult[]>([]);
    const [selectedResult, setSelectedResult] = useState<GameResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchInput, setBatchInput] = useState('');
    const [processingBatch, setProcessingBatch] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
            fetchResults();
        } else {
            alert("Invalid Password");
        }
    };

    const fetchResults = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "results"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            const data: GameResult[] = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as GameResult);
            });
            setResults(data);
        } catch (error) {
            console.error("Error fetching results:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportInputs = () => {
        const allInputs = new Set<string>();
        results.forEach(res => {
            if (res.rounds) {
                res.rounds.forEach(r => {
                    if (r.input && r.input.trim().length > 0 && r.verified !== true) {
                        allInputs.add(r.input.trim().toUpperCase());
                    }
                });
            }
        });

        const exportText = Array.from(allInputs).sort().join('\n');
        navigator.clipboard.writeText(exportText).then(() => {
            alert(`Copied ${allInputs.size} unique inputs to clipboard! Paste into your AI tool.`);
        });
    };

    const handleBatchVerify = async () => {
        if (!batchInput.trim()) return;
        setProcessingBatch(true);

        // Normalize approved terms
        const approvedTerms = new Set(
            batchInput.split(/[\n,]+/).map(t => t.trim().toUpperCase()).filter(t => t.length > 0)
        );

        let updateCount = 0;

        try {
            // Process all results locally first
            const updates = results.map(async (res) => {
                let modified = false;
                if (!res.rounds) return res;

                const newRounds = res.rounds.map(r => {
                    // Only verify if currently not verified (null/false) and matches approved list
                    if (r.verified !== true && r.input && approvedTerms.has(r.input.trim().toUpperCase())) {
                        modified = true;
                        return { ...r, verified: true };
                    }
                    return r;
                });

                if (modified) {
                    // Calculate new score
                    let newScore = 0;
                    newRounds.forEach(r => {
                        if (r.verified === true) newScore += r.score;
                    });

                    // Update Firestore
                    const resultRef = doc(db, "results", res.id);
                    await updateDoc(resultRef, {
                        rounds: newRounds,
                        verifiedScore: newScore
                    });

                    updateCount++;
                    return { ...res, rounds: newRounds, verifiedScore: newScore };
                }
                return res;
            });

            await Promise.all(updates);

            // Refresh local state
            fetchResults();
            alert(`Batch verification complete! Updated ${updateCount} records.`);
            setShowBatchModal(false);
            setBatchInput('');
        } catch (error) {
            console.error("Batch update error:", error);
            alert("Error running batch verification");
        } finally {
            setProcessingBatch(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        if (timestamp.seconds) {
            return new Date(timestamp.seconds * 1000).toLocaleString();
        }
        return new Date(timestamp).toLocaleString();
    };

    const verifyRound = async (resultId: string, roundIndex: number, status: boolean) => {
        if (!selectedResult || !selectedResult.rounds) return;

        const updatedRounds = [...selectedResult.rounds];
        updatedRounds[roundIndex].verified = status;

        // Recalculate verified score
        // Only include rounds that are explicitly verified as true
        // If rejected (false), score is 0
        // If pending (null/undefined), we optionally include or exclude. 
        // Requirement: "if yes then only the remaining time points will be added up... if no then deduct"
        // Interpretation: Base score is 0. Only accepted rounds add points.

        // Calculate new total based on verification
        let newTotalScore = 0;
        updatedRounds.forEach(r => {
            if (r.verified === true) {
                newTotalScore += r.score;
            }
        });

        // Update local state immediately for UI responsiveness
        const updatedResult = {
            ...selectedResult,
            rounds: updatedRounds,
            verifiedScore: newTotalScore // Optional: store this separately or overwrite totalScore?
            // Let's store a separate "verifiedScore" in logic, but standard totalScore remains original for record?
            // Actually, let's update the main score or keep both. 
            // User said: "give me option... to accept or not... is yes then added... if no then deduct"
        };

        setSelectedResult(updatedResult);

        // Update Firestore
        try {
            const resultRef = doc(db, "results", resultId);
            await updateDoc(resultRef, {
                rounds: updatedRounds,
                verifiedScore: newTotalScore
            });

            // Also update the list view
            setResults(prev => prev.map(r => r.id === resultId ? { ...r, rounds: updatedRounds, verifiedScore: newTotalScore } : r) as GameResult[]);

        } catch (error) {
            console.error("Error updating verification:", error);
            alert("Failed to save verification");
        }
    };

    const getVerifiedScore = (res: GameResult) => {
        // If verifiedScore exists in DB, use it.
        // Otherwise calculate it (if some rounds are verified).
        // If no rounds are verified, maybe show original pending score?
        // Let's show "Verified Score" explicitly.
        if ((res as any).verifiedScore !== undefined) return (res as any).verifiedScore;

        // Default calculation if not saved
        let score = 0;
        if (res.rounds) {
            // If absolutely NO rounds have been verified yet, maybe we assume all are pending?
            // But user wants an explicit check. 
            // Let's assume 0 until verified.
            const hasAnyVerification = res.rounds.some(r => r.verified !== undefined && r.verified !== null);
            if (!hasAnyVerification) return 0; // Or return res.totalScore if we want to default to auto-score?

            res.rounds.forEach(r => {
                if (r.verified === true) score += r.score;
            });
        }
        return score;
    };

    if (!isAuthenticated) {
        return (
            <div className={styles.loginContainer}>
                <form onSubmit={handleLogin} className={styles.loginForm}>
                    <Lock size={48} className={styles.lockIcon} />
                    <h1>Admin Access</h1>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter Password"
                        className={styles.input}
                        autoFocus
                    />
                    <button type="submit" className={styles.loginBtn}>Login</button>
                </form>
            </div>
        );
    }

    return (
        <div className={styles.dashboard}>
            <header className={styles.header}>
                <h1>Admin Dashboard</h1>
                <div className={styles.headerActions}>
                    <button onClick={handleExportInputs} className={styles.actionBtn} title="Export unverified inputs for AI">
                        <Download size={16} /> Export Inputs
                    </button>
                    <button onClick={() => setShowBatchModal(true)} className={styles.actionBtn} title="Batch Verify with AI List">
                        <Filter size={16} /> Batch Verify
                    </button>
                    <button onClick={fetchResults} className={styles.refreshBtn}>Refresh Data</button>
                </div>
            </header>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Auto Score</th>
                            <th>Verified Score</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((res) => (
                            <tr key={res.id}>
                                <td>
                                    <div className={styles.nameCell}>
                                        <span className={styles.name}>{res.name}</span>
                                        <span className={styles.email}>{res.studentId}</span>
                                    </div>
                                </td>
                                <td className={styles.score}>{Number(res.totalScore || (res as any).score || 0).toFixed(1)}</td>
                                <td className={styles.verifiedScore}>
                                    {((res as any).verifiedScore != null) ? Number((res as any).verifiedScore).toFixed(1) : '-'}
                                </td>
                                <td className={styles.date}>{formatDate(res.timestamp)}</td>
                                <td>
                                    <button
                                        className={styles.viewBtn}
                                        onClick={() => setSelectedResult(res)}
                                    >
                                        <Eye size={16} /> Data
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {loading && <p className={styles.loading}>Loading data...</p>}
            </div>

            {selectedResult && (
                <div className={styles.modalOverlay} onClick={() => setSelectedResult(null)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{selectedResult.name}</h2>
                            <button
                                className={styles.closeBtn}
                                onClick={() => setSelectedResult(null)}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.statGrid}>
                                <div className={styles.statBox}>
                                    <label>Auto Score</label>
                                    <span>{Number(selectedResult.totalScore || (selectedResult as any).score || 0).toFixed(1)}</span>
                                </div>
                                <div className={styles.statBox}>
                                    <label>Verified Score</label>
                                    <span className={styles.highlightScore}>
                                        {getVerifiedScore(selectedResult).toFixed(1)}
                                    </span>
                                </div>
                            </div>

                            <h3>Round Verification</h3>
                            {selectedResult.rounds && selectedResult.rounds.length > 0 ? (
                                <div className={styles.roundsList}>
                                    {selectedResult.rounds.map((r, idx) => (
                                        <div key={idx} className={`${styles.roundItem} ${r.verified === true ? styles.accepted : r.verified === false ? styles.rejected : ''}`}>
                                            <div className={styles.roundHeader}>
                                                <span className={styles.roundNum}>#{r.round}</span>
                                                <span className={styles.roundLetter}>{r.letter}</span>
                                            </div>
                                            <div className={styles.roundDetails}>
                                                <div className={styles.inputVal}>
                                                    <strong>{r.input || "(No Input)"}</strong>
                                                </div>
                                                <div className={styles.roundStats}>
                                                    <span>Time: {r.timeLeft.toFixed(1)}s</span>
                                                    <span>Pts: {r.score.toFixed(1)}</span>
                                                </div>
                                            </div>
                                            <div className={styles.actions}>
                                                <button
                                                    onClick={() => verifyRound(selectedResult.id, idx, true)}
                                                    className={`${styles.actionBtn} ${r.verified === true ? styles.activeGreen : ''}`}
                                                    title="Accept"
                                                >
                                                    <Check size={20} />
                                                </button>
                                                <button
                                                    onClick={() => verifyRound(selectedResult.id, idx, false)}
                                                    className={`${styles.actionBtn} ${r.verified === false ? styles.activeRed : ''}`}
                                                    title="Reject"
                                                >
                                                    <XCircle size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p>No round data available.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showBatchModal && (
                <div className={styles.modalOverlay} onClick={() => setShowBatchModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Batch Verification</h2>
                            <button className={styles.closeBtn} onClick={() => setShowBatchModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p>Paste the list of approved terms below (separated by newlines or commas). These will be automatically marked as verified in all records.</p>
                            <textarea
                                className={styles.batchInput}
                                value={batchInput}
                                onChange={(e) => setBatchInput(e.target.value)}
                                placeholder="PASTE APPROVED TERMS HERE..."
                                rows={10}
                                style={{ width: '100%', padding: '10px', margin: '10px 0', fontFamily: 'monospace' }}
                            />
                            <div className={styles.modalFooter} style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button className={styles.actionBtn} onClick={() => setShowBatchModal(false)}>Cancel</button>
                                <button
                                    className={`${styles.actionBtn} ${styles.activeGreen}`}
                                    onClick={handleBatchVerify}
                                    disabled={processingBatch}
                                >
                                    {processingBatch ? 'Processing...' : 'Verify Matches'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
