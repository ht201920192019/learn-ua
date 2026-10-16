import { useCallback, useEffect, useRef, useState } from 'react'

const AUTO_READ_KEY = 'slovo-auto-read-v1'
const VOICE_WAIT_MS = 1800

function loadAutoRead() {
  try { return localStorage.getItem(AUTO_READ_KEY) === 'true' }
  catch { return false }
}

export function usePronunciation(
  wordId: string | undefined,
  text: string | undefined,
  active: boolean,
  notify: (message: string) => void,
) {
  const [autoRead, setAutoRead] = useState(loadAutoRead)
  const [hasGesture, setHasGesture] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [loadingVoice, setLoadingVoice] = useState(false)
  const requestId = useRef(0)
  const pendingCleanup = useRef<(() => void) | null>(null)
  const currentWord = useRef(wordId)
  const lastAutoWord = useRef<string | undefined>(undefined)
  // Keep an active utterance reference for mobile speech engines.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const cancel = useCallback(() => {
    requestId.current += 1
    pendingCleanup.current?.()
    pendingCleanup.current = null
    utteranceRef.current = null
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
    setLoadingVoice(false)
  }, [])

  const play = useCallback((value: string) => {
    cancel()
    const id = requestId.current
    const fail = (message: string) => {
      if (id !== requestId.current) return
      pendingCleanup.current?.()
      pendingCleanup.current = null
      utteranceRef.current = null
      setSpeaking(false)
      setLoadingVoice(false)
      // Pause automatic playback until another explicit tap; don't repeat errors on every card.
      setHasGesture(false)
      notify(message)
    }
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      fail('此浏览器不支持语音朗读，请尝试其他浏览器。')
      return
    }
    const synth = window.speechSynthesis
    const start = () => {
      if (id !== requestId.current) return true
      const voice = synth.getVoices().find(item => /^uk([_-]|$)/i.test(item.lang))
      if (!voice) return false
      pendingCleanup.current?.()
      pendingCleanup.current = null
      setLoadingVoice(false)
      const utterance = new SpeechSynthesisUtterance(value)
      utteranceRef.current = utterance
      utterance.lang = 'uk-UA'
      utterance.voice = voice
      utterance.rate = 0.8
      utterance.onstart = () => { if (id === requestId.current) setSpeaking(true) }
      utterance.onend = () => {
        if (id !== requestId.current) return
        utteranceRef.current = null
        setSpeaking(false)
      }
      utterance.onerror = event => {
        if (id !== requestId.current) return
        if (event.error === 'canceled' || event.error === 'interrupted') {
          utteranceRef.current = null
          setSpeaking(false)
          return
        }
        fail(event.error === 'not-allowed'
          ? '浏览器需要你点击开启声音，请点一下喇叭继续自动朗读。'
          : '暂时无法播放发音，请点一下喇叭重试。')
      }
      try {
        if (synth.paused) synth.resume()
        synth.speak(utterance)
      } catch { fail('暂时无法播放发音，请点一下喇叭重试。') }
      return true
    }
    if (start()) return
    // Mobile browsers may populate their voice list after the first getVoices() call.
    setLoadingVoice(true)
    const onVoicesChanged = () => { start() }
    synth.addEventListener('voiceschanged', onVoicesChanged)
    const timeout = window.setTimeout(() => {
      if (!start()) fail('当前设备没有乌克兰语语音包。请在系统语音设置中添加后，点击喇叭重试。')
    }, VOICE_WAIT_MS)
    pendingCleanup.current = () => {
      synth.removeEventListener('voiceschanged', onVoicesChanged)
      window.clearTimeout(timeout)
    }
  }, [cancel, notify])

  const speak = useCallback(() => {
    if (!text || !wordId || !active) return
    setHasGesture(true)
    lastAutoWord.current = wordId
    play(text)
  }, [active, play, text, wordId])

  const toggleAutoRead = useCallback(() => {
    const next = !autoRead
    setAutoRead(next)
    try { localStorage.setItem(AUTO_READ_KEY, String(next)) }
    catch { notify('本次设置已生效，但当前浏览器无法保存自动朗读偏好。') }
    if (next) speak()
    else { lastAutoWord.current = undefined; cancel() }
  }, [autoRead, cancel, notify, speak])

  useEffect(() => {
    if (currentWord.current !== wordId) {
      cancel()
      currentWord.current = wordId
      lastAutoWord.current = undefined
    }
    if (!active) { cancel(); lastAutoWord.current = undefined; return }
    if (autoRead && hasGesture && wordId && text && lastAutoWord.current !== wordId) {
      lastAutoWord.current = wordId
      play(text)
    }
  }, [active, autoRead, cancel, hasGesture, play, text, wordId])

  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices()
    const onVisibilityChange = () => { if (document.hidden) cancel() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => { document.removeEventListener('visibilitychange', onVisibilityChange); cancel() }
  }, [cancel])

  return { autoRead, toggleAutoRead, speak, speaking, loadingVoice, needsGesture: autoRead && !hasGesture }
}
