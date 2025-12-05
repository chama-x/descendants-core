import Scene from '@/components/Core/Scene';
import Overlay from '@/components/UI/Overlay';
import { Crosshair } from '@/components/UI/Crosshair';
import { AgentInspector } from '@/components/UI/AgentInspector';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <Crosshair />
      <AgentInspector />
      <main className={styles.main}>
        <Scene />
      </main>
    </div>
  );
}
