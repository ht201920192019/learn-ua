import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Flame, Headphones, Heart, Keyboard, Layers, LoaderCircle, RotateCcw, Search, Shuffle, Sparkles, Sprout, Volume2, X } from 'lucide-react'
import { categories, levelOptions, matchesLevel, words } from './words'
import type { Category, LevelFilter } from './words'
import { usePronunciation } from './usePronunciation'

type Mode = 'all' | 'saved' | 'review'
type Progress = { known: string[]; review: string[]; saved: string[]; daily: { date: string; ids: string[] }; days: string[] }
const STORAGE_KEY = 'slovo-progress-v1'
const today = () => new Date().toLocaleDateString('sv-SE')
const newProgress = (): Progress => ({ known: [], review: [], saved: [], daily: { date: today(), ids: [] }, days: [] })
function loadProgress(): Progress {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!value || typeof value !== 'object') return newProgress()
    const validIds = (list: unknown): string[] => Array.isArray(list) ? [...new Set(list.filter((id): id is string => typeof id === 'string' && words.some(w => w.id === id)))] : []
    const known = validIds(value.known)
    return { known, review: validIds(value.review).filter(id => !known.includes(id)), saved: validIds(value.saved), daily: { date: today(), ids: value.daily?.date === today() ? validIds(value.daily.ids) : [] }, days: Array.isArray(value.days) ? value.days.filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [] }
  } catch { return newProgress() }
}

function App() {
  const [progress, setProgress] = useState(loadProgress)
  const [category, setCategory] = useState<'all' | Category>('all')
  const [level, setLevel] = useState<LevelFilter>('recommended')
  const [mode, setMode] = useState<Mode>('all')
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [order, setOrder] = useState(words.map(w => w.id))
  const [toast, setToast] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [celebrated, setCelebrated] = useState(false)
  const helpRef = useRef<HTMLDialogElement>(null)
  const helpTriggerRef = useRef<HTMLButtonElement>(null)
  const roundReviewed = useRef(new Set<string>())
  const levelWords = useMemo(() => words.filter(word => matchesLevel(word, level)), [level])
  const availableCategories = categories.filter(c => c.id === 'all' || levelWords.some(word => word.category === c.id))
  const filtered = useMemo(() => order.map(id => words.find(w => w.id === id)!).filter(word =>
    matchesLevel(word, level) &&
    (category === 'all' || word.category === category) &&
    (mode === 'all' || (mode === 'saved' ? progress.saved : progress.review).includes(word.id)) &&
    `${word.uk} ${word.zh} ${word.pronunciation} ${word.abbreviation ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ), [level, category, mode, query, order, progress.saved, progress.review])
  const currentIndex = filtered.length ? Math.min(index, filtered.length - 1) : 0
  const word = filtered[currentIndex]
  const { autoRead, toggleAutoRead, speak, speaking, loadingVoice, needsGesture } = usePronunciation(word?.id, word?.uk, !!word && !celebrated && !helpOpen, setToast)
  const learnedInGroup = filtered.filter(w => progress.known.includes(w.id)).length
  const groupPercent = filtered.length ? Math.round(learnedInGroup / filtered.length * 100) : 0
  const saved = !!word && progress.saved.includes(word.id)
  const dailyCount = progress.daily.date === today() ? progress.daily.ids.length : 0

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)) }
    catch { setToast('浏览器无法保存进度，当前页面内仍可继续学习。') }
  }, [progress])
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 3800); return () => clearTimeout(timer) } }, [toast])
  useEffect(() => {
    if (helpOpen) helpRef.current?.showModal()
    else if (helpRef.current?.open) helpRef.current.close()
  }, [helpOpen])
  useEffect(() => { roundReviewed.current.clear() }, [level, category, mode, query, order])

  const navigate = useCallback((direction: number) => {
    if (!filtered.length) return
    setFlipped(false)
    setIndex((currentIndex + direction + filtered.length) % filtered.length)
    setCelebrated(false)
  }, [filtered.length, currentIndex])

  function toggleSaved() {
    if (!word) return
    setProgress(p => ({ ...p, saved: p.saved.includes(word.id) ? p.saved.filter(id => id !== word.id) : [...p.saved, word.id] }))
    setToast(saved ? '已从收藏中移除' : '已加入收藏，随时回来复习')
    if (mode === 'saved') { setFlipped(false); setIndex(Math.min(currentIndex, Math.max(filtered.length - 2, 0))) }
  }

  const mark = useCallback((known: boolean) => {
    if (!word || !flipped || celebrated) return
    const id = word.id
    setProgress(p => {
      const ids = p.daily.date === today() ? p.daily.ids : []
      return {
        ...p,
        known: known ? [...new Set([...p.known, id])] : p.known.filter(v => v !== id),
        review: known ? p.review.filter(v => v !== id) : [...new Set([...p.review, id])],
        daily: { date: today(), ids: [...new Set([...ids, id])] },
        days: [...new Set([...p.days, today()])],
      }
    })
    setToast(known ? '记住了！又向前迈出一小步。' : '已加入待复习，多见几次就会记住。')
    setFlipped(false)
    roundReviewed.current.add(id)
    if (filtered.every(w => roundReviewed.current.has(w.id))) {
      setCelebrated(true)
      setIndex(0)
    } else if (!(mode === 'review' && known)) setIndex((currentIndex + 1) % filtered.length)
  }, [word, flipped, celebrated, currentIndex, filtered.length, mode])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, dialog, [contenteditable="true"]') || helpOpen || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.code === 'Space' && !target.closest('button, a')) { event.preventDefault(); if (word && !celebrated) setFlipped(v => !v) }
      if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1) }
      if (event.key === '1') mark(false)
      if (event.key === '2') mark(true)
      if (event.key.toLowerCase() === 'p') speak()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [helpOpen, word, celebrated, navigate, mark, speak])

  function selectMode(next: Mode) {
    setMode(next); setIndex(0); setFlipped(false); setCelebrated(false)
    if (next === 'saved' || next === 'review') { setLevel('all'); setCategory('all'); setQuery('') }
    else if (mode !== 'all') { setLevel('recommended'); setCategory('all'); setQuery('') }
  }
  function selectLevel(next: LevelFilter) {
    setLevel(next); setIndex(0); setFlipped(false); setCelebrated(false)
    if (!words.some(word => matchesLevel(word, next) && word.category === category)) setCategory('all')
  }
  function selectCategory(next: 'all' | Category) { setCategory(next); setIndex(0); setFlipped(false); setCelebrated(false) }
  function shuffle() {
    const next = [...order]
    for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]] }
    setOrder(next); setIndex(0); setFlipped(false); setCelebrated(false); setToast('已打乱顺序，给记忆一点新鲜感')
  }
  function resetFilters() { setMode('all'); setLevel('recommended'); setCategory('all'); setQuery(''); setIndex(0); setFlipped(false); setCelebrated(false) }

  return <>
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="./" aria-label="slovo 首页"><span className="brand-mark"><Layers size={23} strokeWidth={2.2} /></span><span>slovo<span className="brand-dot">.</span></span><span className="brand-divider" /><span className="brand-caption">乌克兰语词汇闪卡</span></a>
        <nav className="main-nav" aria-label="学习模式">
          <button className={mode !== 'saved' ? 'active' : ''} onClick={() => selectMode('all')}><BookOpen size={17} />学习闪卡</button>
          <button className={mode === 'saved' ? 'active' : ''} onClick={() => selectMode('saved')}><Bookmark size={17} />我的收藏{progress.saved.length > 0 && <span className="nav-count">{progress.saved.length}</span>}</button>
        </nav>
        <div className="header-right"><span className="flag" aria-label="乌克兰" /><span>中文 · Українська</span><button className="help-button icon-button" ref={helpTriggerRef} onClick={() => setHelpOpen(true)} aria-label="使用帮助"><CircleHelp size={19} /></button></div>
      </div>
    </header>

    <main>
      <section className="intro">
        <div><div className="eyebrow"><span />МАЛЕНЬКІ КРОКИ, ВЕЛИКІ ЗМІНИ</div><h1>每一张闪卡，都是<span>一点进步。</span></h1><p>A2–B1 日常交流，遇见储能与能源行业的专业表达。</p></div>
        <div className="intro-note"><Sunflower /><div><span>不急，慢慢来。</span><p>Ти все зможеш! <span>你一定可以。</span></p></div></div>
      </section>

      <section className="workspace" aria-label="词汇学习">
        <div className="workspace-top"><div className="section-title"><span className="tiny-card"><Layers size={17} /></span><h2>{mode === 'saved' ? '我的收藏' : mode === 'review' ? '待复习词汇' : '你的词汇卡片'}</h2><span className="word-count">{filtered.length} 个单词</span></div><label className="search-field"><Search size={17} /><input value={query} onChange={e => { setQuery(e.target.value); setIndex(0); setFlipped(false); setCelebrated(false) }} placeholder="搜索乌克兰语或中文" aria-label="搜索词汇" />{query && <button aria-label="清除搜索" onClick={() => { setQuery(''); setIndex(0); setFlipped(false); setCelebrated(false) }}><X size={15} /></button>}</label></div>
        <div className="level-filter-row"><label className="level-filter"><span>学习范围</span><span className="level-select"><select aria-label="学习难度" value={level} onChange={e => selectLevel(e.target.value as LevelFilter)}>{levelOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><ChevronDown size={14} /></span></label><span className="level-note">日常词按难度分组 · 行业词单独标注</span></div>
        <div className="categories" aria-label="词汇分类">{availableCategories.map(c => <button key={c.id} className={`${category === c.id ? 'selected' : ''} ${c.id === 'storage' || c.id === 'energy' ? 'industry-category' : ''}`} aria-pressed={category === c.id} onClick={() => selectCategory(c.id)}>{c.name}{category === c.id && <span>{c.id === 'all' ? levelWords.length : levelWords.filter(w => w.category === c.id).length}</span>}</button>)}</div>

        <div className="study-layout">
          <div className="study-main">
            <div className="auto-read-row"><button className="auto-read-control" role="switch" aria-checked={autoRead} aria-label="自动朗读" onClick={toggleAutoRead}><Volume2 size={15} /><span>自动朗读</span><span className={`switch-track ${autoRead ? 'on' : ''}`} aria-hidden="true"><span /></span></button>{needsGesture ? <button className="audio-start-button" onClick={speak} disabled={!word || celebrated || helpOpen}>点此开启声音<ArrowRight size={12} /></button> : <span className="auto-read-hint">{autoRead ? '切换词卡，自动读出乌克兰语' : '开启后，切卡自动发音'}</span>}</div>
            <div className="deck-meta"><span><span className="live-dot" />{mode === 'saved' ? '收藏词库' : mode === 'review' ? '巩固记忆' : '实用词汇'}<span className="meta-divider">/</span>{word ? (word.level === '行业' ? '行业术语' : `${word.level} ${word.level === 'A1' ? '基础复习' : word.level === 'A2' ? '日常应用' : '交流表达'}`) : levelOptions.find(option => option.id === level)?.name}</span><button className="text-button" onClick={shuffle} disabled={!word}><Shuffle size={14} />随机顺序</button></div>
            <div className="card-stack">
              <div className="stack-sheet stack-one" /><div className="stack-sheet stack-two" />
              {celebrated ? <div className="flashcard completion"><span className="completion-icon"><Sparkles size={33} /></span><span className="card-eyebrow">ЧУДОВА РОБОТА!</span><h2>这一组，学习完成！</h2><p>每一次遇见，都会让记忆更深一点。</p><button className="primary-button" onClick={() => { roundReviewed.current.clear(); setCelebrated(false); setIndex(0); setFlipped(false) }}><RotateCcw size={17} />再学一遍</button></div> : word ? <div className={`flashcard ${flipped ? 'flipped' : ''}`} key={word.id}>
                <div className="card-toolbar"><div className="card-tags"><span className="category-badge"><span />{categories.find(c => c.id === word.category)?.name}</span><span className={`level-badge ${word.level === '行业' ? 'industry-level' : ''}`}>{word.level}</span></div><div><span className="card-number">{String(currentIndex + 1).padStart(2, '0')}<span> / {String(filtered.length).padStart(2, '0')}</span></span><button className={`bookmark-button icon-button ${saved ? 'is-saved' : ''}`} onClick={toggleSaved} aria-label={saved ? '取消收藏' : '收藏单词'} aria-pressed={saved}><Bookmark size={20} fill={saved ? 'currentColor' : 'none'} /></button></div></div>
                <button className="card-content" onClick={() => setFlipped(v => !v)} aria-label={flipped ? '翻回乌克兰语' : '翻卡查看中文释义'}>
                  {flipped ? <div className="word-back"><span className="card-eyebrow" lang="uk">{word.uk}</span><h2>{word.zh}</h2><span className="part-of-speech">{word.part}{word.abbreviation && ` · ${word.abbreviation}`}</span><div className="example"><p lang="uk">{word.example}</p><span>{word.translation}</span></div>{word.note && <p className="term-note">{word.note}</p>}</div> : <div className="word-front"><span className="card-eyebrow">УКРАЇНСЬКА · 乌克兰语</span><h2 lang="uk" className={word.uk.length > 30 ? 'phrase-word' : word.uk.length > 18 ? 'medium-word' : word.uk.length > 10 ? 'long-word' : ''}>{word.uk}</h2><p className="pronunciation">[ {word.pronunciation} ]</p>{word.abbreviation && <span className="term-abbreviation">{word.abbreviation}</span>}</div>}
                </button>
                <button className={`audio-button ${speaking ? 'speaking' : ''}`} onClick={speak} aria-label="播放乌克兰语发音" aria-busy={loadingVoice}>{loadingVoice ? <LoaderCircle size={22} className="voice-spinner" /> : <Volume2 size={22} />}</button>
                <div className="card-bottom"><span className="word-status">{progress.known.includes(word.id) ? <><CheckCheck size={13} />已掌握</> : progress.review.includes(word.id) ? <><RotateCcw size={12} />待复习</> : '新单词'}</span><span><RotateCcw size={12} />{flipped ? '点击卡片返回正面' : '点击卡片查看释义'}</span><span className="card-side">{flipped ? '中' : 'УКР'}</span></div>
              </div> : <div className="flashcard empty-state"><span className="empty-icon">{mode === 'saved' ? <Bookmark size={31} /> : mode === 'review' ? <CheckCheck size={31} /> : <Search size={31} />}</span><h2>{query ? '还没找到这个单词' : mode === 'saved' ? '把喜欢的单词留在这里' : mode === 'review' ? '暂时没有待复习的单词' : '这个分类暂时没有单词'}</h2><p>{query ? '试试输入中文释义，或换一个关键词。' : mode === 'saved' ? '点击卡片右上角的收藏图标，下次就能轻松找到。' : '继续认识一些新单词吧，一点点积累。'}</p><button className="primary-button" onClick={resetFilters}>浏览全部词汇<ArrowRight size={16} /></button></div>}
            </div>
            <div className="card-navigation"><button className="nav-arrow icon-button" onClick={() => navigate(-1)} disabled={!word || celebrated} aria-label="上一张"><ChevronLeft size={21} /></button><span>{word && !celebrated ? <><strong>{String(currentIndex + 1).padStart(2, '0')}</strong><span className="slash">/</span>{String(filtered.length).padStart(2, '0')}</> : '—'}</span><button className="nav-arrow icon-button" onClick={() => navigate(1)} disabled={!word || celebrated} aria-label="下一张"><ChevronRight size={21} /></button></div>
            <div className="review-actions"><button className="again-button" disabled={!word || !flipped || celebrated} onClick={() => mark(false)}><RotateCcw size={18} /><span>还需练习</span><kbd>1</kbd></button><button className="known-button" disabled={!word || !flipped || celebrated} onClick={() => mark(true)}><Check size={19} /><span>我记住了</span><kbd>2</kbd></button></div>
            <p className="action-hint">{flipped ? '诚实地告诉自己：这个单词记住了吗？' : '先想一想，再翻面查看答案。'}</p>
          </div>

          <aside className="study-sidebar">
            <section className="progress-panel"><div className="panel-heading"><h3>一点点，积累成很多</h3><Sprout size={19} /></div><p className="panel-subtitle">每个记住的词，都算数。</p><div className="progress-circle" style={{ '--progress': `${groupPercent * 3.6}deg` } as React.CSSProperties}><div><span>{groupPercent}<small>%</small></span><p>当前词库掌握度</p></div></div><div className="progress-legend"><span><i />已掌握</span><strong>{learnedInGroup}<small> / {filtered.length}</small></strong></div><div className="progress-legend"><span><i className="yellow-dot" />待复习</span><button onClick={() => selectMode(mode === 'review' ? 'all' : 'review')} aria-label={mode === 'review' ? '返回全部词汇' : '查看待复习词汇'}>{progress.review.length}<ChevronRight size={14} /></button></div><div className="daily-goal"><div><span><Flame size={15} />今日小目标</span><strong>{Math.min(dailyCount, 10)}<small> / 10 词</small></strong></div><div className="goal-track"><span style={{ width: `${Math.min(dailyCount / 10 * 100, 100)}%` }} /></div><p>{dailyCount >= 10 ? '目标达成！今天的你又进步了一点。' : `再认识 ${10 - dailyCount} 个词，就是很棒的一天。`}</p></div></section>
            <section className="tip-panel"><span className="tip-label"><Sparkles size={15} />学习小贴士</span><h3>记忆，喜欢多见几次。</h3><p>不用一次记住所有单词。试着大声读出来，再把不熟悉的词放进「还需练习」。</p><span className="tip-ukrainian">Повторення — мати навчання.</span><span className="tip-translation">温故而知新。</span><div className="tip-spark tip-spark-one">✧</div><div className="tip-spark tip-spark-two">✧</div></section>
            <button className="shortcut-button" onClick={() => setHelpOpen(true)}><Keyboard size={16} />键盘快捷键<ArrowRight size={14} /></button>
          </aside>
        </div>
      </section>

      <footer><span><Heart size={13} />用一点热爱，学一门语言。</span><span className="footer-center">З любов’ю до української <span>·</span> 与乌克兰语慢慢相识</span><span className="local-save"><span />进度保存在本机</span></footer>
    </main>

    <dialog ref={helpRef} className="help-dialog" onCancel={() => setHelpOpen(false)} onClose={() => { setHelpOpen(false); helpTriggerRef.current?.focus() }} onClick={e => { if (e.target === e.currentTarget) setHelpOpen(false) }}><div className="dialog-heading"><span className="dialog-icon"><Layers size={23} /></span><button className="icon-button" onClick={() => setHelpOpen(false)} aria-label="关闭帮助"><X size={20} /></button></div><h2>用自己的节奏，认识新单词。</h2><p>先看乌克兰语、回想意思，再翻面查看中文和例句。根据熟悉程度，标记「还需练习」或「我记住了」。默认学习 A2–B1 和行业词汇；可切换学习范围，原有 A1 收藏与进度仍保留。A2–B1 是学习分组参考，行业词不强行归入 CEFR 等级。</p><p>开启「自动朗读」后，切换词卡会自动播放乌克兰语。刷新后请点「点此开启声音」或喇叭恢复；翻面不会重复朗读。</p><div className="shortcut-list"><span><kbd>Space</kbd>翻转闪卡</span><span><kbd><ArrowLeft size={13} /></kbd><kbd><ArrowRight size={13} /></kbd>切换单词</span><span><kbd>1</kbd>还需练习</span><span><kbd>2</kbd>我记住了</span><span><kbd>P</kbd>播放发音</span></div><div className="help-note"><Headphones size={19} /><p>发音需要设备安装乌克兰语语音包；拉丁字母转写仅作辅助，重音用尖音符标注。学习记录保存在当前浏览器，清除网站数据会同时删除记录。</p></div><button className="primary-button" onClick={() => setHelpOpen(false)}>开始学习<ArrowRight size={16} /></button></dialog>
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="关闭提示"><X size={14} /></button></div>}
  </>
}

function Sunflower() {
  return <svg className="sunflower" viewBox="0 0 82 94" fill="none" aria-hidden="true"><path d="M42 50c-1 12 1 24-2 36" stroke="#6b866d" strokeWidth="2.5" strokeLinecap="round"/><path d="M41 77c-14-2-18-10-19-15 11 0 18 5 19 15Z" fill="#9fb194"/><path d="M42 67c11-1 18-7 20-13-12-1-19 4-20 13Z" fill="#7e9c7e"/>{Array.from({length:12},(_,i)=><ellipse key={i} cx="42" cy="19" rx="5.5" ry="12" fill={i%2 ? '#efbf45' : '#f7ce62'} transform={`rotate(${i*30} 42 34)`}/>)}<circle cx="42" cy="34" r="12" fill="#785e3d"/><circle cx="42" cy="34" r="8" fill="#8b6f47"/>{[[38,30],[44,29],[47,34],[41,35],[36,35],[40,40],[46,39]].map(([cx,cy])=><circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1" fill="#c9a363"/>)}</svg>
}

export default App
