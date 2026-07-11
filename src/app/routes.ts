export type AppRoute = 'home' | 'subjects' | 'add' | 'manage' | 'quiz' | 'kt' | 'stats' | 'profile' | 'admin'

export const ROUTE_PATHS: Record<AppRoute, string> = {
  home: '/',
  subjects: '/subjects',
  add: '/questions/new',
  manage: '/questions',
  quiz: '/quiz',
  kt: '/kt',
  stats: '/statistics',
  profile: '/profile',
  admin: '/admin',
}

const pathRoutes = Object.entries(ROUTE_PATHS).map(([route, path]) => [path, route])

export const routeFromPathname = (pathname: string): AppRoute | undefined =>
  Object.fromEntries(pathRoutes)[pathname] as AppRoute | undefined
