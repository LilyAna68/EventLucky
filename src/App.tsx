import { useState } from 'react'
import HomeView from '@/components/HomeView'
import CreateEventView from '@/components/CreateEventView'
import EventView from '@/components/EventView'
import type { AppView } from '@/types'

function getInitialEventId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('event')
}

export default function App() {
  const [activeEventId, setActiveEventId] = useState<string | null>(getInitialEventId)
  const [view, setView] = useState<AppView>(() => (getInitialEventId() ? 'event' : 'home'))

  const goHome = () => {
    setView('home')
    setActiveEventId(null)
    window.history.replaceState({}, '', window.location.pathname)
  }

  const goCreate = () => setView('create')

  const goEvent = (id: string) => {
    setActiveEventId(id)
    setView('event')
    window.history.replaceState({}, '', `?event=${id}`)
  }

  const handleCreated = (eventId: string) => {
    goEvent(eventId)
  }

  if (view === 'create') {
    return <CreateEventView onBack={goHome} onCreated={handleCreated} />
  }

  if (view === 'event' && activeEventId) {
    return <EventView eventId={activeEventId} onBack={goHome} />
  }

  return <HomeView onCreateEvent={goCreate} onJoinEvent={goEvent} />
}
