import { useEffect, useRef, useState } from 'react'
import Home from './screens/Home'
import NewRound from './screens/NewRound'
import Play from './screens/Play'
import Summary from './screens/Summary'
import Stats from './screens/Stats'
import Courses from './screens/Courses'
import Settings from './screens/Settings'

export type View =
  | { name: 'home' }
  | { name: 'new-round' }
  | { name: 'play'; roundId: number }
  | { name: 'summary'; roundId: number; from?: 'play' | 'list' }
  | { name: 'stats' }
  | { name: 'courses' }
  | { name: 'settings' }

export type Navigate = (view: View) => void

const TABS: { view: View; label: string; icon: string }[] = [
  { view: { name: 'home' }, label: 'Home', icon: '⛳' },
  { view: { name: 'stats' }, label: 'Stats', icon: '📈' },
  { view: { name: 'courses' }, label: 'Courses', icon: '🗺️' },
  { view: { name: 'settings' }, label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' })
  const viewRef = useRef(view)
  viewRef.current = view
  // The Play screen registers a custom back action here (previous hole).
  const backHandlerRef = useRef<(() => boolean) | null>(null)

  // Trap the browser/hardware back gesture so it navigates inside the app
  // instead of leaving to a blank page. Always re-arm so back never falls through.
  useEffect(() => {
    history.pushState(null, '')
    const onPop = () => {
      history.pushState(null, '')
      const v = viewRef.current
      if (v.name === 'play' && backHandlerRef.current?.()) return
      if (v.name !== 'home') setView({ name: 'home' })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const screen = (() => {
    switch (view.name) {
      case 'home':
        return <Home navigate={setView} />
      case 'new-round':
        return <NewRound navigate={setView} />
      case 'play':
        return <Play navigate={setView} roundId={view.roundId} backHandlerRef={backHandlerRef} />
      case 'summary':
        return <Summary navigate={setView} roundId={view.roundId} from={view.from} />
      case 'stats':
        return <Stats navigate={setView} />
      case 'courses':
        return <Courses navigate={setView} />
      case 'settings':
        return <Settings navigate={setView} />
    }
  })()

  const hideTabs = view.name === 'play'

  return (
    <>
      {screen}
      {!hideTabs && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button
              key={t.label}
              className={view.name === t.view.name ? 'active' : ''}
              onClick={() => setView(t.view)}
            >
              <span className="icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </>
  )
}
