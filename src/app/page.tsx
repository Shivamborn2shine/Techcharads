import GameContainer from '@/components/Game/GameContainer';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <GameContainer />
    </main>
  );
}
