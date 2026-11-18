import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clampMinutes,
  formatCountdown,
  hydratePomodoro,
  minutesToMs,
  pointerAngleToMinutes,
  remainingSweepDeg,
  sessionProgress,
  timeUpBody,
} from '@/utils/pomodoro'
import {
  POMODORO_ALARM_LOOP_MS,
  chimeSchedule,
  isPomodoroAlarmPlaying,
  readNotificationPermission,
  requestNotificationPermission,
  showTimeUpNotification,
  startPomodoroAlarm,
  stopPomodoroAlarm,
} from '@/utils/pomodoroAlarm'

function vectorFromTop(degrees: number) {
  const atan = ((degrees - 90) * Math.PI) / 180
  return { dx: Math.cos(atan), dy: Math.sin(atan) }
}

describe('番茄鐘時間計算', () => {
  it('分鐘會限制在 1 到 60', () => {
    expect(clampMinutes(Number.NaN)).toBe(25)
    expect(clampMinutes(0)).toBe(1)
    expect(clampMinutes(24.4)).toBe(24)
    expect(clampMinutes(80)).toBe(60)
    expect(minutesToMs(25)).toBe(1_500_000)
  })

  it('倒數格式不滿一分鐘仍顯示秒數', () => {
    expect(formatCountdown(1_500_000)).toBe('25:00')
    expect(formatCountdown(61_000)).toBe('01:01')
    expect(formatCountdown(1_000)).toBe('00:01')
    expect(formatCountdown(1)).toBe('00:01')
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(-20)).toBe('00:00')
  })

  it('綠色扇形以 60 分鐘鐘面換算角度', () => {
    expect(remainingSweepDeg(25 * 60_000)).toBe(150)
    expect(remainingSweepDeg(60 * 60_000)).toBe(360)
    expect(remainingSweepDeg(90 * 60_000)).toBe(360)
    expect(remainingSweepDeg(0)).toBe(0)
    expect(remainingSweepDeg(-1)).toBe(0)
    expect(remainingSweepDeg(Number.NaN)).toBe(0)
  })

  it('縮小圖示的進度是這一輪的剩餘比例', () => {
    expect(sessionProgress(750_000, 1_500_000)).toBe(0.5)
    expect(sessionProgress(2_000_000, 1_500_000)).toBe(1)
    expect(sessionProgress(0, 1_500_000)).toBe(0)
    expect(sessionProgress(1_000, 0)).toBe(0)
    expect(sessionProgress(Number.NaN, 1_500_000)).toBe(0)
  })

  it('通知內文用這一輪的分鐘數', () => {
    expect(timeUpBody(25 * 60_000)).toBe('25 分鐘到了')
    expect(timeUpBody(5 * 60_000)).toBe('5 分鐘到了')
    expect(timeUpBody(60 * 60_000)).toBe('60 分鐘到了')
  })

  it('拖曳方向對應鐘面上的分鐘', () => {
    expect(pointerAngleToMinutes(0, -1)).toBe(60)
    expect(pointerAngleToMinutes(1, 0)).toBe(15)
    expect(pointerAngleToMinutes(0, 1)).toBe(30)
    expect(pointerAngleToMinutes(-1, 0)).toBe(45)
    const twentyFive = vectorFromTop(150)
    expect(pointerAngleToMinutes(twentyFive.dx, twentyFive.dy)).toBe(25)
    const almostHour = vectorFromTop(2)
    expect(pointerAngleToMinutes(almostHour.dx, almostHour.dy)).toBe(60)
    const oneMinute = vectorFromTop(6)
    expect(pointerAngleToMinutes(oneMinute.dx, oneMinute.dy)).toBe(1)
  })

  it('靠近圓心或不是數字時不設定時間', () => {
    expect(pointerAngleToMinutes(0, 0)).toBeNull()
    expect(pointerAngleToMinutes(Number.NaN, 1)).toBeNull()
  })
})

describe('番茄鐘狀態還原', () => {
  it('壞掉的存檔回到預設 25 分鐘', () => {
    expect(hydratePomodoro(null).snapshot).toMatchObject({
      durationMs: 1_500_000,
      remainingMs: 1_500_000,
      endsAt: null,
      phase: 'idle',
    })
    expect(hydratePomodoro(null).justFinished).toBe(false)
    expect(hydratePomodoro('nope').snapshot.phase).toBe('idle')
  })

  it('時長會限制在 1 到 60 分鐘，剩餘不會超過時長', () => {
    const tooLong = hydratePomodoro({
      durationMs: 2 * 60 * 60_000,
      remainingMs: 9_999_999,
      endsAt: null,
      phase: 'paused',
    })
    expect(tooLong.snapshot.durationMs).toBe(60 * 60_000)
    expect(tooLong.snapshot.remainingMs).toBe(60 * 60_000)

    const tooShort = hydratePomodoro({
      durationMs: 0,
      remainingMs: 0,
      endsAt: null,
      phase: 'idle',
    })
    expect(tooShort.snapshot.durationMs).toBe(60_000)
    expect(tooShort.snapshot.phase).toBe('done')
  })

  it('計時中但沒有結束時間時改為暫停', () => {
    const result = hydratePomodoro({
      durationMs: 1_500_000,
      remainingMs: 1_000_000,
      endsAt: null,
      phase: 'running',
    })
    expect(result.snapshot.phase).toBe('paused')
    expect(result.justFinished).toBe(false)
  })

  it('還在跑的計時會用結束時間重算剩餘', () => {
    const now = 1_700_000_000_000
    const result = hydratePomodoro(
      {
        durationMs: 1_500_000,
        remainingMs: 1,
        endsAt: now + 600_000,
        phase: 'running',
      },
      now,
    )
    expect(result.justFinished).toBe(false)
    expect(result.snapshot.phase).toBe('running')
    expect(result.snapshot.remainingMs).toBe(600_000)
    expect(result.snapshot.endsAt).toBe(now + 600_000)
  })

  it('剛逾時會補響，離開太久只標成時間到', () => {
    const now = 1_700_000_000_000
    const recent = hydratePomodoro(
      {
        durationMs: 300_000,
        remainingMs: 300_000,
        endsAt: now - 60_000,
        phase: 'running',
      },
      now,
    )
    expect(recent.justFinished).toBe(true)
    expect(recent.snapshot).toMatchObject({ phase: 'done', remainingMs: 0, endsAt: null })

    const stale = hydratePomodoro(
      {
        durationMs: 300_000,
        remainingMs: 300_000,
        endsAt: now - 11 * 60_000,
        phase: 'running',
      },
      now,
    )
    expect(stale.justFinished).toBe(false)
    expect(stale.snapshot.phase).toBe('done')
  })

  it('已暫停或已結束的存檔不會被改成補響', () => {
    const paused = hydratePomodoro({
      durationMs: 1_500_000,
      remainingMs: 400_000,
      endsAt: 1,
      phase: 'paused',
    })
    expect(paused.justFinished).toBe(false)
    expect(paused.snapshot.phase).toBe('paused')
    expect(paused.snapshot.remainingMs).toBe(400_000)
  })
})

function createAudioFake(state: AudioContextState = 'running') {
  const osc = {
    type: 'sine',
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }
  return {
    state,
    currentTime: 2,
    destination: {},
    resume: vi.fn(async () => undefined),
    createOscillator: vi.fn(() => osc),
    createGain: vi.fn(() => gain),
    osc,
  }
}

describe('番茄鐘響鈴與通知', () => {
  afterEach(() => {
    stopPomodoroAlarm()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('提示音是三聲，最後一聲較高', () => {
    expect(chimeSchedule(1)).toEqual([
      { frequency: 660, start: 1, duration: 0.22 },
      { frequency: 660, start: 1.28, duration: 0.22 },
      { frequency: 880, start: 1.56, duration: 0.22 },
    ])
  })

  it('沒有音訊環境時不響', async () => {
    await expect(startPomodoroAlarm(null)).resolves.toBe(false)
    expect(isPomodoroAlarmPlaying()).toBe(false)
  })

  it('會排入三聲提示音，音訊被暫停時先恢復', async () => {
    const ctx = createAudioFake('suspended')
    await expect(startPomodoroAlarm(ctx as unknown as AudioContext)).resolves.toBe(true)
    expect(ctx.resume).toHaveBeenCalledOnce()
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3)
    expect(ctx.osc.start).toHaveBeenCalledTimes(3)
    expect(isPomodoroAlarmPlaying()).toBe(true)
  })

  it('沒有關閉前會重複響，關閉後就停', async () => {
    vi.useFakeTimers()
    const ctx = createAudioFake()
    await startPomodoroAlarm(ctx as unknown as AudioContext)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(POMODORO_ALARM_LOOP_MS)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(6)
    stopPomodoroAlarm()
    expect(ctx.osc.stop).toHaveBeenCalled()
    expect(isPomodoroAlarmPlaying()).toBe(false)
    await vi.advanceTimersByTimeAsync(POMODORO_ALARM_LOOP_MS * 2)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(6)
  })

  it('音訊一直恢復不了時仍開始響，並顯示可關閉', async () => {
    vi.useFakeTimers()
    const ctx = createAudioFake('suspended')
    ctx.resume = vi.fn(() => new Promise(() => undefined))
    const pending = startPomodoroAlarm(ctx as unknown as AudioContext)
    await vi.advanceTimersByTimeAsync(400)
    await expect(pending).resolves.toBe(true)
    expect(ctx.createOscillator).toHaveBeenCalled()
    expect(isPomodoroAlarmPlaying()).toBe(true)
  })

  it('已經在響時不會再疊一層', async () => {
    const ctx = createAudioFake()
    await startPomodoroAlarm(ctx as unknown as AudioContext)
    await expect(startPomodoroAlarm(ctx as unknown as AudioContext)).resolves.toBe(true)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3)
  })

  it('音訊建立失敗時安靜結束', async () => {
    const ctx = createAudioFake()
    ctx.createOscillator.mockImplementation(() => {
      throw new Error('no device')
    })
    await expect(startPomodoroAlarm(ctx as unknown as AudioContext)).resolves.toBe(false)
    expect(isPomodoroAlarmPlaying()).toBe(false)
  })

  it('還沒開始就關閉也不會出錯', () => {
    expect(() => stopPomodoroAlarm()).not.toThrow()
    expect(isPomodoroAlarmPlaying()).toBe(false)
  })

  it('未授權或不支援時不發 Windows 通知', () => {
    class DeniedNotification {
      static permission = 'denied' as NotificationPermission
      constructor() {
        throw new Error('不該建立通知')
      }
    }
    expect(
      showTimeUpNotification('5 分鐘到了', DeniedNotification as unknown as typeof Notification),
    ).toBe(false)
    expect(showTimeUpNotification('5 分鐘到了', undefined)).toBe(false)
  })

  it('已授權時送出番茄鐘通知', () => {
    const created: { title: string; options?: NotificationOptions }[] = []
    class GrantedNotification {
      static permission = 'granted' as NotificationPermission
      onclick: (() => void) | null = null
      close = vi.fn()
      constructor(
        public title: string,
        public options?: NotificationOptions,
      ) {
        created.push({ title, options })
      }
    }
    expect(
      showTimeUpNotification('25 分鐘到了', GrantedNotification as unknown as typeof Notification),
    ).toBe(true)
    expect(created).toEqual([
      {
        title: '⏰ 時間到了',
        options: {
          body: '25 分鐘到了',
          silent: false,
          tag: 'pomodoro-timeup',
          requireInteraction: true,
          renotify: true,
        },
      },
    ])
  })

  it('通知建立失敗時回傳失敗', () => {
    class BrokenNotification {
      static permission = 'granted' as NotificationPermission
      constructor() {
        throw new Error('blocked')
      }
    }
    expect(
      showTimeUpNotification('到了', BrokenNotification as unknown as typeof Notification),
    ).toBe(false)
  })

  it('沒有 Notification 時視為不支援', async () => {
    vi.stubGlobal('Notification', undefined)
    expect(readNotificationPermission()).toBe('unsupported')
    await expect(requestNotificationPermission()).resolves.toBe('unsupported')
  })

  it('已經允許時不再詢問', async () => {
    const requestPermission = vi.fn()
    vi.stubGlobal('Notification', {
      permission: 'granted',
      requestPermission,
    })
    expect(readNotificationPermission()).toBe('granted')
    await expect(requestNotificationPermission()).resolves.toBe('granted')
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('詢問被拒絕或丟出錯誤時視為封鎖', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn(async () => 'denied'),
    })
    await expect(requestNotificationPermission()).resolves.toBe('denied')

    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: () => {
        throw new Error('dismissed')
      },
    })
    await expect(requestNotificationPermission()).resolves.toBe('denied')
  })
})
