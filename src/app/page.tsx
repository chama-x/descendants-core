import Scene from '@/components/Core/Scene';
import Overlay from '@/components/UI/Overlay';
import { AgentInteractionUI } from '@/components/UI/AgentInteractionUI';

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Scene />
      <Overlay />
      <AgentInteractionUI />
    </main>
  );
}
