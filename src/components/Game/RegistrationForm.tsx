import React, { useState } from 'react';
import styles from './RegistrationForm.module.css';
import { User } from 'lucide-react';

interface RegistrationFormProps {
    onRegister: (name: string, email: string) => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onRegister }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Name is required');
            return;
        }
        onRegister(name.trim(), email.trim());
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>PARTICIPANT REGISTRATION</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                    <User className={styles.icon} size={20} />
                    <input
                        type="text"
                        placeholder="Enter Name / Team Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={styles.input}
                        autoFocus
                    />
                </div>

                <div className={styles.inputGroup}>
                    <span className={styles.icon}>@</span>
                    <input
                        type="email"
                        placeholder="Email (Optional)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={styles.input}
                    />
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button type="submit" className={styles.submitBtn}>
                    ENTER ARENA
                </button>
            </form>
        </div>
    );
};

export default RegistrationForm;
