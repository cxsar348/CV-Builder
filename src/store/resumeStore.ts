import { create } from 'zustand'
import { createEmptyResume, type ResumeData } from '../data/model'

type ResumeStore = {
  resume: ResumeData
  past: ResumeData[]
  future: ResumeData[]
  lastEditAt: number
  hydrated: boolean
  update: (updater: (resume: ResumeData) => ResumeData) => void
  replace: (resume: ResumeData) => void
  hydrate: (resume: ResumeData) => void
  undo: () => void
  redo: () => void
  setHydrated: () => void
}

export const useResumeStore = create<ResumeStore>((set) => ({
  resume: createEmptyResume(),
  past: [],
  future: [],
  lastEditAt: 0,
  hydrated: false,
  update: (updater) => set((state) => {
    const now = Date.now()
    const shouldSnapshot = now - state.lastEditAt > 700
    return {
      resume: updater(state.resume),
      past: shouldSnapshot ? [...state.past.slice(-29), structuredClone(state.resume)] : state.past,
      future: shouldSnapshot ? [] : state.future,
      lastEditAt: now,
    }
  }),
  replace: (resume) => set((state) => ({
    resume,
    past: [...state.past.slice(-29), structuredClone(state.resume)],
    future: [],
    lastEditAt: 0,
  })),
  hydrate: (resume) => set({ resume, past: [], future: [], lastEditAt: 0, hydrated: true }),
  undo: () => set((state) => {
    const previous = state.past.at(-1)
    if (!previous) return state
    return {
      resume: previous,
      past: state.past.slice(0, -1),
      future: [...state.future, structuredClone(state.resume)],
      lastEditAt: 0,
    }
  }),
  redo: () => set((state) => {
    const next = state.future.at(-1)
    if (!next) return state
    return {
      resume: next,
      past: [...state.past, structuredClone(state.resume)],
      future: state.future.slice(0, -1),
      lastEditAt: 0,
    }
  }),
  setHydrated: () => set({ hydrated: true }),
}))
