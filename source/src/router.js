import { createRouter, createWebHashHistory } from 'vue-router'
import { setMonitorMode } from './stores/monitor'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('./views/Dashboard.vue'),
    meta: { mode: 'dashboard' }
  },
  {
    path: '/server/:id',
    name: 'server-detail',
    component: () => import('./views/ServerDetail.vue'),
    meta: { mode: 'detail' }
  },
  {
    path: '/epaper',
    name: 'epaper',
    component: () => import('./views/Epaper.vue'),
    meta: { mode: 'epaper' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to) => {
  setMonitorMode(to.meta.mode || 'dashboard')
})

export default router
