import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useCommandStore } from './stores/commandStore'
import { useStockStore } from './stores/stockStore'
import { useTaskStore } from './stores/taskStore'
import './plugins/fontawesome'
import './styles/global.scss'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const taskStore = useTaskStore()
const stockStore = useStockStore()
const commandStore = useCommandStore()

void Promise.all([taskStore.init(), stockStore.init(), commandStore.init()]).then(() => {
  app.mount('#app')
})
