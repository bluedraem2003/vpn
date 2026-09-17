import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function TeamPage() {
  const [items, setItems] = useState<Array<{ id: string; email: string; name: string; role: string }>>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .team()
      .then((res) => setItems(res.items))
      .catch((e) => setError((e as Error).message))
  }, [])

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>تیم</h1>
          <p>اعضای ورک‌اسپیس و نقش‌ها</p>
        </div>
      </header>
      <div className="panel panel-pad">
        {error && <p className="section-sub">{error}</p>}
        <div className="page-list">
          {items.map((m) => (
            <article key={m.id} className="list-item">
              <div className="list-meta">
                <h3>{m.name}</h3>
                <span className="meta-badge">{m.role}</span>
              </div>
              <p>{m.email}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
