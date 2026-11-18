export interface ChimeTone {
  frequency: number
  start: number
  duration: number
}

export type NotifyPermission = NotificationPermission | 'unsupported'

/** 一輪三聲結束後稍停再重複，直到關閉 */
export const POMODORO_ALARM_LOOP_MS = 2000

let sharedAudio: AudioContext | null = null
let playing = false
let loopTimer: ReturnType<typeof setInterval> | null = null
let activeNodes: OscillatorNode[] = []

export function chimeSchedule(startTime = 0): ChimeTone[] {
  return [0, 1, 2].map((index) => ({
    frequency: index === 2 ? 880 : 660,
    start: startTime + index * 0.28,
    duration: 0.22,
  }))
}

export function unlockPomodoroAudio(): void {
  const AudioCtx =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return
  try {
    if (!sharedAudio) sharedAudio = new AudioCtx()
    if (sharedAudio.state === 'suspended') void sharedAudio.resume()
  } catch {
    sharedAudio = null
  }
}

export function isPomodoroAlarmPlaying(): boolean {
  return playing
}

function ringOnce(ctx: AudioContext) {
  const tones = chimeSchedule(ctx.currentTime)
  const nodes: OscillatorNode[] = []
  try {
    for (const tone of tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = tone.frequency
      gain.gain.setValueAtTime(0.0001, tone.start)
      gain.gain.exponentialRampToValueAtTime(0.18, tone.start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, tone.start + tone.duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(tone.start)
      osc.stop(tone.start + tone.duration + 0.02)
      nodes.push(osc)
    }
  } finally {
    activeNodes = nodes
  }
}

export function stopPomodoroAlarm(): void {
  playing = false
  if (loopTimer) {
    clearInterval(loopTimer)
    loopTimer = null
  }
  for (const osc of activeNodes) {
    try {
      osc.stop()
    } catch {
      // 這聲已經結束
    }
  }
  activeNodes = []
}

/**
 * 開始循環鬧鐘。已經在響時不會再疊一層。
 * 沒傳音訊物件時會自己建立，這樣重新開啟頁面後補響也聽得到。
 */
export async function startPomodoroAlarm(ctx?: AudioContext | null): Promise<boolean> {
  if (playing) return true
  if (ctx === undefined) unlockPomodoroAudio()
  const audio = ctx === undefined ? sharedAudio : ctx
  if (!audio) return false
  try {
    if (audio.state === 'suspended') {
      await Promise.race([
        audio.resume(),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ])
    }
  } catch {
    return false
  }
  playing = true
  try {
    ringOnce(audio)
  } catch {
    stopPomodoroAlarm()
    return false
  }
  loopTimer = setInterval(() => {
    if (!playing) return
    try {
      ringOnce(audio)
    } catch {
      // 這一輪失敗就等下一次
    }
  }, POMODORO_ALARM_LOOP_MS)
  return true
}

export function readNotificationPermission(): NotifyPermission {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export function showTimeUpNotification(
  body: string,
  notificationApi: typeof Notification | undefined = globalThis.Notification,
): boolean {
  if (!notificationApi || notificationApi.permission !== 'granted') return false
  try {
    const notification = new notificationApi('⏰ 時間到了', {
      body,
      silent: false,
      tag: 'pomodoro-timeup',
      requireInteraction: true,
      renotify: true,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return true
  } catch {
    return false
  }
}
