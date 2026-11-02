/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '*.module.scss' {
  const classes: Record<string, string>
  export default classes
}

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: FileSystemHandle | WellKnownDirectory
}

type WellKnownDirectory =
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos'

interface Window {
  showDirectoryPicker: (
    options?: DirectoryPickerOptions,
  ) => Promise<FileSystemDirectoryHandle>
}
