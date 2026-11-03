import { useState } from 'react'
import { Button } from '@/components/ui/button'

function App(): React.JSX.Element {
  const [evil, setEvil] = useState(false)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <h1 className="font-heading text-5xl font-semibold tracking-tight">
        {evil ? '>:) 666' : 'hello'}
      </h1>
      <Button onClick={() => setEvil(!evil)}>{evil ? 'Back to hello' : 'Do it'}</Button>
    </main>
  )
}

export default App
