import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownRight, ArrowLeft, ArrowRight, Clock3, Command, RotateCcw, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import './styles.css';

const WORDS = {
  Easy: 'the quiet morning light settles across the room while a soft breeze moves through the open window and carries the fresh scent of rain the little moments we often miss can make an ordinary day feel warm and new take your time breathe and let each word find its place on the page'.split(' '),
  Medium: 'curious minds wander beyond familiar paths and discover small details hidden in plain sight a steady rhythm turns uncertain thoughts into clear sentences while patience makes every practice session feel a little more natural people learn faster when they notice progress instead of chasing perfection'.split(' '),
  Hard: 'serendipity illuminated the labyrinthine architecture; juxtaposition creates unexpected nuance while meticulous observation transforms ordinary fragments into a coherent tapestry the ephemeral atmosphere evokes ineffable curiosity and resilience without sacrificing intellectual precision'.split(' '),
};

function makePassage(level) {
  const source = WORDS[level];
  const words = [...source].sort(() => Math.random() - 0.5);
  while (words.length < 90) words.push(...[...source].sort(() => Math.random() - 0.5));
  return words.slice(0, 90).join(' ');
}

const readRuns = () => {
  try { return JSON.parse(localStorage.getItem('prototype-runs') || '[]'); } catch { return []; }
};

function App() {
  const [level, setLevel] = useState('Easy');
  const [duration, setDuration] = useState(30);
  const [passage, setPassage] = useState(() => makePassage('Easy'));
  const [typed, setTyped] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [correctKeys, setCorrectKeys] = useState(0);
  const [shake, setShake] = useState(0);
  const [runs, setRuns] = useState(readRuns);
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null);
  const caretRef = useRef(null);
  const tabArmed = useRef(false);
  const sprinkleId = useRef(0);
  const [sprinkles, setSprinkles] = useState([]);

  const correctCount = useMemo(() => [...typed].reduce((sum, ch, i) => sum + (ch === passage[i] ? 1 : 0), 0), [typed, passage]);
  const accuracy = correctKeys + wrongCount ? Math.round(correctKeys / (correctKeys + wrongCount) * 100) : 100;
  const elapsed = duration - secondsLeft;
  const wpm = elapsed > 0 ? Math.round(correctCount / 5 / (elapsed / 60)) : 0;

  const restart = useCallback((nextLevel = level, nextDuration = duration) => {
    setLevel(nextLevel);
    setDuration(nextDuration);
    setPassage(makePassage(nextLevel));
    setTyped(''); setWrongCount(0); setCorrectKeys(0); setSecondsLeft(nextDuration);
    setRunning(false); setFinished(false); setSprinkles([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [duration, level]);

  const finish = useCallback((finalTyped = typed, finalCorrectKeys = correctKeys, finalWrongCount = wrongCount) => {
    setRunning(false); setFinished(true);
    const spent = Math.max(1, duration - secondsLeft);
    const finalCorrectCount = [...finalTyped].reduce((sum, ch, i) => sum + (ch === passage[i] ? 1 : 0), 0);
    const result = {
      id: Date.now(), wpm: Math.round(finalCorrectCount / 5 / (spent / 60)),
      accuracy: finalCorrectKeys + finalWrongCount ? Math.round(finalCorrectKeys / (finalCorrectKeys + finalWrongCount) * 100) : 100,
      correct: finalCorrectCount, errors: finalWrongCount, duration, level, createdAt: new Date().toISOString(),
    };
    setRuns(prev => {
      const next = [result, ...prev].slice(0, 30);
      try { localStorage.setItem('prototype-runs', JSON.stringify(next)); } catch { setNotice('Could not save to this browser.'); }
      return next;
    });
    fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) }).catch(() => {});
  }, [correctKeys, duration, level, passage, secondsLeft, typed, wrongCount]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setSecondsLeft(s => {
      if (s <= 1) { window.clearInterval(timer); return 0; }
      return s - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => { if (running && secondsLeft === 0) finish(); }, [running, secondsLeft, finish]);

  useEffect(() => {
    const caret = caretRef.current;
    const scrollArea = caret?.parentElement;
    if (!caret || !scrollArea) return;
    const caretBox = caret.getBoundingClientRect();
    const areaBox = scrollArea.getBoundingClientRect();
    if (caretBox.bottom > areaBox.bottom) scrollArea.scrollTop += caretBox.bottom - areaBox.bottom + 8;
    else if (caretBox.top < areaBox.top) scrollArea.scrollTop -= areaBox.top - caretBox.top + 8;
  }, [typed]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Tab') { tabArmed.current = true; window.setTimeout(() => { tabArmed.current = false; }, 1000); }
      if (e.key === 'Enter' && tabArmed.current) { e.preventDefault(); tabArmed.current = false; restart(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restart]);

  const handleInput = e => {
    const next = e.target.value;
    if (finished) { e.target.value = typed; return; }
    const previous = typed;
    if (next.length > previous.length) {
      if (!running) setRunning(true);
      const added = next.length - previous.length;
      let newlyCorrect = 0;
      let newlyWrong = 0;
      for (let offset = 0; offset < added; offset++) {
        const index = previous.length + offset;
        if (next[index] === passage[index]) {
          newlyCorrect++;
          const id = ++sprinkleId.current;
          setSprinkles(prev => [...prev, { id, index }]);
          window.setTimeout(() => setSprinkles(prev => prev.filter(item => item.id !== id)), 700);
        } else newlyWrong++;
      }
      if (newlyCorrect) setCorrectKeys(n => n + newlyCorrect);
      if (newlyWrong) { setWrongCount(n => n + newlyWrong); setShake(n => n + 1); }
    }
    setTyped(next);
    if (next.length >= passage.length) finish(next, correctKeys + (next.length > previous.length ? [...next.slice(previous.length)].filter((char, offset) => char === passage[previous.length + offset]).length : 0), wrongCount + (next.length > previous.length ? [...next.slice(previous.length)].filter((char, offset) => char !== passage[previous.length + offset]).length : 0));
  };

  const handleLevel = value => restart(value, duration);
  const handleDuration = value => restart(level, value);
  const recent = runs[0];

  return <main className="app-shell">
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="ProTotype home"><span className="brand-mark"><span/><span/><span/></span><span>Pro<span className="brand-light">T</span>otype</span><span className="brand-dot">.</span></a>
      <div className="header-center"><span className="live-dot"/> YOUR DAILY PRACTICE</div>
      <div className="header-right"><span className="saved-label"><span className="save-dot"/> Saved on this device</span><div className="avatar">P</div></div>
    </header>

    <section className="intro" id="top">
      <div className="eyebrow"><span className="eyebrow-line"/> THE ART OF GETTING IN FLOW <span className="eyebrow-line"/></div>
      <h1>........Pro <span>To Type......</span></h1>
      <p className="intro-copy">Find your rhythm, one keystroke at a time.</p>
    </section>

    <section className="test-card" aria-label="Typing test">
      <div className="card-top">
        <div className="test-mode"><span className="mode-glyph"><Activity size={15}/></span><div><strong>Typing test</strong><span>WORDS · PUNCTUATION</span></div></div>
        <div className="control-groups">
          <div className="segmented" aria-label="Test duration"><button className={duration === 30 ? 'selected' : ''} onClick={() => handleDuration(30)}>30<span>s</span></button><button className={duration === 60 ? 'selected' : ''} onClick={() => handleDuration(60)}>60<span>s</span></button></div>
          <span className="control-divider"/>
          <div className="segmented levels" aria-label="Difficulty level">{['Easy', 'Medium', 'Hard'].map(item => <button key={item} className={level === item ? 'selected' : ''} onClick={() => handleLevel(item)}>{item}</button>)}</div>
          <button className="restart-button" onClick={() => restart()} title="Restart test"><RotateCcw size={15}/><span>Restart</span></button>
        </div>
      </div>

      <div className="test-content">
        <div className="test-meta"><span className="level-tag"><span className="level-icon">✳</span> {level} mode</span><span className="meta-hint">{running ? 'You’re in the flow' : finished ? 'Session complete' : 'Start typing to begin'}</span></div>
        <div className="timer-row"><div className="timer"><Clock3 size={16}/><span className={secondsLeft <= 10 && running ? 'urgent' : ''}>{String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}</span></div><div className="timer-track"><span style={{ width: `${(secondsLeft / duration) * 100}%` }}/></div><span className="duration-label">{duration} SEC</span></div>

        {!finished ? <div className={`typing-area ${shake ? 'shake-on-error' : ''}`} onClick={() => inputRef.current?.focus()}>
          <div className="line-heading"><span>PASSAGE</span><span>FOLLOW THE BLUE CARET</span></div>
          <div className="typing-text" key={shake}>
            {passage.split('').map((char, i) => {
              const isTyped = i < typed.length;
              const good = isTyped && typed[i] === char;
              const bad = isTyped && typed[i] !== char;
              return <React.Fragment key={`${i}-${char}`}>
                {i === typed.length && <span ref={caretRef} className="caret"/>}
                <span className={`char ${good ? 'correct' : ''} ${bad ? 'incorrect' : ''}`}>
                  {char === ' ' ? '\u00a0' : char}
                  {sprinkles.filter(item => item.index === i).map(item => <i key={item.id} className="sprinkle" style={{ '--sprinkle': `${item.id % 4}` }}>✦</i>)}
                </span>
              </React.Fragment>;
            })}
            {typed.length >= passage.length && <span ref={caretRef} className="caret"/>}
          </div>
          <textarea ref={inputRef} className="typing-input" value={typed} onChange={handleInput} onKeyDown={e => { if (e.key === 'Tab') e.preventDefault(); }} autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck="false" aria-label="Type the displayed passage here" />
          {!running && <div className="start-overlay"><span className="keycap">Click here</span><span>and start typing</span><span className="overlay-dash">·</span><span className="keycap">Tab</span><span className="keycap">↵</span><span>to restart</span></div>}
        </div> : <div className="result-panel"><div className="result-icon"><Trophy size={23}/></div><div className="result-heading"><span>TIME WELL SPENT</span><h2>That’s your rhythm.</h2><p>A fresh page is always one restart away.</p></div><div className="result-stats"><div><strong>{wpm}</strong><span>WPM</span></div><i/><div><strong>{accuracy}<small>%</small></strong><span>ACCURACY</span></div><i/><div><strong>{wrongCount}</strong><span>MISSED KEYS</span></div></div><button className="result-restart" onClick={() => restart()}><RotateCcw size={15}/> Try another round</button></div>}

        <div className="test-footer"><span><Sparkles size={14}/> {running ? `${correctCount} characters in the clear` : finished ? 'Your progress is saved automatically' : 'Every keystroke counts. You’ve got this.'}</span><span className="footer-live"><i/> {running ? `${wpm} WPM` : 'READY WHEN YOU ARE'}</span></div>
      </div>
    </section>

    <section className="stats-row" aria-label="Your typing stats">
      <div className="stat-card"><span className="stat-icon"><Zap size={16}/></span><div className="stat-copy"><span>YOUR SPEED</span><strong>{running ? wpm : recent ? recent.wpm : '—'} <small>WPM</small></strong></div><div className="stat-aside"><span className="sparkline">⌁</span><span>{recent ? 'last session' : 'first session'}</span></div></div>
      <div className="stat-card"><span className="stat-icon"><Target size={16}/></span><div className="stat-copy"><span>ACCURACY</span><strong>{running ? accuracy : recent ? recent.accuracy : '—'} <small>%</small></strong></div><div className="stat-aside"><span className="accuracy-ring">{recent ? '◉' : '○'}</span><span>{recent ? 'last session' : 'ready to track'}</span></div></div>
      <div className="stat-card sessions-card"><span className="stat-icon"><Trophy size={16}/></span><div className="stat-copy"><span>SESSIONS</span><strong>{runs.length.toString().padStart(2, '0')} <small>total</small></strong></div><div className="stat-aside"><span className="session-dots">● ● ●</span><span>all yours</span></div></div>
    </section>

    <div className="bottom-note"><span className="bottom-rule"/><span>{notice || 'No pressure. Just progress.'}</span><span className="bottom-rule"/><span className="keyboard-note"><Command size={11}/> + <ArrowLeft size={11}/> <ArrowRight size={11}/> switch mode</span></div>
    <div className="corner-note">DESIGNED FOR YOUR FLOW <ArrowDownRight size={12}/></div>
  </main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
