export type AppRoute = 'home' | 'subjects' | 'add' | 'manage' | 'quiz' | 'kt' | 'stats'

export const ROUTE_PATHS: Record<AppRoute, string> = {
  home: '/',
  subjects: '/subjects',
  add: '/questions/new',
  manage: '/questions',
  quiz: '/quiz',
  kt: '/kt',
  stats: '/statistics',
}

const pathRoutes = Object.entries(ROUTE_PATHS).map(([route, path]) => [path, route])

export const routeFromPathname = (pathname: string): AppRoute | undefined =>
  Object.fromEntries(pathRoutes)[pathname] as AppRoute | undefined
