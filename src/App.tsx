import { useCallback, useEffect, useRef, useState } from 'react';
import { createScene, SceneApi } from './game/scene3d';
import { sfx } from './game/sfx';
import { voice } from './game/voice';
import { CHALLENGES } from './challenges/Challenges';
import { ChallengeCtx, Who } from './types';
import { Confetti } from './components/Confetti';
import { FallbackStage } from './components/FallbackStage';

type Phase = 'intro' | 'greeting' | 'trial' | 'passed' | 'finale' | 'done';
const TOTAL = CHALLENGES.length;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const GREETING = "Greetings, mortal. Or ghost pretending to be mortal. My granddaughter Boo is fading. Prove you're human to save her. No pressure. Lots of pressure.";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneApi | null>(null);
  const fbRef = useRef<{ mouth: (who: Who, v: number) => void } | null>(null);
  const [webgl, setWebgl] = useState(true);
  const [phase, setPhase] = useState<Phase>('intro');
  const [step, setStep] = useState(0);
  const [passMsg, setPassMsg] = useState('');
  const [sub, setSub] = useState<{ who: Who; text: string }>({ who: 'grand', text: GREETING });
  const [muted, setMuted] = useState(sfx.isMuted());
  const [confetti, setConfetti] = useState(0);
  const runId = useRef(0);

  // 3D scene lifecycle
  useEffect(() => {
    const s = createScene(canvasRef.current!);
    sceneRef.current = s;
    setWebgl(s.ok);
    voice.onMouth = (who, v) => { s.mouth(who, v); fbRef.current?.mouth(who, v); };
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      voice.cancel();
      s.dispose();
    };
  }, []);

  const say = useCallback((text: string, who: Who = 'grand') => {
    setSub({ who, text });
    return voice.speak(who, text);
  }, []);

  const mood = useCallback((m: 'happy' | 'angry' | 'neutral') => {
    sceneRef.current?.mood(m);
    if (m === 'angry') sfx.play('buzz');
  }, []);
  const shake = useCallback(() => sceneRef.current?.shake(), []);
  const fail = useCallback(() => { mood('angry'); shake(); }, [mood, shake]);

  const setProgress = (n: number) => sceneRef.current?.setProgress(n / TOTAL);

  const begin = async () => {
    sfx.unlock();
    voice.enable();
    const id = ++runId.current;
    setPhase('greeting');
    await say(GREETING);
    if (runId.current === id) goto(0);
  };

  const goto = (n: number) => {
    runId.current++;
    voice.cancel();
    if (n >= TOTAL) return finale();
    setStep(n);
    setProgress(n);
    sceneRef.current?.cam(n + 1);
    sceneRef.current?.mood('neutral');
    setPhase('trial');
  };

  const onPass = useCallback((msg: string) => {
    sfx.play('chime');
    sceneRef.current?.mood('happy');
    sceneRef.current?.pass();
    setStep((s) => { const n = s + 1; sceneRef.current?.setProgress(n / TOTAL); return n; });
    setPassMsg(msg);
    setPhase('passed');
    say(msg);
  }, [say]);

  const finale = async () => {
    const id = ++runId.current;
    const scene = sceneRef.current;
    setPhase('finale');
    setStep(TOTAL);
    scene?.setProgress(1);
    scene?.mood('happy');
    await Promise.all([say('You... you actually did it. Boo? BOO?!'), sleep(2200)]);
    if (runId.current !== id) return;
    scene?.finale();
    setConfetti((c) => c + 1);
    sfx.play('fanfare');
    await Promise.all([say('Gaga! Ga-ga-ga! Hee hee hee!', 'boo'), sleep(2500)]);
    if (runId.current !== id) return;
    await say('Boo is ALIVE! Thank you, human. Probably.');
    if (runId.current === id) setPhase('done');
  };

  const again = () => {
    runId.current++;
    voice.cancel();
    sceneRef.current?.reset();
    setStep(0);
    setSub({ who: 'grand', text: GREETING });
    setPhase('intro');
  };

  const skip = () => { voice.cancel(); };

  const toggleMute = () => {
    sfx.unlock();
    sfx.setMuted(!sfx.isMuted());
    setMuted(sfx.isMuted());
  };

  const ctx: ChallengeCtx = { say, fail, mood, shake, pass: onPass };
  const Challenge = CHALLENGES[Math.min(step, TOTAL - 1)];

  return (
    <div className={'app' + (webgl ? ' has3d' : '')}>
      <canvas id="scene" ref={canvasRef} aria-hidden="true" style={{ display: webgl ? 'block' : 'none' }} />
      {!webgl && <FallbackStage ref={fbRef} progress={step / TOTAL} />}

      <header>
        <h1>Save Boo</h1>
        <div className="progress" aria-label="progress">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} className={i < step ? 'done' : i === step && phase === 'trial' ? 'now' : ''} />
          ))}
        </div>
        <button id="muteBtn" type="button" onClick={toggleMute} title="Toggle sound and voice"
          aria-label={muted ? 'Unmute sound and voice' : 'Mute sound and voice'} aria-pressed={muted}>
          {muted ? '🔇' : '🔊'}
        </button>
      </header>

      <div className="ui">
        <div id="speech" className={'subtitle ' + sub.who} aria-live="polite">
          <strong>{sub.who === 'boo' ? 'Boo' : 'Mortimer'}</strong>
          <span>{sub.text}</span>
          {(phase === 'greeting' || phase === 'finale') && <button className="skip" onClick={skip}>Skip</button>}
        </div>

        <section id="challenge" className="panel">
          {phase === 'intro' && (
            <div className="center">
              <p className="lead">Oh no! Little Boo has faded away. Only a verified <b>human</b> can bring her back to life.</p>
              <button id="begin" onClick={begin}>Begin the Trials</button>
              <p className="hint">Sound on for voice overs. Headphones recommended, ghosts whisper.</p>
            </div>
          )}
          {phase === 'greeting' && <div className="center"><p className="lead">Mortimer is speaking...</p></div>}
          {phase === 'trial' && <Challenge key={step} ctx={ctx} />}
          {phase === 'passed' && (
            <div className="center">
              <p className="big">✅</p>
              <button id="nextBtn" onClick={() => goto(step)}>{step >= TOTAL ? 'Wake up Boo!' : 'Next trial →'}</button>
            </div>
          )}
          {phase === 'finale' && <div className="center big">✨</div>}
          {phase === 'done' && (
            <div className="center">
              <p className="big">🎉👻🎉</p>
              <p>Boo has been revived thanks to your humanity.</p>
              <p className="hint">Mortimer's secret: there was no verification. He just wanted to see how far a human would go for a baby ghost. Which, frankly, is the most human thing of all.</p>
              <button id="again" onClick={again}>Play again</button>
            </div>
          )}
        </section>
      </div>
      {confetti > 0 && <Confetti key={confetti} />}
    </div>
  );
}
